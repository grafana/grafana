import { getSelectedDataSource } from '../dataSources';

import {
  lokiLogs,
  lokiSeriesRange,
  promRange,
  promSeries,
  pyroscopeSelectSeries,
  tempoMetricsRange,
  tempoTagValues,
} from './labApi';
import { setOverview } from './liveScenario';
import { loadServiceCharts } from './serviceCharts';
import { COLLECTOR_SPAN_METRICS, TEMPO_SPAN_METRICS } from './spanMetrics';
import { emptyOverview } from './testFixtures';

jest.mock('./labApi');
jest.mock('./kgEntities');
jest.mock('../dataSources', () => ({
  ...jest.requireActual('../dataSources'),
  getSelectedDataSource: jest.fn(),
}));

const NOW_S = 1_700_000_000;
const WINDOW_S = 1800;
const NS_PER_MINUTE = 60e9;

// A series with one point a minute, ending a minute before now.
const series = (metric: Record<string, string>, values: number[]) => ({
  metric,
  times: values.map((_, index) => NOW_S - 60 * (values.length - index)),
  values,
});

// The lists the overview hands to the rows, which hold the service by the name each data source uses.
const overviewWith = (names: {
  spanMetrics?: typeof TEMPO_SPAN_METRICS;
  logServiceNames?: string[];
  profiles?: string[];
}) =>
  setOverview({
    ...emptyOverview,
    spanMetrics: names.spanMetrics ?? TEMPO_SPAN_METRICS,
    logServiceNames: names.logServiceNames ?? ['checkout'],
    profileServiceNames: async () => names.profiles ?? ['checkout'],
  });

let dateNow: jest.SpyInstance;

beforeEach(() => {
  // Without this, the calls earlier tests made would count in the assertions on calls.
  jest.clearAllMocks();
  dateNow = jest.spyOn(Date, 'now').mockReturnValue(NOW_S * 1000);
  overviewWith({});
  jest.mocked(getSelectedDataSource).mockResolvedValue('uid');
  jest
    .mocked(tempoMetricsRange)
    .mockResolvedValue([series({ status: 'ok' }, [4, 5]), series({ status: 'error' }, [1, 0])]);
  jest.mocked(promRange).mockResolvedValue([series({}, [800, 900])]);
  jest.mocked(lokiSeriesRange).mockResolvedValue([series({}, [3, 4])]);
  jest.mocked(pyroscopeSelectSeries).mockResolvedValue([series({}, [NS_PER_MINUTE, 2.5 * NS_PER_MINUTE])]);
  jest.mocked(tempoTagValues).mockResolvedValue([]);
  jest.mocked(promSeries).mockResolvedValue([]);
  jest.mocked(lokiLogs).mockResolvedValue([]);
});

afterEach(() => {
  dateNow.mockRestore();
  setOverview(emptyOverview);
});

