import {
  mapGatewayStatus,
  parseGatewayStatus,
  parseRetryAfterMs,
  StPodReadyService,
  StPodStatus,
} from './StPodReadyService';
import { DEFAULT_ST_POD_POLL_INTERVAL_MS, ST_POD_READY_TTL_MS, ST_POD_TIMEOUT_MS } from './stPodReadyConstants';

describe('mapGatewayStatus', () => {
  it.each([
    ['active', 200, StPodStatus.Ready],
    ['starting', 200, StPodStatus.Waiting],
    ['migrating', 200, StPodStatus.Waiting],
    ['restoring', 200, StPodStatus.Waiting],
    ['archiving', 200, StPodStatus.Waiting],
    ['migrated', 200, StPodStatus.Waiting],
    ['unavailable', 200, StPodStatus.Waiting],
    ['captcha', 200, StPodStatus.Captcha],
    ['suspended', 200, StPodStatus.Error],
    ['deleting', 200, StPodStatus.Error],
    ['outdated', 200, StPodStatus.Error],
    ['brand-new-state', 200, StPodStatus.Error],
    ['not_found', 404, StPodStatus.Error],
    ['error', 500, StPodStatus.Error],
    ['anything', 503, StPodStatus.Error],
    [undefined, 200, StPodStatus.Error],
    [undefined, 500, StPodStatus.Error],
  ])('maps raw %p / HTTP %p → %p', (raw, httpStatus, expected) => {
    expect(mapGatewayStatus(raw, httpStatus)).toBe(expected);
  });
});

describe('parseRetryAfterMs', () => {
  it.each([
    ['10', 10_000],
    ['30', 30_000],
    ['1', 1_000],
  ])('%p → %p ms', (raw, expected) => {
    expect(parseRetryAfterMs(raw)).toBe(expected);
  });

  it.each<[string | null, string]>([
    ['0', 'zero'],
    ['-5', 'negative'],
    ['0.5', 'fractional'],
    ['1.0', 'decimal'],
    ['later', 'non-numeric'],
    ['Wed, 21 Oct 2015 07:28:00 GMT', 'HTTP-date'],
    ['10 seconds', 'with suffix'],
    [' 10', 'leading whitespace'],
    ['10 ', 'trailing whitespace'],
    ['', 'empty string'],
    [null, 'null'],
  ])('%p (%s) falls back to the default interval', (raw) => {
    expect(parseRetryAfterMs(raw)).toBe(DEFAULT_ST_POD_POLL_INTERVAL_MS);
  });
});

describe('parseGatewayStatus', () => {
  it('extracts the status string from a well-formed body', async () => {
    await expect(parseGatewayStatus(new Response('{"status":"active"}'))).resolves.toBe('active');
  });

  it.each([
    ['non-JSON body', 'not-json'],
    ['empty object', '{}'],
    ['null body', 'null'],
    ['status is a number', '{"status":42}'],
    ['status is null', '{"status":null}'],
    ['status is an object', '{"status":{"nested":true}}'],
  ])('%s → undefined', async (_label, body) => {
    await expect(parseGatewayStatus(new Response(body))).resolves.toBeUndefined();
  });
});

