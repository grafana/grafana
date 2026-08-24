import { of } from 'rxjs';

import {
  createDataFrame,
  type DataFrame,
  type DataSourceInstanceListItem,
  FieldType,
  LoadingState,
  type PanelData,
  type QueryRunner,
} from '@grafana/data';
import { type BackendSrv, createQueryRunner, getBackendSrv } from '@grafana/runtime';
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';

import { resetProbeCandidates } from './probeUtils';
import {
  fetchSyntheticsHealth,
  fetchSyntheticsStats,
  fetchSyntheticsSuccessSeries,
  probeSyntheticChecks,
} from './syntheticsData';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  createQueryRunner: jest.fn(),
  getBackendSrv: jest.fn(),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceList: jest.fn(),
}));

const mockCreateQueryRunner = jest.mocked(createQueryRunner);
const mockGetDataSourceInstanceList = jest.mocked(getDataSourceInstanceList);

const run = jest.fn();
const healthGet = jest.fn();

const SM_CHECK_PROBE = 'count(count by (job, instance) (last_over_time(sm_check_info[24h])))';
const SM_SUCCESS_RATIO_1H =
  'sum by (job, instance) (rate(probe_all_success_sum[1h])) / sum by (job, instance) (rate(probe_all_success_count[1h]))';

function createPrometheusListItem(ds: { uid: string; name: string; isDefault?: boolean }): DataSourceInstanceListItem {
  return {
    uid: ds.uid,
    name: ds.name,
    type: 'prometheus',
    meta: { id: 'prometheus' } as DataSourceInstanceListItem['meta'],
    readOnly: false,
    isDefault: ds.isDefault ?? false,
  };
}

function setDataSources(list: Array<{ uid: string; name: string; isDefault?: boolean }>) {
  mockGetDataSourceInstanceList.mockResolvedValue(list.map(createPrometheusListItem));
}

// uid -> check count the datasource's sm_check_info probe reports; absent uid = no Synthetics data.
let dataByUid: Record<string, number>;
// Probe queries against these uids emit LoadingState.Error (unreachable/erroring datasource).
let probeErrorUids: Set<string>;
// refId -> frames returned for detail batches; absent refId = empty instant vector.
let framesByRefId: Record<string, DataFrame>;

type CapturedRun = { datasource: { uid: string }; queries: Array<{ refId: string; expr: string }> };

function numberFrame(refId: string, values: number[], labels?: Record<string, string>): DataFrame {
  return createDataFrame({ refId, fields: [{ name: 'Value', type: FieldType.number, values, labels }] });
}

beforeEach(() => {
  run.mockReset();
  mockCreateQueryRunner.mockReset();
  mockGetDataSourceInstanceList.mockReset();
  healthGet.mockReset();
  // Health pre-filter: every candidate healthy unless a test overrides by uid.
  healthGet.mockResolvedValue({ status: 'OK' });
  jest.mocked(getBackendSrv).mockReturnValue({ get: healthGet } as unknown as BackendSrv);
  resetProbeCandidates();
  dataByUid = {};
  probeErrorUids = new Set();
  framesByRefId = {};
  mockCreateQueryRunner.mockImplementation(() => {
    // Per-runner capture: parallel probes each get their own runner, so a shared variable would race.
    let captured: CapturedRun | undefined;
    const runner = {
      run: (opts: CapturedRun) => {
        captured = opts;
        run(opts);
      },
      get: () => {
        const uid = captured?.datasource.uid ?? '';
        // The probe is the only single-query 'checks' batch; the stats batch carries a sibling refId.
        const isProbe = captured?.queries.length === 1 && captured.queries[0].refId === 'checks';
        if (isProbe) {
          if (probeErrorUids.has(uid)) {
            return of({ state: LoadingState.Error, series: [] as DataFrame[], timeRange: {} } as PanelData);
          }
          const count = dataByUid[uid] ?? 0;
          const series = count > 0 ? [numberFrame('checks', [count])] : [];
          return of({ state: LoadingState.Done, series, timeRange: {} } as PanelData);
        }
        const series = (captured?.queries ?? []).flatMap((q) =>
          framesByRefId[q.refId] ? [framesByRefId[q.refId]] : []
        );
        return of({ state: LoadingState.Done, series, timeRange: {} } as PanelData);
      },
      cancel: jest.fn(),
      destroy: jest.fn(),
    };
    return runner as unknown as QueryRunner;
  });
});

afterEach(() => jest.restoreAllMocks());

type RunCall = [CapturedRun];
const probeCalls = () =>
  (run.mock.calls as RunCall[]).filter(([o]) => o.queries.length === 1 && o.queries[0].refId === 'checks');
const statsCalls = () =>
  (run.mock.calls as RunCall[]).filter(([o]) => o.queries.some((q) => q.refId === 'successRatio'));
const healthCalls = () => (run.mock.calls as RunCall[]).filter(([o]) => o.queries.some((q) => q.refId === 'failing'));
const seriesCalls = () => (run.mock.calls as RunCall[]).filter(([o]) => o.queries[0].refId === 'success');

const datasource = { uid: 'sm-uid', type: 'prometheus' };

