import { lastValueFrom, Observable, of } from 'rxjs';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { type BackendSrv, getBackendSrv } from '@grafana/runtime';
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';

import {
  abortNotifier,
  findDatasourceWithData,
  HEALTH_CHECK_TIMEOUT_MS,
  isDatasourceHealthy,
  listProbeCandidates,
  MAX_PROBED_DATASOURCES,
  PROBE_TIMEOUT_MS,
  probeProxyGet,
  resetProbeHealth,
  withDeadline,
} from './probeUtils';
import { detectSignal, SIGNAL_BUDGET_MS } from './solutionState';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceList: jest.fn(),
}));

const getDataSourceInstanceListMock = jest.mocked(getDataSourceInstanceList);
const healthGetMock = jest.fn();

function listItem(ds: { uid?: string; name: string; isDefault?: boolean }): DataSourceInstanceListItem {
  return {
    uid: ds.uid ?? ds.name,
    name: ds.name,
    type: 'loki',
    meta: { id: 'loki' } as DataSourceInstanceListItem['meta'],
    isDefault: ds.isDefault ?? false,
  };
}

describe('withDeadline', () => {
  it('resolves with the work value when it settles inside the deadline', async () => {
    await expect(withDeadline(50, undefined, async () => 'ok')).resolves.toBe('ok');
  });

  it('propagates a rejection that happens inside the deadline', async () => {
    await expect(withDeadline(50, undefined, () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
  });

  it('rejects at the deadline and aborts the signal of work that ignores it', async () => {
    jest.useFakeTimers();
    try {
      let captured: AbortSignal | undefined;
      const promise = withDeadline(20, undefined, (signal) => {
        captured = signal;
        return new Promise<never>(() => {});
      });
      const assertion = expect(promise).rejects.toThrow(/timed out/i);
      await jest.advanceTimersByTimeAsync(20);

      await assertion;
      expect(captured?.aborted).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects with the timeout error when the work rejects in reaction to the abort', async () => {
    jest.useFakeTimers();
    try {
      const promise = withDeadline(
        20,
        undefined,
        (signal) =>
          new Promise<never>((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))))
      );
      const assertion = expect(promise).rejects.toThrow(/timed out/i);
      await jest.advanceTimersByTimeAsync(20);

      await assertion;
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects with the timeout error when the work resolves in reaction to the abort', async () => {
    jest.useFakeTimers();
    try {
      const promise = withDeadline(
        20,
        undefined,
        (signal) => new Promise<string>((resolve) => signal.addEventListener('abort', () => resolve('cancelled')))
      );
      const assertion = expect(promise).rejects.toThrow(/timed out/i);
      await jest.advanceTimersByTimeAsync(20);

      await assertion;
    } finally {
      jest.useRealTimers();
    }
  });

  it('forwards a parent abort to the work signal', async () => {
    const parent = new AbortController();
    const promise = withDeadline(
      1_000,
      parent.signal,
      (signal) => new Promise<string>((resolve) => signal.addEventListener('abort', () => resolve('aborted')))
    );

    parent.abort();

    await expect(promise).resolves.toBe('aborted');
  });

  it('hands an already-aborted signal to the work when the parent is already aborted', async () => {
    const parent = new AbortController();
    parent.abort();

    await expect(withDeadline(1_000, parent.signal, async (signal) => signal.aborted)).resolves.toBe(true);
  });
});

describe('abortNotifier', () => {
  it('errors with an AbortError for an already-aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(lastValueFrom(abortNotifier(controller.signal))).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('errors with an AbortError once a live signal aborts', async () => {
    const controller = new AbortController();
    const promise = lastValueFrom(abortNotifier(controller.signal));

    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('probeProxyGet', () => {
  const mockFetch = jest.fn();
  const params = { q: '{}', limit: 1 };

  beforeEach(() => {
    mockFetch.mockReset();
    jest.mocked(getBackendSrv).mockReturnValue({ fetch: mockFetch } as unknown as BackendSrv);
  });

  it('resolves with the response body of a proxied GET', async () => {
    mockFetch.mockReturnValue(of({ data: { traces: [] } }));

    await expect(probeProxyGet('tempo', 'api/search', params)).resolves.toEqual({ traces: [] });
    expect(mockFetch).toHaveBeenCalledWith({
      url: '/api/datasources/proxy/uid/tempo/api/search',
      params,
      method: 'GET',
      showErrorAlert: false,
      abortSignal: expect.any(AbortSignal),
    });
  });

  it('unsubscribes a request still pending when the parent aborts', async () => {
    const teardown = jest.fn();
    mockFetch.mockReturnValue(new Observable(() => teardown));
    const controller = new AbortController();
    const promise = probeProxyGet('tempo', 'api/search', params, PROBE_TIMEOUT_MS, controller.signal);

    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(teardown).toHaveBeenCalled();
  });

  it('unsubscribes a request still pending at the deadline', async () => {
    jest.useFakeTimers();
    try {
      const teardown = jest.fn();
      mockFetch.mockReturnValue(new Observable(() => teardown));
      const promise = probeProxyGet('tempo', 'api/search', params);
      const assertion = expect(promise).rejects.toThrow(/timed out/);
      await jest.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS);

      await assertion;
      expect(teardown).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('listProbeCandidates', () => {
  beforeEach(() => {
    getDataSourceInstanceListMock.mockReset();
  });

  it('drops excluded uids', async () => {
    getDataSourceInstanceListMock.mockResolvedValue([
      listItem({ uid: 'excluded', name: 'utility' }),
      listItem({ uid: 'kept', name: 'product' }),
    ]);

    const candidates = await listProbeCandidates('loki', new Set(['excluded']));

    expect(candidates.map((ds) => ds.uid)).toEqual(['kept']);
  });

  it('returns empty when exclusions empty the list', async () => {
    getDataSourceInstanceListMock.mockResolvedValue([listItem({ uid: 'only', name: 'grafanacloud-usage' })]);

    await expect(listProbeCandidates('prometheus', new Set(['only']))).resolves.toEqual([]);
  });

  it('never probes cloud utility datasources, even as the only candidates', async () => {
    getDataSourceInstanceListMock.mockResolvedValue([
      listItem({ name: 'grafanacloud-usage' }),
      listItem({ name: 'product' }),
    ]);

    await expect(listProbeCandidates('prometheus')).resolves.toEqual([listItem({ name: 'product' })]);

    getDataSourceInstanceListMock.mockResolvedValue([listItem({ name: 'grafanacloud-usage' })]);

    await expect(listProbeCandidates('prometheus')).resolves.toEqual([]);

    getDataSourceInstanceListMock.mockResolvedValue([listItem({ name: 'grafanacloud-acme-usage-insights' })]);

    await expect(listProbeCandidates('loki')).resolves.toEqual([]);
  });

  it('skips stack-prefixed Cloud utility Loki datasources by name', async () => {
    getDataSourceInstanceListMock.mockResolvedValue([
      listItem({ uid: 'abc123', name: 'grafanacloud-acme-usage-insights' }),
      listItem({ uid: 'def456', name: 'grafanacloud-acme-alert-state-history' }),
      listItem({ uid: 'loki-main', name: 'grafanacloud-acme-logs' }),
    ]);

    const candidates = await listProbeCandidates('loki');

    expect(candidates.map((ds) => ds.uid)).toEqual(['loki-main']);
  });

  it('skips the unprefixed utility Loki name form beside a product datasource', async () => {
    getDataSourceInstanceListMock.mockResolvedValue([
      listItem({ name: 'grafanacloud-usage-insights' }),
      listItem({ name: 'product' }),
    ]);

    await expect(listProbeCandidates('loki')).resolves.toEqual([listItem({ name: 'product' })]);
  });

  it('puts the default datasource first', async () => {
    getDataSourceInstanceListMock.mockResolvedValue([
      ...Array.from({ length: MAX_PROBED_DATASOURCES }, (_, i) => listItem({ name: `ds-${i}` })),
      listItem({ name: 'the-default', isDefault: true }),
    ]);

    const names = (await listProbeCandidates('loki')).map((ds) => ds.name);

    expect(names).toHaveLength(MAX_PROBED_DATASOURCES + 1);
    expect(names[0]).toBe('the-default');
  });
});

describe('isDatasourceHealthy', () => {
  beforeEach(() => {
    resetProbeHealth();
    healthGetMock.mockReset();
    jest.mocked(getBackendSrv).mockReturnValue({ get: healthGetMock } as unknown as BackendSrv);
  });

  it('reports a datasource whose health check answers OK as healthy', async () => {
    healthGetMock.mockResolvedValue({ status: 'OK' });

    await expect(isDatasourceHealthy('healthy')).resolves.toBe(true);
    expect(healthGetMock).toHaveBeenCalledWith('/api/datasources/uid/healthy/health', undefined, undefined, {
      showErrorAlert: false,
      abortSignal: expect.any(AbortSignal),
    });
  });

  it('reports a non-OK status as unhealthy', async () => {
    healthGetMock.mockResolvedValue({ status: 'ERROR' });

    await expect(isDatasourceHealthy('sick')).resolves.toBe(false);
  });

  it('reports a rejected health check as unhealthy', async () => {
    healthGetMock.mockRejectedValue(new Error('connection refused'));

    await expect(isDatasourceHealthy('broken')).resolves.toBe(false);
  });

  it('reports a health check that hangs past the cutoff as unhealthy', async () => {
    jest.useFakeTimers();
    try {
      healthGetMock.mockReturnValue(new Promise(() => {}));

      const promise = isDatasourceHealthy('hung');
      await jest.advanceTimersByTimeAsync(HEALTH_CHECK_TIMEOUT_MS + 1);

      await expect(promise).resolves.toBe(false);
      expect(healthGetMock.mock.calls[0][3].abortSignal.aborted).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('shares one /health request per uid across concurrent callers', async () => {
    healthGetMock.mockResolvedValue({ status: 'OK' });

    await expect(Promise.all([isDatasourceHealthy('shared'), isDatasourceHealthy('shared')])).resolves.toEqual([
      true,
      true,
    ]);
    expect(healthGetMock).toHaveBeenCalledTimes(1);
  });

  it('issues one /health request per overlapping uid across scans with different candidate orders', async () => {
    healthGetMock.mockResolvedValue({ status: 'OK' });
    const a = listItem({ uid: 'a', name: 'a' });
    const b = listItem({ uid: 'b', name: 'b' });
    const c = listItem({ uid: 'c', name: 'c' });

    await Promise.all([
      findDatasourceWithData([a, b, c], async () => false),
      findDatasourceWithData([c, a, b], async () => false),
    ]);

    expect(healthGetMock).toHaveBeenCalledTimes(3);
    expect(healthGetMock.mock.calls.map(([url]) => url).sort()).toEqual([
      '/api/datasources/uid/a/health',
      '/api/datasources/uid/b/health',
      '/api/datasources/uid/c/health',
    ]);
  });

  it('re-checks after the TTL, including a cached unhealthy answer', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    try {
      nowSpy.mockReturnValue(0);
      healthGetMock.mockResolvedValue({ status: 'ERROR' });
      await expect(isDatasourceHealthy('flaky')).resolves.toBe(false);
      await expect(isDatasourceHealthy('flaky')).resolves.toBe(false);
      expect(healthGetMock).toHaveBeenCalledTimes(1);

      nowSpy.mockReturnValue(61_000);
      healthGetMock.mockResolvedValue({ status: 'OK' });

      await expect(isDatasourceHealthy('flaky')).resolves.toBe(true);
      expect(healthGetMock).toHaveBeenCalledTimes(2);
    } finally {
      nowSpy.mockRestore();
    }
  });
});

describe('findDatasourceWithData', () => {
  beforeEach(() => {
    resetProbeHealth();
    healthGetMock.mockReset();
    healthGetMock.mockResolvedValue({ status: 'OK' });
    jest.mocked(getBackendSrv).mockReturnValue({ get: healthGetMock } as unknown as BackendSrv);
  });

  it('prefers the first candidate in priority order even when a later one settles sooner', async () => {
    jest.useFakeTimers();
    try {
      const first = listItem({ uid: 'first', name: 'first' });
      const second = listItem({ uid: 'second', name: 'second' });
      const hasData = (ds: DataSourceInstanceListItem) =>
        ds.uid === 'first'
          ? new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 20))
          : Promise.resolve(true);

      const promise = findDatasourceWithData([first, second], hasData);
      await jest.advanceTimersByTimeAsync(25);

      await expect(promise).resolves.toBe(first);
    } finally {
      jest.useRealTimers();
    }
  });

  it('returns a hit without waiting for a hung lower-priority sibling and aborts it', async () => {
    const first = listItem({ uid: 'first', name: 'first' });
    const hung = listItem({ uid: 'hung', name: 'hung' });
    const signals = new Map<string, AbortSignal>();
    const hasData = (ds: DataSourceInstanceListItem, signal: AbortSignal) => {
      signals.set(ds.uid, signal);
      return ds.uid === 'first' ? Promise.resolve(true) : new Promise<boolean>(() => {});
    };

    await expect(findDatasourceWithData([first, hung], hasData)).resolves.toBe(first);
    expect(signals.get('hung')?.aborted).toBe(true);
  });

  it('aborts the batch signal after a miss', async () => {
    const a = listItem({ uid: 'a', name: 'a' });
    const b = listItem({ uid: 'b', name: 'b' });
    const signals = new Map<string, AbortSignal>();
    const hasData = async (ds: DataSourceInstanceListItem, signal: AbortSignal) => {
      signals.set(ds.uid, signal);
      return false;
    };

    await expect(findDatasourceWithData([a, b], hasData)).resolves.toBeNull();
    expect(signals.get('a')?.aborted).toBe(true);
  });

  it('never probes a sibling whose health settles after the hit', async () => {
    let resolveLateHealth: (value: { status: string }) => void = () => {};
    const lateHealth = new Promise<{ status: string }>((resolve) => {
      resolveLateHealth = resolve;
    });
    healthGetMock.mockImplementation((url: string) =>
      url.includes('/late/') ? lateHealth : Promise.resolve({ status: 'OK' })
    );
    const first = listItem({ uid: 'first', name: 'first' });
    const late = listItem({ uid: 'late', name: 'late' });
    const hasData = jest.fn(async () => true);

    await expect(findDatasourceWithData([first, late], hasData)).resolves.toBe(first);

    resolveLateHealth({ status: 'OK' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(hasData).toHaveBeenCalledTimes(1);
  });

  it('reads a rejected probe as no data', async () => {
    const candidates = [listItem({ uid: 'broken', name: 'broken' }), listItem({ uid: 'empty', name: 'empty' })];
    const hasData = (ds: DataSourceInstanceListItem) =>
      ds.uid === 'broken' ? Promise.reject(new Error('probe failed')) : Promise.resolve(false);

    await expect(findDatasourceWithData(candidates, hasData)).resolves.toBeNull();
  });

  it('settles null for an empty candidate list without probing', async () => {
    const hasData = jest.fn();

    await expect(findDatasourceWithData([], hasData)).resolves.toBeNull();
    expect(hasData).not.toHaveBeenCalled();
    expect(healthGetMock).not.toHaveBeenCalled();
  });

  it('never probes an unhealthy candidate', async () => {
    healthGetMock.mockImplementation(async (url: string) => ({ status: url.includes('/sick/') ? 'ERROR' : 'OK' }));
    const sick = listItem({ uid: 'sick', name: 'sick' });
    const healthy = listItem({ uid: 'healthy', name: 'healthy' });
    const hasData = jest.fn(async () => true);

    await expect(findDatasourceWithData([sick, healthy], hasData)).resolves.toBe(healthy);
    expect(hasData).toHaveBeenCalledTimes(1);
    expect(hasData).toHaveBeenCalledWith(healthy, expect.any(AbortSignal));
  });

  it('stops after the first batch that has data', async () => {
    const candidates = Array.from({ length: 7 }, (_, i) => listItem({ uid: `p${i + 1}`, name: `p${i + 1}` }));
    const hasData = jest.fn(async (ds: DataSourceInstanceListItem) => ds.uid === 'p2');

    await expect(findDatasourceWithData(candidates, hasData)).resolves.toBe(candidates[1]);
    expect(hasData.mock.calls.map(([ds]) => ds.uid)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
    expect(healthGetMock).toHaveBeenCalledTimes(5);
  });

  it('continues to the next batch when the first has none', async () => {
    const candidates = Array.from({ length: 7 }, (_, i) => listItem({ uid: `p${i + 1}`, name: `p${i + 1}` }));
    const hasData = jest.fn(async (ds: DataSourceInstanceListItem) => ds.uid === 'p7');

    await expect(findDatasourceWithData(candidates, hasData)).resolves.toBe(candidates[6]);
    expect(hasData).toHaveBeenCalledTimes(7);
  });

  it('scans at most MAX_PROBED_DATASOURCES candidates', async () => {
    const candidates = Array.from({ length: 11 }, (_, i) => listItem({ uid: `p${i + 1}`, name: `p${i + 1}` }));
    const hasData = jest.fn(async (ds: DataSourceInstanceListItem) => ds.uid === 'p11');

    await expect(findDatasourceWithData(candidates, hasData)).resolves.toBeNull();
    expect(hasData.mock.calls.map(([ds]) => ds.uid)).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
      'p5',
      'p6',
      'p7',
      'p8',
      'p9',
      'p10',
    ]);
  });

  it('probes a candidate as soon as its own health answers, not after the slowest one', async () => {
    jest.useFakeTimers();
    try {
      healthGetMock.mockImplementation((url: string) =>
        url.includes('/slow/')
          ? new Promise((resolve) => setTimeout(() => resolve({ status: 'OK' }), 2_000))
          : Promise.resolve({ status: 'OK' })
      );
      const slow = listItem({ uid: 'slow', name: 'slow' });
      const fast = listItem({ uid: 'fast', name: 'fast' });
      const hasData = jest.fn(async () => false);

      const promise = findDatasourceWithData([slow, fast], hasData);
      await jest.advanceTimersByTimeAsync(0);

      expect(hasData).toHaveBeenCalledTimes(1);
      expect(hasData).toHaveBeenCalledWith(fast, expect.any(AbortSignal));

      await jest.advanceTimersByTimeAsync(2_000);

      await expect(promise).resolves.toBeNull();
      expect(hasData).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('settles a capped scan of slow candidates inside the signal budget', async () => {
    jest.useFakeTimers();
    try {
      const candidates = Array.from({ length: MAX_PROBED_DATASOURCES }, (_, i) =>
        listItem({ uid: `p${i + 1}`, name: `p${i + 1}` })
      );
      const last = candidates[candidates.length - 1];
      healthGetMock.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ status: 'OK' }), HEALTH_CHECK_TIMEOUT_MS - 1))
      );
      const hasData = (ds: DataSourceInstanceListItem) =>
        new Promise<boolean>((resolve) => setTimeout(() => resolve(ds === last), PROBE_TIMEOUT_MS - 1));

      const detection = detectSignal(() => findDatasourceWithData(candidates, hasData));
      await jest.advanceTimersByTimeAsync(SIGNAL_BUDGET_MS);

      await expect(detection).resolves.toEqual({ status: 'active', datasource: last });
    } finally {
      jest.useRealTimers();
    }
  });
});