describe('loadServiceCharts', () => {
  it('reads each panel from its data source, with times in milliseconds', async () => {
    const charts = await loadServiceCharts('checkout');

    expect(charts.traces).toEqual({
      kind: 'data',
      series: [
        { name: 'ok', times: [(NOW_S - 120) * 1000, (NOW_S - 60) * 1000], values: [4, 5] },
        { name: 'error', times: [(NOW_S - 120) * 1000, (NOW_S - 60) * 1000], values: [1, 0] },
      ],
    });
    expect(charts.metrics).toMatchObject({ kind: 'data', series: [{ name: 'p95', values: [800, 900] }] });
    expect(charts.logs).toMatchObject({ kind: 'data', series: [{ name: 'errors', values: [3, 4] }] });
  });

  it('asks for the last 30 minutes at one point a minute, for server and consumer spans', async () => {
    await loadServiceCharts('checkout');

    expect(tempoMetricsRange).toHaveBeenCalledWith(
      '{ resource.service.name="checkout" && (kind = server || kind = consumer) } | count_over_time() by (status)',
      NOW_S - WINDOW_S,
      NOW_S,
      60
    );
    expect(promRange).toHaveBeenCalledTimes(1);
    expect(promRange).toHaveBeenCalledWith(
      'histogram_quantile(0.95, sum by (le) (rate(traces_spanmetrics_latency_bucket{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER",service="checkout"}[5m]))) * 1000',
      NOW_S - WINDOW_S,
      NOW_S,
      60
    );
    expect(lokiSeriesRange).toHaveBeenCalledWith(
      'sum(count_over_time({service_name="checkout"} | detected_level="error" [60s]))',
      NOW_S - WINDOW_S,
      NOW_S,
      60
    );
    expect(pyroscopeSelectSeries).toHaveBeenCalledWith('{service_name="checkout"}', NOW_S - WINDOW_S, NOW_S, 60);
  });

  it('queries the collector names and label when the stack has those', async () => {
    overviewWith({ spanMetrics: COLLECTOR_SPAN_METRICS });

    await loadServiceCharts('checkout');

    expect(promRange).toHaveBeenCalledWith(
      'histogram_quantile(0.95, sum by (le) (rate(traces_span_metrics_duration_milliseconds_bucket{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER",service_name="checkout"}[5m])))',
      NOW_S - WINDOW_S,
      NOW_S,
      60
    );
  });

  it('counts a span with no status with the spans that say they did not fail', async () => {
    jest
      .mocked(tempoMetricsRange)
      .mockResolvedValue([
        series({ status: 'unset' }, [1, 2]),
        series({ status: 'ok' }, [3, 4]),
        series({ status: 'error' }, [1, 0]),
      ]);

    const { traces } = await loadServiceCharts('checkout');

    expect(traces).toMatchObject({
      kind: 'data',
      series: [
        { name: 'ok', values: [4, 6] },
        { name: 'error', values: [1, 0] },
      ],
    });
  });

  it('shows CPU time in cores, from the nanoseconds Pyroscope sums in each minute', async () => {
    const { profiles } = await loadServiceCharts('checkout');

    expect(profiles).toMatchObject({ kind: 'data', series: [{ name: 'cpu', values: [1, 2.5] }] });
  });

  it('narrows every query to the chosen environment, and filters profiles by cluster', async () => {
    await loadServiceCharts('checkout', 'prod');

    expect(tempoMetricsRange).toHaveBeenCalledWith(
      '{ resource.service.name="checkout" && resource.deployment.environment.name="prod" && (kind = server || kind = consumer) } | count_over_time() by (status)',
      NOW_S - WINDOW_S,
      NOW_S,
      60
    );
    for (const [query] of jest.mocked(promRange).mock.calls) {
      expect(query).toContain('service="checkout",deployment_environment_name="prod"');
    }
    expect(lokiSeriesRange).toHaveBeenCalledWith(
      expect.stringContaining('{service_name="checkout",deployment_environment_name="prod"}'),
      NOW_S - WINDOW_S,
      NOW_S,
      60
    );
    expect(pyroscopeSelectSeries).toHaveBeenCalledWith(
      '{service_name="checkout",cluster="prod"}',
      NOW_S - WINDOW_S,
      NOW_S,
      60
    );
  });

  it('escapes a quote in the service name so the name cannot end the matcher', async () => {
    overviewWith({ logServiceNames: ['odd"name'], profiles: ['odd"name'] });

    await loadServiceCharts('odd"name');

    expect(pyroscopeSelectSeries).toHaveBeenCalledWith('{service_name="odd\\"name"}', NOW_S - WINDOW_S, NOW_S, 60);
  });

  it('does not query a data source that is not chosen, and says so', async () => {
    jest
      .mocked(getSelectedDataSource)
      .mockImplementation(async (signal) => (signal === 'profiles' ? undefined : 'uid'));

    const charts = await loadServiceCharts('checkout');

    expect(charts.profiles).toEqual({ kind: 'no-source' });
    expect(pyroscopeSelectSeries).not.toHaveBeenCalled();
    expect(charts.logs.kind).toBe('data');
  });

  it('reports the error of one panel and leaves the others', async () => {
    jest.mocked(lokiSeriesRange).mockRejectedValue(new Error('Loki answered 502'));

    const charts = await loadServiceCharts('checkout');

    expect(charts.logs).toEqual({ kind: 'error', message: 'Loki answered 502' });
    expect(charts.traces.kind).toBe('data');
    expect(charts.metrics.kind).toBe('data');
    expect(charts.profiles.kind).toBe('data');
  });

  it('reports an error when the data source list cannot be read', async () => {
    jest.mocked(getSelectedDataSource).mockRejectedValue(new Error('No data source list'));

    const charts = await loadServiceCharts('checkout');

    expect(charts.traces).toEqual({ kind: 'error', message: 'No data source list' });
  });

  it('reports the error of the Pyroscope list on the Profiles panel alone', async () => {
    setOverview({
      ...emptyOverview,
      spanMetrics: TEMPO_SPAN_METRICS,
      logServiceNames: ['checkout'],
      profileServiceNames: async () => {
        throw new Error('Pyroscope answered 502');
      },
    });

    const charts = await loadServiceCharts('checkout');

    expect(charts.profiles).toEqual({ kind: 'error', message: 'Pyroscope answered 502' });
    expect(charts.logs.kind).toBe('data');
  });
});

