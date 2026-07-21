import { NEVER, of } from 'rxjs';

import {
  createDataFrame,
  type DataFrame,
  type DataSourceInstanceListItem,
  FieldType,
  LoadingState,
  type PanelData,
  type QueryRunner,
} from '@grafana/data';
import { createQueryRunner } from '@grafana/runtime';
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';

import {
  fetchSpanRateSeries,
  fetchTopErrorService,
  fetchTracesServices,
  resetTracesResolution,
  resolveTracesDatasource,
} from './tracesData';

const mockGet = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({ get: mockGet }),
  createQueryRunner: jest.fn(),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceList: jest.fn(),
}));

const mockCreateQueryRunner = jest.mocked(createQueryRunner);
const mockGetDataSourceInstanceList = jest.mocked(getDataSourceInstanceList);

const run = jest.fn();
const destroy = jest.fn();

function createTempoListItem(ds: { uid: string; name?: string; isDefault?: boolean }): DataSourceInstanceListItem {
  return {
    uid: ds.uid,
    name: ds.name ?? ds.uid,
    type: 'tempo',
    meta: { id: 'tempo' } as DataSourceInstanceListItem['meta'],
    readOnly: false,
    isDefault: ds.isDefault ?? false,
  };
}

function setDataSources(list: Array<{ uid: string; name?: string; isDefault?: boolean }>) {
  mockGetDataSourceInstanceList.mockResolvedValue(list.map(createTempoListItem));
}

// uid -> tag values the datasource reports; absent uid = no trace data there.
let servicesByUid: Record<string, string[]>;
// refId -> frames the runner answers with.
let framesByRefId: Record<string, DataFrame[]>;
// refIds whose queries emit LoadingState.Error.
let queryErrorRefIds: Set<string>;
// refIds whose queries never emit a terminal state.
let queryHangRefIds: Set<string>;

// Mimics Tempo's TraceQL-metrics frames: refId is overwritten with the series name (never the
// query refId) and label values arrive quoted.
function rateFrame(seriesName: string, labels: Record<string, string>, values: number[]): DataFrame {
  return createDataFrame({
    refId: seriesName,
    fields: [
      { name: 'Time', type: FieldType.time, values: values.map((_, i) => (i + 1) * 1_000) },
      { name: 'Value', type: FieldType.number, values, labels },
    ],
  });
}

// Tempo appends an unlabeled exemplar companion frame (time/number/string fields) to metrics responses.
function exemplarFrame(values: number[]): DataFrame {
  return createDataFrame({
    refId: 'unset',
    fields: [
      { name: 'Time', type: FieldType.time, values: values.map((_, i) => (i + 1) * 1_000) },
      { name: 'Value', type: FieldType.number, values },
      { name: 'traceId', type: FieldType.string, values: values.map(() => 'abc123') },
    ],
  });
}

type CapturedRun = {
  datasource: { uid: string };
  queries: Array<{ refId: string; queryType?: string; query?: string }>;
};

beforeEach(() => {
  mockGet.mockReset();
  run.mockReset();
  destroy.mockReset();
  mockCreateQueryRunner.mockReset();
  mockGetDataSourceInstanceList.mockReset();
  resetTracesResolution();
  servicesByUid = {};
  framesByRefId = {};
  queryErrorRefIds = new Set();
  queryHangRefIds = new Set();
  mockGet.mockImplementation((url: string) => {
    const proxy = url.match(
      /^\/api\/datasources\/proxy\/uid\/([^/]+)\/api\/v2\/search\/tag\/resource\.service\.name\/values$/
    );
    if (proxy) {
      const services = servicesByUid[proxy[1]] ?? [];
      return Promise.resolve({ tagValues: services.map((value) => ({ type: 'string', value })) });
    }
    return Promise.reject(new Error(`unexpected url ${url}`));
  });
  mockCreateQueryRunner.mockImplementation(() => {
    let captured: CapturedRun | undefined;
    const runner = {
      run: (opts: CapturedRun) => {
        captured = opts;
        run(opts);
      },
      get: () => {
        const refId = captured?.queries[0]?.refId ?? '';
        if (queryHangRefIds.has(refId)) {
          return NEVER;
        }
        if (queryErrorRefIds.has(refId)) {
          return of({ state: LoadingState.Error, series: [] as DataFrame[], timeRange: {} } as PanelData);
        }
        return of({
          state: LoadingState.Done,
          series: framesByRefId[refId] ?? [],
          timeRange: {},
        } as PanelData);
      },
      cancel: jest.fn(),
      destroy,
    };
    return runner as unknown as QueryRunner;
  });
});

afterEach(() => jest.restoreAllMocks());

type RunCall = [CapturedRun];
const runCalls = (refId: string) => (run.mock.calls as RunCall[]).filter(([o]) => o.queries[0].refId === refId);

