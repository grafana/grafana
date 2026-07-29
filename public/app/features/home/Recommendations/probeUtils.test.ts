import { type DataSourceInstanceListItem } from '@grafana/data';
import { type BackendSrv, getBackendSrv } from '@grafana/runtime';
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';

import {
  filterHealthyDatasources,
  findDatasourceWithData,
  listProbeCandidates,
  MAX_PROBED_DATASOURCES,
  withTimeout,
} from './probeUtils';

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

  it('never re-admits excluded uids through the utility-name fallback', async () => {
    // Every datasource is a cloud utility by name: the name fallback re-admits them, but an
    // excluded uid must stay out even then.
    getDataSourceInstanceListMock.mockResolvedValue([
      listItem({ uid: 'usage', name: 'grafanacloud-usage' }),
      listItem({ uid: 'ml', name: 'grafanacloud-ml-metrics' }),
    ]);

    const candidates = await listProbeCandidates('prometheus', undefined, new Set(['usage']));

    expect(candidates.map((ds) => ds.uid)).toEqual(['ml']);
  });

  it('returns empty when exclusions empty the list', async () => {
    getDataSourceInstanceListMock.mockResolvedValue([listItem({ uid: 'only', name: 'grafanacloud-usage' })]);

    await expect(listProbeCandidates('prometheus', undefined, new Set(['only']))).resolves.toEqual([]);
  });

  it('skips cloud utility datasources unless they are all there is', async () => {
    getDataSourceInstanceListMock.mockResolvedValue([
      listItem({ name: 'grafanacloud-usage' }),
      listItem({ name: 'product' }),
    ]);

    await expect(listProbeCandidates('prometheus')).resolves.toEqual([listItem({ name: 'product' })]);

    getDataSourceInstanceListMock.mockResolvedValue([listItem({ name: 'grafanacloud-usage' })]);

    await expect(listProbeCandidates('prometheus')).resolves.toEqual([listItem({ name: 'grafanacloud-usage' })]);
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

describe('filterHealthyDatasources', () => {
  beforeEach(() => {
    healthGetMock.mockReset();
    jest.mocked(getBackendSrv).mockReturnValue({ get: healthGetMock } as unknown as BackendSrv);
  });

  it('keeps candidates whose health check reports OK', async () => {
    healthGetMock.mockResolvedValue({ status: 'OK' });

    const kept = await filterHealthyDatasources([listItem({ uid: 'healthy', name: 'healthy' })]);

    expect(kept.map((ds) => ds.uid)).toEqual(['healthy']);
    expect(healthGetMock).toHaveBeenCalledWith('/api/datasources/uid/healthy/health', undefined, undefined, {
      showErrorAlert: false,
    });
  });

  it('drops a candidate whose health check reports a non-OK status', async () => {
    healthGetMock.mockImplementation(async (url: string) => ({ status: url.includes('sick') ? 'ERROR' : 'OK' }));

    const kept = await filterHealthyDatasources([
      listItem({ uid: 'sick', name: 'sick' }),
      listItem({ uid: 'healthy', name: 'healthy' }),
    ]);

    expect(kept.map((ds) => ds.uid)).toEqual(['healthy']);
  });

  it('drops a candidate whose health check rejects', async () => {
    healthGetMock.mockImplementation((url: string) =>
      url.includes('broken') ? Promise.reject(new Error('connection refused')) : Promise.resolve({ status: 'OK' })
    );

    const kept = await filterHealthyDatasources([
      listItem({ uid: 'broken', name: 'broken' }),
      listItem({ uid: 'healthy', name: 'healthy' }),
    ]);

    expect(kept.map((ds) => ds.uid)).toEqual(['healthy']);
  });

  it('drops a candidate whose health check hangs past the 3s cutoff', async () => {
    jest.useFakeTimers();
    try {
      healthGetMock.mockImplementation((url: string) =>
        url.includes('hung') ? new Promise(() => {}) : Promise.resolve({ status: 'OK' })
      );

      const promise = filterHealthyDatasources([
        listItem({ uid: 'hung', name: 'hung' }),
        listItem({ uid: 'healthy', name: 'healthy' }),
      ]);
      await jest.advanceTimersByTimeAsync(3_500);

      expect((await promise).map((ds) => ds.uid)).toEqual(['healthy']);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('findDatasourceWithData', () => {
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
  });
});