describe('the value that stands for the service in logs and profiles', () => {
  it('is the namespace and name value that Tempo lists the namespace for, and the panels say which', async () => {
    overviewWith({ logServiceNames: ['shop/checkout', 'billing'], profiles: ['ebpf/shop/checkout', 'shop/checkout'] });
    jest.mocked(tempoTagValues).mockResolvedValue(['shop']);

    const charts = await loadServiceCharts('checkout');

    expect(lokiSeriesRange).toHaveBeenCalledWith(
      expect.stringContaining('{service_name="shop/checkout"}'),
      NOW_S - WINDOW_S,
      NOW_S,
      60
    );
    expect(pyroscopeSelectSeries).toHaveBeenCalledWith('{service_name="shop/checkout"}', NOW_S - WINDOW_S, NOW_S, 60);
    expect(charts.logs).toMatchObject({ kind: 'data', value: 'shop/checkout' });
    expect(charts.profiles).toMatchObject({ kind: 'data', value: 'shop/checkout' });
    expect(tempoTagValues).toHaveBeenCalledTimes(1);
    expect(tempoTagValues).toHaveBeenCalledWith(
      'resource.k8s.namespace.name',
      NOW_S - WINDOW_S,
      NOW_S,
      '{ resource.service.name="checkout" }'
    );
  });

  it('leaves a data source unqueried when it lists no value for the service, and says so', async () => {
    overviewWith({ logServiceNames: ['billing'], profiles: ['billing'] });

    const charts = await loadServiceCharts('checkout');

    expect(charts.logs).toEqual({ kind: 'empty', reason: { type: 'no-value' } });
    expect(charts.profiles).toEqual({ kind: 'empty', reason: { type: 'no-value' } });
    expect(lokiSeriesRange).not.toHaveBeenCalled();
    expect(pyroscopeSelectSeries).not.toHaveBeenCalled();
  });

  it('tries the Tempo name as it is when Loki listed no values at all', async () => {
    overviewWith({ logServiceNames: [] });

    await loadServiceCharts('checkout');

    expect(lokiSeriesRange).toHaveBeenCalledWith(
      expect.stringContaining('{service_name="checkout"}'),
      NOW_S - WINDOW_S,
      NOW_S,
      60
    );
  });

  it('reports the error of the namespace lookup on the panels that need it', async () => {
    overviewWith({ logServiceNames: ['shop/checkout'], profiles: ['shop/checkout'] });
    jest.mocked(tempoTagValues).mockRejectedValue(new Error('Tempo answered 502'));

    const charts = await loadServiceCharts('checkout');

    expect(charts.logs).toEqual({ kind: 'error', message: 'Tempo answered 502' });
    expect(charts.profiles).toEqual({ kind: 'error', message: 'Tempo answered 502' });
    expect(charts.traces.kind).toBe('data');
  });
});

