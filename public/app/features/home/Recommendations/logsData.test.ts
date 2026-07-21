import { type DataSourceInstanceListItem } from '@grafana/data';
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';

import { fetchLogsStats, fetchLogsVolume, resetLogsResolution, resolveLogsDatasource } from './logsData';

const mockGet = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({ get: mockGet }),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceList: jest.fn(),
}));

const mockGetDataSourceInstanceList = jest.mocked(getDataSourceInstanceList);

const NS_IN_MS = 1e6;
const MS_IN_HOUR = 60 * 60 * 1000;

function createLokiListItem(ds: { uid: string; name?: string; isDefault?: boolean }): DataSourceInstanceListItem {
  return {
    uid: ds.uid,
    name: ds.name ?? ds.uid,
    type: 'loki',
    meta: { id: 'loki' } as DataSourceInstanceListItem['meta'],
    readOnly: false,
    isDefault: ds.isDefault ?? false,
  };
}

function setDataSources(list: Array<{ uid: string; name?: string; isDefault?: boolean }>) {
  mockGetDataSourceInstanceList.mockResolvedValue(list.map(createLokiListItem));
}

// uid -> label -> values the datasource reports; absent = empty.
let labelValuesByUid: Record<string, Record<string, string[]>>;
// uid -> index/stats bytes.
let bytesByUid: Record<string, number>;
// uid -> volume_range prom-matrix result.
let volumeByUid: Record<string, Array<{ metric?: Record<string, string>; values?: Array<[number, string]> }>>;
// uids whose volume_range endpoint rejects (e.g. Loki < 3.0).
let volumeErrorUids: Set<string>;

type GetCall = [string, Record<string, unknown> | undefined];
const labelCalls = () => (mockGet.mock.calls as GetCall[]).filter(([url]) => url.includes('/resources/label/'));
const statsCalls = () => (mockGet.mock.calls as GetCall[]).filter(([url]) => url.endsWith('/resources/index/stats'));
const volumeCalls = () =>
  (mockGet.mock.calls as GetCall[]).filter(([url]) => url.endsWith('/resources/index/volume_range'));

beforeEach(() => {
  mockGet.mockReset();
  mockGetDataSourceInstanceList.mockReset();
  resetLogsResolution();
  labelValuesByUid = {};
  bytesByUid = {};
  volumeByUid = {};
  volumeErrorUids = new Set();
  mockGet.mockImplementation((url: string) => {
    const label = url.match(/\/api\/datasources\/uid\/([^/]+)\/resources\/label\/([^/]+)\/values$/);
    if (label) {
      return Promise.resolve({ data: labelValuesByUid[label[1]]?.[label[2]] ?? [] });
    }
    const stats = url.match(/\/api\/datasources\/uid\/([^/]+)\/resources\/index\/stats$/);
    if (stats) {
      return Promise.resolve({ bytes: bytesByUid[stats[1]] ?? 0, chunks: 0, entries: 0, streams: 0 });
    }
    const volume = url.match(/\/api\/datasources\/uid\/([^/]+)\/resources\/index\/volume_range$/);
    if (volume) {
      if (volumeErrorUids.has(volume[1])) {
        return Promise.reject(new Error('unsupported endpoint'));
      }
      return Promise.resolve({ data: { result: volumeByUid[volume[1]] ?? [] } });
    }
    return Promise.reject(new Error(`unexpected url ${url}`));
  });
});

afterEach(() => jest.restoreAllMocks());

describe('Logs Loki resolution', () => {
  it('skips cloud utility Loki datasources when a team datasource exists', async () => {
    setDataSources([
      { uid: 'grafanacloud-alert-state-history' },
      { uid: 'grafanacloud-usage-insights' },
      { uid: 'team-loki' },
    ]);
    labelValuesByUid = {
      'grafanacloud-alert-state-history': { service_name: ['noise'] },
      'grafanacloud-usage-insights': { service_name: ['noise'] },
      'team-loki': { service_name: ['checkout'] },
    };

    const resolution = await resolveLogsDatasource();

    expect(resolution?.ds.uid).toBe('team-loki');
    const probedUids = labelCalls().map(([url]) => url.split('/')[4]);
    expect(probedUids).not.toContain('grafanacloud-alert-state-history');
    expect(probedUids).not.toContain('grafanacloud-usage-insights');
  });

  it('still probes a lone utility datasource when nothing else exists', async () => {
    setDataSources([{ uid: 'grafanacloud-usage-insights' }]);
    labelValuesByUid = { 'grafanacloud-usage-insights': { service_name: ['app'] } };

    const resolution = await resolveLogsDatasource();

    expect(resolution?.ds.uid).toBe('grafanacloud-usage-insights');
  });

  it('probes the default datasource first and stops there when it has data', async () => {
    setDataSources([{ uid: 'other-loki' }, { uid: 'default-loki', isDefault: true }]);
    labelValuesByUid = {
      'other-loki': { service_name: ['a'] },
      'default-loki': { service_name: ['b'] },
    };

    const resolution = await resolveLogsDatasource();

    expect(resolution?.ds.uid).toBe('default-loki');
    expect(labelCalls()).toHaveLength(1);
    expect(labelCalls()[0][0]).toContain('/uid/default-loki/');
  });

  it('falls back to the job label when service_name has no values', async () => {
    setDataSources([{ uid: 'team-loki' }]);
    labelValuesByUid = { 'team-loki': { service_name: [], job: ['promtail/pods'] } };

    const resolution = await resolveLogsDatasource();

    expect(resolution).toEqual({ ds: expect.objectContaining({ uid: 'team-loki' }), sourceLabel: 'job' });
    const probedLabels = labelCalls().map(([url]) => url.split('/resources/label/')[1]);
    expect(probedLabels).toEqual(['service_name/values', 'job/values']);
  });

  it('resolves null when no candidate has label values, and fetchers reject', async () => {
    setDataSources([{ uid: 'empty-loki' }]);

    expect(await resolveLogsDatasource()).toBeNull();
    await expect(fetchLogsStats()).rejects.toThrow('No Loki datasource with log data');
    expect(statsCalls()).toHaveLength(0);
  });

  it('resolves null without probing when there are no Loki datasources', async () => {
    setDataSources([]);

    expect(await resolveLogsDatasource()).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });
});