describe('Traces Tempo resolution', () => {
  it('probes the exact no-params v2 tag-values proxy route', async () => {
    setDataSources([{ uid: 'tempo-uid' }]);
    servicesByUid = { 'tempo-uid': ['checkout', 'payments'] };

    const resolution = await resolveTracesDatasource();

    expect(resolution).toEqual({ ds: expect.objectContaining({ uid: 'tempo-uid' }), serviceCount: 2 });
    expect(mockGet).toHaveBeenCalledWith(
      '/api/datasources/proxy/uid/tempo-uid/api/v2/search/tag/resource.service.name/values'
    );
    // Range params force a full-block scan that 502s on large tenants; the probe must not send any.
    expect(mockGet.mock.calls[0]).toHaveLength(1);
  });

  it('probes the default datasource first and stops there when it has services', async () => {
    setDataSources([{ uid: 'other-tempo' }, { uid: 'default-tempo', isDefault: true }]);
    servicesByUid = { 'other-tempo': ['a'], 'default-tempo': ['b'] };

    const resolution = await resolveTracesDatasource();

    expect(resolution?.ds.uid).toBe('default-tempo');
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('falls through past a datasource with empty tagValues', async () => {
    setDataSources([{ uid: 'empty-tempo', isDefault: true }, { uid: 'busy-tempo' }]);
    servicesByUid = { 'busy-tempo': ['svc'] };

    const resolution = await resolveTracesDatasource();

    expect(resolution?.ds.uid).toBe('busy-tempo');
  });

  it('resolves null when every datasource has empty tagValues, and fetchers reject', async () => {
    setDataSources([{ uid: 'empty-tempo' }]);

    expect(await resolveTracesDatasource()).toBeNull();
    await expect(fetchTracesServices()).rejects.toThrow('No Tempo datasource with trace data');
  });

  it('returns the service count captured by the resolution probe without re-fetching', async () => {
    setDataSources([{ uid: 'tempo-uid' }]);
    servicesByUid = { 'tempo-uid': ['a', 'b', 'c'] };

    expect(await fetchTracesServices()).toBe(3);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});

describe('fetchSpanRateSeries', () => {
  beforeEach(() => {
    setDataSources([{ uid: 'tempo-uid' }]);
    servicesByUid = { 'tempo-uid': ['svc'] };
  });

  it('sums the status series per timestamp and averages the error series', async () => {
    framesByRefId = {
      spanRate: [
        rateFrame('ok', { status: '"ok"' }, [10, 20]),
        rateFrame('unset', { status: '"unset"' }, [100, 200]),
        rateFrame('error', { status: '"error"' }, [1, 3]),
        exemplarFrame([55, 66]),
      ],
    };

    const result = await fetchSpanRateSeries();

    expect(result.series?.x?.values).toEqual([1_000, 2_000]);
    expect(result.series?.y.values).toEqual([111, 223]);
    expect(result.errorRate).toBe(2);

    const [{ queries, datasource }] = runCalls('spanRate')[0];
    expect(datasource.uid).toBe('tempo-uid');
    expect(queries[0]).toMatchObject({ queryType: 'traceql', query: '{} | rate() by (status)' });
  });

  it('returns a null error rate when no error series comes back', async () => {
    framesByRefId = { spanRate: [rateFrame('ok', { status: 'ok' }, [10, 20])] };

    const result = await fetchSpanRateSeries();

    expect(result.series).not.toBeNull();
    expect(result.errorRate).toBeNull();
  });

  it('degrades to nulls instead of throwing when the query errors', async () => {
    queryErrorRefIds = new Set(['spanRate']);

    jest.useFakeTimers();
    try {
      const resultPromise = fetchSpanRateSeries();
      await jest.advanceTimersByTimeAsync(2_500);

      expect(await resultPromise).toEqual({ series: null, errorRate: null });
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('fetchTopErrorService', () => {
  beforeEach(() => {
    setDataSources([{ uid: 'tempo-uid' }]);
    servicesByUid = { 'tempo-uid': ['svc'] };
  });

  it('picks the service with the highest average error rate', async () => {
    framesByRefId = {
      errors: [
        rateFrame('svc-a', { 'resource.service.name': 'svc-a' }, [2, 2]),
        rateFrame('svc-b', { 'resource.service.name': 'svc-b' }, [4, 6]),
      ],
    };

    const top = await fetchTopErrorService();

    expect(top).toEqual({ service: 'svc-b', rate: 5 });
    expect(runCalls('errors')[0][0].queries[0]).toMatchObject({
      queryType: 'traceql',
      query: '{status=error} | rate() by (resource.service.name)',
    });
  });

  it('unquotes Tempo-quoted service names', async () => {
    framesByRefId = { errors: [rateFrame('"checkout"', { 'resource.service.name': '"checkout"' }, [1, 1])] };

    expect(await fetchTopErrorService()).toEqual({ service: 'checkout', rate: 1 });
  });

  it('returns null on empty results', async () => {
    framesByRefId = { errors: [] };

    expect(await fetchTopErrorService()).toBeNull();
  });

  it('returns null instead of throwing when the query errors', async () => {
    queryErrorRefIds = new Set(['errors']);

    jest.useFakeTimers();
    try {
      const topPromise = fetchTopErrorService();
      await jest.advanceTimersByTimeAsync(2_500);

      expect(await topPromise).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('returns null instead of throwing when no datasource has trace data', async () => {
    setDataSources([]);

    expect(await fetchTopErrorService()).toBeNull();
  });
});