describe('StPodReadyService', () => {
  type FetchHandler = () => Promise<Response>;

  const gatewayJson = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), init);

  const installFetch = (handler: FetchHandler): jest.Mock => {
    const fetchMock = jest.fn(handler);
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  };

  const respondWith = (body: unknown, init: ResponseInit = {}) =>
    installFetch(() => Promise.resolve(gatewayJson(body, init)));

  const activeOnce = () => respondWith({ status: 'active' });
  const startingOnce = () => respondWith({ status: 'starting' });
  const networkErrorOnce = () => installFetch(() => Promise.reject(new Error('network')));

  let service: StPodReadyService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.useFakeTimers();
    service = new StPodReadyService();
  });

  afterEach(() => {
    service.stop();
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  it('starts in the unknown status', () => {
    expect(service.getStatus()).toBe(StPodStatus.Unknown);
  });

  it('returns the same pending promise on repeated calls while not ready', () => {
    expect(service.getReadyPromise()).toBe(service.getReadyPromise());
  });

  it('leaves the ready promise pending until the pod becomes ready', async () => {
    const stillPending = Symbol('still-pending');
    const race = Promise.race([service.getReadyPromise(), Promise.resolve(stillPending)]);

    await expect(race).resolves.toBe(stillPending);
  });

  it('transitions unknown to ready and resolves the pending promise when the gateway returns active', async () => {
    activeOnce();
    const pending = service.getReadyPromise();

    service.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(service.getStatus()).toBe(StPodStatus.Ready);
    await expect(pending).resolves.toBeUndefined();
  });

  it('polls /_/status with no-store cache and omit credentials', async () => {
    const fetchMock = activeOnce();

    service.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(fetchMock).toHaveBeenCalledWith(
      '/_/status',
      expect.objectContaining({ cache: 'no-store', credentials: 'omit' })
    );
  });

  it.each<[string, FetchHandler, StPodStatus]>([
    ['starting response', () => Promise.resolve(gatewayJson({ status: 'starting' })), StPodStatus.Waiting],
    ['500 response', () => Promise.resolve(gatewayJson({ status: 'error' }, { status: 500 })), StPodStatus.Error],
    ['network failure', () => Promise.reject(new Error('network')), StPodStatus.Error],
  ])('transitions to the mapped status on %s', async (_label, handler, expected) => {
    installFetch(handler);

    service.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(service.getStatus()).toBe(expected);
  });

  it('start is idempotent while already polling', async () => {
    const fetchMock = startingOnce();

    service.start();
    service.start();
    service.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reaches timeout but keeps the pending promise pending so the loader stays mounted', async () => {
    startingOnce();
    const pending = service.getReadyPromise();

    service.start();
    await jest.advanceTimersByTimeAsync(ST_POD_TIMEOUT_MS);

    expect(service.getStatus()).toBe(StPodStatus.Timeout);
    const stillPending = Symbol('still-pending');
    await expect(Promise.race([pending, Promise.resolve(stillPending)])).resolves.toBe(stillPending);
  });

  it('polls again after the default interval while in a waiting state', async () => {
    const fetchMock = startingOnce();

    service.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(DEFAULT_ST_POD_POLL_INTERVAL_MS);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('honors Retry-After and delays the next poll by that many seconds', async () => {
    const fetchMock = respondWith({ status: 'starting' }, { headers: { 'retry-after': '30' } });

    service.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(DEFAULT_ST_POD_POLL_INTERVAL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(30_000 - DEFAULT_ST_POD_POLL_INTERVAL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('transitions to captcha and resolves the pending promise so suspended consumers can re-render', async () => {
    respondWith({ status: 'captcha' });
    const pending = service.getReadyPromise();

    service.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(service.getStatus()).toBe(StPodStatus.Captcha);
    await expect(pending).resolves.toBeUndefined();
  });

  it.each<[string, FetchHandler]>([
    ['ready (active)', () => Promise.resolve(gatewayJson({ status: 'active' }))],
    ['terminal error (suspended)', () => Promise.resolve(gatewayJson({ status: 'suspended' }))],
    ['captcha', () => Promise.resolve(gatewayJson({ status: 'captcha' }))],
  ])('stops polling after reaching a terminal state: %s', async (_label, handler) => {
    const fetchMock = installFetch(handler);

    service.start();
    await jest.advanceTimersByTimeAsync(0);

    await jest.advanceTimersByTimeAsync(DEFAULT_ST_POD_POLL_INTERVAL_MS * 6);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps polling after timeout so the pod can still auto-recover', async () => {
    const fetchMock = startingOnce();

    service.start();
    await jest.advanceTimersByTimeAsync(ST_POD_TIMEOUT_MS);
    expect(service.getStatus()).toBe(StPodStatus.Timeout);
    const callsAtTimeout = fetchMock.mock.calls.length;

    await jest.advanceTimersByTimeAsync(DEFAULT_ST_POD_POLL_INTERVAL_MS * 2);

    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAtTimeout);
  });

  it('auto-recovers from timeout to ready when the pod eventually responds active', async () => {
    let gatewayState = 'starting';
    const fetchMock = installFetch(() => Promise.resolve(gatewayJson({ status: gatewayState })));

    service.start();
    await jest.advanceTimersByTimeAsync(ST_POD_TIMEOUT_MS);
    expect(service.getStatus()).toBe(StPodStatus.Timeout);

    gatewayState = 'active';
    await jest.advanceTimersByTimeAsync(DEFAULT_ST_POD_POLL_INTERVAL_MS);

    expect(service.getStatus()).toBe(StPodStatus.Ready);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });

  describe('recovery from error via start', () => {
    it('resets state and begins fresh polling', async () => {
      networkErrorOnce();
      service.start();
      await jest.advanceTimersByTimeAsync(0);
      expect(service.getStatus()).toBe(StPodStatus.Error);

      startingOnce();
      service.start();
      await jest.advanceTimersByTimeAsync(0);

      expect(service.getStatus()).toBe(StPodStatus.Waiting);
    });

    it('resolves the stale pending promise so suspended consumers unblock', async () => {
      networkErrorOnce();
      service.start();
      const stale = service.getReadyPromise();
      await jest.advanceTimersByTimeAsync(0);

      service.start();

      await expect(stale).resolves.toBeUndefined();
    });

    it('hands out a fresh pending promise that stays pending until the next ready', async () => {
      networkErrorOnce();
      service.start();
      const errored = service.getReadyPromise();
      await jest.advanceTimersByTimeAsync(0);

      startingOnce();
      service.start();
      const fresh = service.getReadyPromise();
      expect(fresh).not.toBe(errored);

      const stillPending = Symbol('still-pending');
      await expect(Promise.race([fresh, Promise.resolve(stillPending)])).resolves.toBe(stillPending);
    });
  });

  describe('ready TTL', () => {
    it('reads continue to return ready after TTL elapses, with no wall-clock polling', async () => {
      const fetchMock = activeOnce();

      service.start();
      await jest.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(ST_POD_READY_TTL_MS * 2);
      jest.setSystemTime(Date.now() + ST_POD_READY_TTL_MS + 1);

      expect(service.getStatus()).toBe(StPodStatus.Ready);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('start within TTL is a no-op', async () => {
      const fetchMock = activeOnce();

      service.start();
      await jest.advanceTimersByTimeAsync(0);

      service.start();
      await jest.advanceTimersByTimeAsync(0);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(service.getStatus()).toBe(StPodStatus.Ready);
    });

    it('start past TTL resets and re-polls', async () => {
      const fetchMock = activeOnce();

      service.start();
      await jest.advanceTimersByTimeAsync(0);

      jest.setSystemTime(Date.now() + ST_POD_READY_TTL_MS + 1);
      service.start();
      await jest.advanceTimersByTimeAsync(0);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(service.getStatus()).toBe(StPodStatus.Ready);
    });
  });

  it('stop cancels polling', async () => {
    const fetchMock = startingOnce();

    service.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    service.stop();
    await jest.advanceTimersByTimeAsync(ST_POD_TIMEOUT_MS * 2);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers through the behavior subject', async () => {
    activeOnce();
    const seen: StPodStatus[] = [];
    const subscription = service.state.subscribe((status) => seen.push(status));

    service.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(seen).toEqual([StPodStatus.Unknown, StPodStatus.Ready]);
    subscription.unsubscribe();
  });

  describe('in-flight request hygiene', () => {
    const neverResolvingFetch = () => {
      let resolve: (value: Response) => void = () => {};
      const fetchMock = jest.fn(() => new Promise<Response>((res) => (resolve = res)));
      global.fetch = fetchMock as unknown as typeof fetch;
      return { fetchMock, resolve: (body: unknown) => resolve(gatewayJson(body)) };
    };

    it('does not stack polls when the backend is slower than the poll interval', async () => {
      const { fetchMock, resolve } = neverResolvingFetch();

      service.start();
      await jest.advanceTimersByTimeAsync(0);
      await jest.advanceTimersByTimeAsync(DEFAULT_ST_POD_POLL_INTERVAL_MS * 5);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      resolve({ status: 'starting' });
      await jest.advanceTimersByTimeAsync(0);
      await jest.advanceTimersByTimeAsync(DEFAULT_ST_POD_POLL_INTERVAL_MS);

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('aborts the in-flight gateway request when the service is stopped', async () => {
      let capturedSignal: AbortSignal | undefined;
      global.fetch = jest.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        capturedSignal = init?.signal ?? undefined;
        return new Promise<Response>(() => {});
      }) as unknown as typeof fetch;

      service.start();
      await jest.advanceTimersByTimeAsync(0);
      expect(capturedSignal?.aborted).toBe(false);

      service.stop();

      expect(capturedSignal?.aborted).toBe(true);
    });

    it('does not transition out of a terminal state when an in-flight poll resolves after stop', async () => {
      const { resolve } = neverResolvingFetch();

      service.start();
      await jest.advanceTimersByTimeAsync(0);
      service.stop();

      resolve({ status: 'active' });
      await jest.advanceTimersByTimeAsync(0);

      expect(service.getStatus()).toBe(StPodStatus.Unknown);
    });
  });
});
