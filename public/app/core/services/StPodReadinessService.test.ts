import { setBackendSrv, type BackendSrv } from '@grafana/runtime';

import { StPodReadinessService, StPodStatus } from './StPodReadinessService';
import { ST_POD_POLL_INTERVAL_MS, ST_POD_READY_TTL_MS, ST_POD_TIMEOUT_MS } from './stPodReadinessConstants';

const podUp = () => Promise.resolve({ database: 'ok' });
const podDown = () => Promise.resolve({ database: 'failing' });
const podError = () => Promise.reject(new Error('network'));

const installBackend = (handler: () => Promise<unknown>): jest.Mock => {
  const get = jest.fn(handler);
  setBackendSrv({ get } as unknown as BackendSrv);
  return get;
};

const flushMicrotasks = () => Promise.resolve();

describe('StPodReadinessService', () => {
  let service: StPodReadinessService;

  beforeEach(() => {
    service = new StPodReadinessService();
  });

  afterEach(() => {
    service.stop();
    jest.useRealTimers();
  });

  it('starts in the unknown status with no polling', () => {
    const get = installBackend(podUp);

    expect(service.getStatus()).toBe(StPodStatus.Unknown);
    expect(get).not.toHaveBeenCalled();
  });

  it('returns the same pending promise on repeated calls while not ready', () => {
    expect(service.getReadyPromise()).toBe(service.getReadyPromise());
  });

  it('leaves the ready promise pending until the pod becomes ready', async () => {
    const stillPending = Symbol('still-pending');
    const race = Promise.race([service.getReadyPromise(), Promise.resolve(stillPending)]);

    await expect(race).resolves.toBe(stillPending);
  });

  it('transitions unknown to ready and resolves the pending promise when the pod is up', async () => {
    installBackend(podUp);
    const pending = service.getReadyPromise();

    service.start();
    await flushMicrotasks();

    expect(service.getStatus()).toBe(StPodStatus.Ready);
    await expect(pending).resolves.toBeUndefined();
  });

  it('transitions unknown to waiting when the pod reports not ok', async () => {
    installBackend(podDown);

    service.start();
    await flushMicrotasks();

    expect(service.getStatus()).toBe(StPodStatus.Waiting);
  });

  it('treats network errors as waiting', async () => {
    installBackend(podError);

    service.start();
    await flushMicrotasks();

    expect(service.getStatus()).toBe(StPodStatus.Waiting);
  });

  it('suppresses the global error toast on failed health requests', async () => {
    const get = installBackend(podError);

    service.start();
    await flushMicrotasks();

    expect(get).toHaveBeenCalledWith('/api/health', undefined, undefined, { showErrorAlert: false });
  });

  it('start is idempotent while already polling', async () => {
    const get = installBackend(podDown);

    service.start();
    service.start();
    service.start();
    await flushMicrotasks();

    expect(get).toHaveBeenCalledTimes(1);
  });

  it('reaches timeout but keeps the pending promise pending so the loader stays mounted', async () => {
    jest.useFakeTimers();
    installBackend(podDown);
    const pending = service.getReadyPromise();

    service.start();
    await jest.advanceTimersByTimeAsync(ST_POD_TIMEOUT_MS);

    expect(service.getStatus()).toBe(StPodStatus.Timeout);
    const stillPending = Symbol('still-pending');
    await expect(Promise.race([pending, Promise.resolve(stillPending)])).resolves.toBe(stillPending);
  });

  it('polls again after the poll interval while the pod is not ready', async () => {
    jest.useFakeTimers();
    const get = installBackend(podDown);

    service.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(get).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(ST_POD_POLL_INTERVAL_MS);

    expect(get).toHaveBeenCalledTimes(2);
  });

  it('stops polling once the pod is ready', async () => {
    jest.useFakeTimers();
    const get = installBackend(podUp);

    service.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(service.getStatus()).toBe(StPodStatus.Ready);

    await jest.advanceTimersByTimeAsync(ST_POD_POLL_INTERVAL_MS * 6);

    expect(get).toHaveBeenCalledTimes(1);
  });

  it('does not time out after reaching ready', async () => {
    jest.useFakeTimers();
    installBackend(podUp);

    service.start();
    await jest.advanceTimersByTimeAsync(ST_POD_TIMEOUT_MS * 2);

    expect(service.getStatus()).toBe(StPodStatus.Ready);
  });

  it('start after timeout resets and begins fresh polling', async () => {
    jest.useFakeTimers();
    installBackend(podDown);

    service.start();
    await jest.advanceTimersByTimeAsync(ST_POD_TIMEOUT_MS);
    expect(service.getStatus()).toBe(StPodStatus.Timeout);

    service.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(service.getStatus()).toBe(StPodStatus.Waiting);
  });

  it('resolves the stale pending promise when reset so suspended consumers can re-render', async () => {
    jest.useFakeTimers();
    installBackend(podDown);

    service.start();
    const stale = service.getReadyPromise();
    await jest.advanceTimersByTimeAsync(ST_POD_TIMEOUT_MS);
    expect(service.getStatus()).toBe(StPodStatus.Timeout);

    service.start();

    await expect(stale).resolves.toBeUndefined();
  });

  it('hands out a fresh pending promise after recovering from timeout', async () => {
    jest.useFakeTimers();
    installBackend(podDown);

    service.start();
    const timedOut = service.getReadyPromise();
    await jest.advanceTimersByTimeAsync(ST_POD_TIMEOUT_MS);
    expect(service.getStatus()).toBe(StPodStatus.Timeout);

    service.start();
    const fresh = service.getReadyPromise();
    expect(fresh).not.toBe(timedOut);

    const stillPending = Symbol('still-pending');
    await expect(Promise.race([fresh, Promise.resolve(stillPending)])).resolves.toBe(stillPending);
  });

  it('start after ready within TTL is a no-op', async () => {
    jest.useFakeTimers();
    const get = installBackend(podUp);

    service.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(service.getStatus()).toBe(StPodStatus.Ready);
    expect(get).toHaveBeenCalledTimes(1);

    service.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(get).toHaveBeenCalledTimes(1);
    expect(service.getStatus()).toBe(StPodStatus.Ready);
  });

  it('start after ready past TTL resets and re-polls', async () => {
    jest.useFakeTimers();
    const get = installBackend(podUp);

    service.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(service.getStatus()).toBe(StPodStatus.Ready);

    jest.setSystemTime(Date.now() + ST_POD_READY_TTL_MS + 1);
    service.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(get).toHaveBeenCalledTimes(2);
    expect(service.getStatus()).toBe(StPodStatus.Ready);
  });

  it('stop cancels both timers', async () => {
    jest.useFakeTimers();
    const get = installBackend(podDown);

    service.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(get).toHaveBeenCalledTimes(1);

    service.stop();
    await jest.advanceTimersByTimeAsync(ST_POD_TIMEOUT_MS * 2);

    expect(get).toHaveBeenCalledTimes(1);
    expect(service.getStatus()).toBe(StPodStatus.Waiting);
  });

  it('notifies subscribers through the behavior subject', async () => {
    installBackend(podUp);
    const seen: StPodStatus[] = [];
    const subscription = service.state.subscribe((status) => seen.push(status));

    service.start();
    await flushMicrotasks();

    expect(seen).toEqual([StPodStatus.Unknown, StPodStatus.Ready]);
    subscription.unsubscribe();
  });

  describe('lazy TTL expiry', () => {
    it('reads continue to return ready after TTL elapses until start is called', async () => {
      jest.useFakeTimers();
      const get = installBackend(podUp);

      service.start();
      await jest.advanceTimersByTimeAsync(0);
      expect(service.getStatus()).toBe(StPodStatus.Ready);
      expect(get).toHaveBeenCalledTimes(1);

      jest.setSystemTime(Date.now() + ST_POD_READY_TTL_MS + 1);

      expect(service.getStatus()).toBe(StPodStatus.Ready);
      expect(get).toHaveBeenCalledTimes(1);
    });

    it('start after TTL elapses resets to unknown and restarts the pod check', async () => {
      jest.useFakeTimers();
      const get = installBackend(podUp);

      service.start();
      await jest.advanceTimersByTimeAsync(0);
      expect(get).toHaveBeenCalledTimes(1);

      jest.setSystemTime(Date.now() + ST_POD_READY_TTL_MS + 1);
      service.start();
      await jest.advanceTimersByTimeAsync(0);

      expect(get).toHaveBeenCalledTimes(2);
      expect(service.getStatus()).toBe(StPodStatus.Ready);
    });

    it('preserves subscribers across the expiry transition', async () => {
      jest.useFakeTimers();
      installBackend(podUp);
      const seen: StPodStatus[] = [];
      const subscription = service.state.subscribe((status) => seen.push(status));

      service.start();
      await jest.advanceTimersByTimeAsync(0);

      jest.setSystemTime(Date.now() + ST_POD_READY_TTL_MS + 1);
      service.start();
      await jest.advanceTimersByTimeAsync(0);

      expect(seen).toEqual([StPodStatus.Unknown, StPodStatus.Ready, StPodStatus.Unknown, StPodStatus.Ready]);
      subscription.unsubscribe();
    });

    it('does not fire any wall-clock timer at the TTL boundary', async () => {
      jest.useFakeTimers();
      const get = installBackend(podUp);

      service.start();
      await jest.advanceTimersByTimeAsync(0);
      expect(get).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(ST_POD_READY_TTL_MS * 2);

      expect(get).toHaveBeenCalledTimes(1);
      expect(service.state.getValue()).toBe(StPodStatus.Ready);
    });
  });
});
