import { type DataSourceInstanceListItem } from '@grafana/data';
import { type BackendSrv, getBackendSrv } from '@grafana/runtime';
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';

import {
  findDatasourceWithData,
  HEALTH_CHECK_TIMEOUT_MS,
  isDatasourceHealthy,
  listProbeCandidates,
  MAX_PROBED_DATASOURCES,
  PROBE_BATCH_SIZE,
  PROBE_TIMEOUT_MS,
  resetProbeHealth,
  SIGNAL_BUDGET_MS,
  withTimeout,
} from './probeUtils';
import { detectSignal } from './solutionState';

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
    readOnly: false,
    isDefault: ds.isDefault ?? false,
  };
}

describe('withTimeout', () => {
  it('resolves with the promise value when it settles inside the deadline', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 50)).resolves.toBe('ok');
  });

  it('propagates a rejection that happens inside the deadline', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 50)).rejects.toThrow('boom');
  });

  it('rejects once the deadline passes while the promise hangs', async () => {
    const hang = new Promise<never>(() => {});

    await expect(withTimeout(hang, 20)).rejects.toThrow(/timed out/i);
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

    const candidates = await listProbeCandidates('loki', undefined, new Set(['excluded']));

    expect(candidates.map((ds) => ds.uid)).toEqual(['kept']);
  });

  it('returns empty when exclusions empty the list', async () => {
    getDataSourceInstanceListMock.mockResolvedValue([listItem({ uid: 'only', name: 'grafanacloud-usage' })]);

    await expect(listProbeCandidates('prometheus', undefined, new Set(['only']))).resolves.toEqual([]);
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

  it('puts the default datasource first and applies the cap', async () => {
    getDataSourceInstanceListMock.mockResolvedValue([
      ...Array.from({ length: MAX_PROBED_DATASOURCES }, (_, i) => listItem({ name: `ds-${i}` })),
      listItem({ name: 'the-default', isDefault: true }),
    ]);

    const candidates = await listProbeCandidates('loki');

    expect(candidates).toHaveLength(MAX_PROBED_DATASOURCES);
    expect(candidates[0].name).toBe('the-default');
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
    expect(hasData).toHaveBeenCalledWith(healthy);
  });

  it('stops after the first batch that has data', async () => {
    const candidates = Array.from({ length: 7 }, (_, i) => listItem({ uid: `p${i + 1}`, name: `p${i + 1}` }));
    const hasData = jest.fn(async (ds: DataSourceInstanceListItem) => ds.uid === 'p2');

    await expect(findDatasourceWithData(candidates, hasData)).resolves.toBe(candidates[1]);
    expect(hasData.mock.calls.map(([ds]) => ds.uid)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
    expect(healthGetMock).toHaveBeenCalledTimes(PROBE_BATCH_SIZE);
  });

  it('continues to the next batch when the first has none', async () => {
    const candidates = Array.from({ length: 7 }, (_, i) => listItem({ uid: `p${i + 1}`, name: `p${i + 1}` }));
    const hasData = jest.fn(async (ds: DataSourceInstanceListItem) => ds.uid === 'p7');

    await expect(findDatasourceWithData(candidates, hasData)).resolves.toBe(candidates[6]);
    expect(hasData).toHaveBeenCalledTimes(7);
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