describe('fetchLogsStats', () => {
  it('queries index/stats and label values over 7d with nanosecond timestamps', async () => {
    const nowMs = 1_752_000_000_000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(nowMs);
    try {
      setDataSources([{ uid: 'team-loki' }]);
      labelValuesByUid = { 'team-loki': { service_name: ['checkout', 'payments', 'cart'] } };
      bytesByUid = { 'team-loki': 47_000_000_000 };

      const stats = await fetchLogsStats();

      expect(stats).toEqual({ bytes7d: 47_000_000_000, sources7d: 3 });
      const [statsUrl, statsParams] = statsCalls()[0];
      expect(statsUrl).toBe('/api/datasources/uid/team-loki/resources/index/stats');
      expect(statsParams).toEqual({
        query: '{service_name=~".+"}',
        start: (nowMs - 7 * 24 * MS_IN_HOUR) * NS_IN_MS,
        end: nowMs * NS_IN_MS,
      });
      // Probe (24h) + stats sources (7d) both hit label values; the last call carries the 7d window.
      const [sourcesUrl, sourcesParams] = labelCalls()[labelCalls().length - 1];
      expect(sourcesUrl).toBe('/api/datasources/uid/team-loki/resources/label/service_name/values');
      expect(sourcesParams).toEqual({
        start: (nowMs - 7 * 24 * MS_IN_HOUR) * NS_IN_MS,
        end: nowMs * NS_IN_MS,
      });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('passes zero bytes through so the builder can hide the stats row', async () => {
    setDataSources([{ uid: 'team-loki' }]);
    labelValuesByUid = { 'team-loki': { service_name: ['idle'] } };
    bytesByUid = {};

    expect(await fetchLogsStats()).toEqual({ bytes7d: 0, sources7d: 1 });
  });
});

describe('fetchLogsVolume', () => {
  beforeEach(() => {
    setDataSources([{ uid: 'team-loki' }]);
    labelValuesByUid = { 'team-loki': { service_name: ['a', 'b'] } };
  });

  it('drops empty-label series and sums the rest per timestamp', async () => {
    volumeByUid = {
      'team-loki': [
        {
          metric: { service_name: 'a' },
          values: [
            [1_000, '10'],
            [2_000, '20'],
          ],
        },
        {
          metric: { service_name: 'b' },
          values: [
            [1_000, '5'],
            [2_000, '5'],
          ],
        },
        { metric: { service_name: '' }, values: [[1_000, '1000']] },
      ],
    };

    const volume = await fetchLogsVolume();

    expect(volume.series?.x?.values).toEqual([1_000_000, 2_000_000]);
    expect(volume.series?.y.values).toEqual([15, 25]);
    expect(volume.series?.y.state?.range).toBeDefined();
    expect(volume.spike).toBeNull();

    const [, volumeParams] = volumeCalls()[0];
    expect(volumeParams).toMatchObject({
      query: '{service_name=~".+"}',
      step: '1h',
      aggregateBy: 'labels',
      targetLabels: 'service_name',
    });
  });

  it('fires the max-ratio source when the last bucket clears both thresholds', async () => {
    const mb = 10_000_000;
    volumeByUid = {
      'team-loki': [
        {
          metric: { service_name: 'checkout-service' },
          values: [
            [1_000, `${mb}`],
            [2_000, `${mb}`],
            [3_000, `${mb}`],
            [4_000, `${4 * mb}`],
          ],
        },
        {
          metric: { service_name: 'steady-service' },
          values: [
            [1_000, `${mb}`],
            [2_000, `${mb}`],
            [3_000, `${mb}`],
            [4_000, `${3 * mb}`],
          ],
        },
      ],
    };

    const volume = await fetchLogsVolume();

    expect(volume.spike).toEqual({ source: 'checkout-service', ratio: 4 });
  });

  it('does not fire below the absolute byte floor even at a spiky ratio', async () => {
    volumeByUid = {
      'team-loki': [
        {
          metric: { service_name: 'tiny-service' },
          values: [
            [1_000, '10'],
            [2_000, '10'],
            [3_000, '40'],
          ],
        },
      ],
    };

    const volume = await fetchLogsVolume();

    expect(volume.spike).toBeNull();
  });

  it('degrades to nulls when volume_range is unsupported', async () => {
    volumeErrorUids = new Set(['team-loki']);

    jest.useFakeTimers();
    try {
      const volumePromise = fetchLogsVolume();
      await jest.advanceTimersByTimeAsync(2_500);

      expect(await volumePromise).toEqual({ series: null, spike: null });
    } finally {
      jest.useRealTimers();
    }
  });
});