describe('an empty panel', () => {
  it('names the span kinds the service has when none is a server or consumer span', async () => {
    jest
      .mocked(tempoMetricsRange)
      .mockImplementation(async (query) =>
        query.includes('by (kind)') ? [series({ kind: 'internal' }, [1, 2]), series({ kind: 'client' }, [3, 4])] : []
      );

    const charts = await loadServiceCharts('checkout');

    expect(charts.traces).toEqual({
      kind: 'empty',
      reason: { type: 'no-server-spans', kinds: ['client', 'internal'] },
    });
    expect(tempoMetricsRange).toHaveBeenCalledWith(
      '{ resource.service.name="checkout" } | count_over_time() by (kind)',
      NOW_S - WINDOW_S,
      NOW_S,
      60
    );
  });

  it('says the service has no spans when no span kind has any', async () => {
    jest.mocked(tempoMetricsRange).mockResolvedValue([]);

    const charts = await loadServiceCharts('checkout');

    expect(charts.traces).toEqual({ kind: 'empty', reason: { type: 'no-spans' } });
  });

  it('gives no reason when the kinds include a server span, because the panel then has another cause', async () => {
    jest
      .mocked(tempoMetricsRange)
      .mockImplementation(async (query) =>
        query.includes('by (kind)') ? [series({ kind: 'SPAN_KIND_SERVER' }, [1])] : []
      );

    const charts = await loadServiceCharts('checkout');

    expect(charts.traces).toEqual({ kind: 'empty' });
  });

  it('says where else the service shows up when the span metrics hold no series for it', async () => {
    jest.mocked(promRange).mockResolvedValue([]);
    jest
      .mocked(promSeries)
      .mockImplementation(async (match) => (match.includes('job') ? [{ job: 'shop/checkout' }] : []));

    const charts = await loadServiceCharts('checkout');

    expect(charts.metrics).toEqual({
      kind: 'empty',
      reason: {
        type: 'no-series',
        metric: 'traces_spanmetrics_calls_total',
        label: 'service',
        otherMetrics: false,
        inJob: true,
      },
    });
    expect(promSeries).toHaveBeenCalledTimes(3);
    expect(promSeries).toHaveBeenCalledWith(
      'traces_spanmetrics_calls_total{service="checkout"}',
      NOW_S - WINDOW_S,
      NOW_S,
      1
    );
    expect(promSeries).toHaveBeenCalledWith('{service="checkout"}', NOW_S - WINDOW_S, NOW_S, 1);
    expect(promSeries).toHaveBeenCalledWith('{job=~"(.+/)?checkout"}', NOW_S - WINDOW_S, NOW_S, 1);
  });

  it('escapes the service name in the job pattern as a regular expression inside a quoted string', async () => {
    jest.mocked(promRange).mockResolvedValue([]);

    await loadServiceCharts('a.b');

    expect(promSeries).toHaveBeenCalledWith('{job=~"(.+/)?a\\\\.b"}', NOW_S - WINDOW_S, NOW_S, 1);
  });

  it('says the span metrics hold series for the service but none for the panel, and looks no further', async () => {
    jest.mocked(promRange).mockResolvedValue([]);
    jest.mocked(promSeries).mockResolvedValue([{ service: 'checkout' }]);

    const charts = await loadServiceCharts('checkout');

    expect(charts.metrics).toEqual({ kind: 'empty', reason: { type: 'filtered' } });
    expect(promSeries).toHaveBeenCalledTimes(1);
  });

  it('keeps the empty panel without a reason when a lookup fails', async () => {
    jest.mocked(promRange).mockResolvedValue([]);
    jest.mocked(promSeries).mockRejectedValue(new Error('Prometheus answered 502'));

    const charts = await loadServiceCharts('checkout');

    expect(charts.metrics).toEqual({ kind: 'empty' });
  });

  it('reports a panel whose values are not numbers as empty', async () => {
    jest.mocked(promRange).mockResolvedValue([series({}, [NaN, NaN])]);

    const charts = await loadServiceCharts('checkout');

    expect(charts.metrics.kind).toBe('empty');
  });
});