describe('Synthetics datasource resolution', () => {
  it('resolves the first candidate whose sm_check_info probe reports checks', async () => {
    setDataSources([
      { uid: 'default-uid', name: 'default-prom', isDefault: true },
      { uid: 'sm-uid', name: 'sm-prom' },
    ]);
    dataByUid = { 'sm-uid': 3 };

    await expect(probeSyntheticChecks()).resolves.toMatchObject({ uid: 'sm-uid' });
    expect(probeCalls()[0][0].queries[0].expr).toBe(SM_CHECK_PROBE);
  });

  it('resolves null when no candidate reports checks', async () => {
    setDataSources([{ uid: 'default-uid', name: 'default-prom', isDefault: true }]);

    await expect(probeSyntheticChecks()).resolves.toBeNull();
  });

  it('never probes cloud utility datasources, even when only they hold data', async () => {
    setDataSources([
      { uid: 'grafanacloud-usage', name: 'grafanacloud-usage' },
      { uid: 'grafanacloud-ml-metrics', name: 'grafanacloud-ml-metrics' },
      { uid: 'team-uid', name: 'team-prom' },
    ]);
    dataByUid = { 'grafanacloud-usage': 5, 'grafanacloud-ml-metrics': 4 };

    await expect(probeSyntheticChecks()).resolves.toBeNull();
    expect(probeCalls().map(([o]) => o.datasource.uid)).toEqual(['team-uid']);
  });

  it('reads a probe error as no data there', async () => {
    setDataSources([
      { uid: 'broken-uid', name: 'broken-prom', isDefault: true },
      { uid: 'sm-uid', name: 'sm-prom' },
    ]);
    probeErrorUids = new Set(['broken-uid']);
    dataByUid = { 'sm-uid': 1 };

    await expect(probeSyntheticChecks()).resolves.toMatchObject({ uid: 'sm-uid' });
  });
});

describe('fetchSyntheticsStats', () => {
  it('issues the stats batch with the expected PromQL and reads its scalars', async () => {
    framesByRefId = {
      checks: numberFrame('checks', [12]),
      successRatio: numberFrame('successRatio', [0.985]),
    };

    await expect(fetchSyntheticsStats(datasource)).resolves.toEqual({ checks: 12, successRatio: 0.985 });

    const [stats] = statsCalls();
    expect(Object.fromEntries(stats[0].queries.map((q) => [q.refId, q.expr]))).toEqual({
      checks: SM_CHECK_PROBE,
      successRatio: 'sum(rate(probe_all_success_sum[24h])) / sum(rate(probe_all_success_count[24h]))',
    });
  });

  it('reads empty instant vectors as nulls', async () => {
    await expect(fetchSyntheticsStats(datasource)).resolves.toEqual({ checks: null, successRatio: null });
  });
});

describe('fetchSyntheticsHealth', () => {
  it('issues the health batch with the expected PromQL and reads the worst check off its labels', async () => {
    framesByRefId = {
      failing: numberFrame('failing', [2]),
      worst: numberFrame('worst', [0.42], { job: 'checkout-flow', instance: 'https://shop.example' }),
    };

    await expect(fetchSyntheticsHealth(datasource)).resolves.toEqual({
      failing: 2,
      worstCheck: 'checkout-flow',
      worstRatio: 0.42,
    });

    const [health] = healthCalls();
    expect(Object.fromEntries(health[0].queries.map((q) => [q.refId, q.expr]))).toEqual({
      failing: `count((${SM_SUCCESS_RATIO_1H}) < 0.9)`,
      worst: `bottomk(1, (${SM_SUCCESS_RATIO_1H}) < 0.9)`,
    });
  });

  it('reads empty health vectors as nulls', async () => {
    await expect(fetchSyntheticsHealth(datasource)).resolves.toEqual({
      failing: null,
      worstCheck: null,
      worstRatio: null,
    });
  });

  it('keeps the failing count when the worst check carries no job label', async () => {
    framesByRefId = {
      failing: numberFrame('failing', [1]),
      worst: numberFrame('worst', [0.5]),
    };

    await expect(fetchSyntheticsHealth(datasource)).resolves.toEqual({
      failing: 1,
      worstCheck: null,
      worstRatio: 0.5,
    });
  });

  it('falls back to the instance label when the worst check has no job label', async () => {
    framesByRefId = {
      failing: numberFrame('failing', [1]),
      worst: numberFrame('worst', [0.5], { instance: 'https://shop.example' }),
    };

    await expect(fetchSyntheticsHealth(datasource)).resolves.toMatchObject({
      worstCheck: 'https://shop.example',
      worstRatio: 0.5,
    });
  });
});

describe('fetchSyntheticsSuccessSeries', () => {
  it('issues the fixed-window success-rate range query', async () => {
    framesByRefId = {
      success: createDataFrame({
        refId: 'success',
        fields: [
          { name: 'Time', type: FieldType.time, values: [1, 2] },
          { name: 'Value', type: FieldType.number, values: [0.9, 1] },
        ],
      }),
    };

    const series = await fetchSyntheticsSuccessSeries(datasource);

    expect(series).not.toBeNull();
    expect(seriesCalls()[0][0].queries[0].expr).toBe(
      'sum(rate(probe_all_success_sum[1h])) / sum(rate(probe_all_success_count[1h]))'
    );
  });

  it('returns null when the probe metrics are absent', async () => {
    await expect(fetchSyntheticsSuccessSeries(datasource)).resolves.toBeNull();
  });
});