describe('the error lines of a service', () => {
  beforeEach(() => {
    jest.mocked(lokiSeriesRange).mockResolvedValue([]);
  });

  it('count as zero when the service has lines and none of them has an error level', async () => {
    jest.mocked(lokiLogs).mockResolvedValue([{ timeNs: '1', level: 'info', line: 'started' }]);

    const { logs } = await loadServiceCharts('checkout');

    expect(lokiLogs).toHaveBeenCalledWith('{service_name="checkout"}', NOW_S - WINDOW_S, NOW_S, 1);
    expect(logs).toMatchObject({ kind: 'data', value: 'checkout', series: [{ name: 'errors' }] });
    const [only] = logs.kind === 'data' ? logs.series : [];
    expect(only.values).toHaveLength(31);
    expect(only.values.every((value) => value === 0)).toBe(true);
  });

  it('are not counted when the service has no lines', async () => {
    const { logs } = await loadServiceCharts('checkout');

    expect(logs).toEqual({ kind: 'empty', reason: { type: 'no-lines' }, value: 'checkout' });
  });

  it('are not counted for an environment that has no lines, and the panel says when the service has lines elsewhere', async () => {
    jest
      .mocked(lokiLogs)
      .mockImplementation(async (query) =>
        query.includes('deployment_environment_name') ? [] : [{ timeNs: '1', level: 'info', line: 'started' }]
      );

    const { logs } = await loadServiceCharts('checkout', 'prod');

    expect(logs).toEqual({ kind: 'empty', reason: { type: 'filtered' }, value: 'checkout' });
    expect(lokiLogs).toHaveBeenCalledWith(
      '{service_name="checkout",deployment_environment_name="prod"}',
      NOW_S - WINDOW_S,
      NOW_S,
      1
    );
  });

  it('are left without a reason when the lookup fails', async () => {
    jest.mocked(lokiLogs).mockRejectedValue(new Error('Loki answered 502'));

    const { logs } = await loadServiceCharts('checkout');

    expect(logs).toEqual({ kind: 'empty', value: 'checkout' });
  });
});

describe('the CPU of a service', () => {
  it('tells a service with no profiles from one with none in the chosen environment', async () => {
    jest
      .mocked(pyroscopeSelectSeries)
      .mockImplementation(async (selector) => (selector.includes('cluster') ? [] : [series({}, [NS_PER_MINUTE])]));

    const inEnvironment = await loadServiceCharts('checkout', 'prod');

    expect(inEnvironment.profiles).toEqual({
      kind: 'empty',
      reason: { type: 'outside-environment' },
      value: 'checkout',
    });
    expect(pyroscopeSelectSeries).toHaveBeenCalledWith('{service_name="checkout"}', NOW_S - WINDOW_S, NOW_S, 60);

    jest.mocked(pyroscopeSelectSeries).mockClear();
    jest.mocked(pyroscopeSelectSeries).mockResolvedValue([]);

    const anywhere = await loadServiceCharts('checkout');

    expect(anywhere.profiles).toEqual({ kind: 'empty', value: 'checkout' });
    expect(pyroscopeSelectSeries).toHaveBeenCalledTimes(1);
  });
});
