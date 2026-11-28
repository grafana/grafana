import { locationService } from '@grafana/runtime';

import { searchEntities } from './kgEntities';
import {
  type InstantSample,
  lokiCount,
  lokiCountRange,
  lokiLabelValues,
  lokiLabelVolumes,
  lokiLogs,
  lokiInstant,
  promInstant,
  promLabelValues,
  promRange,
  pyroscopeLabelValues,
  tempoSearch,
  tempoTagValues,
  tempoTrace,
} from './labApi';
import { type Scope } from './liveScenario';
import { loadOverview, loadScope } from './loadScenario';

jest.mock('./labApi');
jest.mock('./kgEntities');

const SCOPE: Scope = { type: 'service', value: 'checkout' };
const FROM_SEC = 1_700_000_000;
const TO_SEC = FROM_SEC + 1800;

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(TO_SEC * 1000);
  // No data source answers anything, so a test sees only what the data sources chosen in the URL change.
  jest.mocked(promInstant).mockResolvedValue([]);
  jest.mocked(promLabelValues).mockResolvedValue([]);
  jest.mocked(promRange).mockResolvedValue([]);
  jest.mocked(lokiCount).mockResolvedValue(0);
  jest.mocked(lokiCountRange).mockResolvedValue([]);
  jest.mocked(lokiLogs).mockResolvedValue([]);
  jest.mocked(lokiLabelValues).mockResolvedValue([]);
  jest.mocked(lokiLabelVolumes).mockReset().mockResolvedValue([]);
  jest.mocked(lokiInstant).mockResolvedValue([]);
  jest.mocked(tempoSearch).mockResolvedValue([]);
  jest.mocked(tempoTagValues).mockResolvedValue([]);
  jest.mocked(tempoTrace).mockResolvedValue([]);
  jest.mocked(searchEntities).mockResolvedValue({ entities: [], complete: true });
  locationService.replace('/drilldown');
});

afterEach(() => jest.restoreAllMocks());

describe('top log labels', () => {
  it('ranks the ten largest public labels by volume, excluding unusable values', async () => {
    locationService.push('/drilldown?var-ds-logs=logs-1');
    jest
      .mocked(lokiLabelVolumes)
      .mockResolvedValue([
        ...Array.from({ length: 12 }, (_, i) => ({ metric: { [`label_${i}`]: '' }, value: i + 1 })),
        { metric: { __stream_shard__: '' }, value: 100 },
        { metric: { invalid: '' }, value: NaN },
        { metric: { empty: '' }, value: 0 },
      ]);

    const { topLogLabels } = await loadOverview();

    expect(lokiLabelVolumes).toHaveBeenCalledWith(1700000000, 1700001800);
    expect(topLogLabels).toEqual([
      { label: 'label_11', bytes: 12 },
      { label: 'label_10', bytes: 11 },
      { label: 'label_9', bytes: 10 },
      { label: 'label_8', bytes: 9 },
      { label: 'label_7', bytes: 8 },
      { label: 'label_6', bytes: 7 },
      { label: 'label_5', bytes: 6 },
      { label: 'label_4', bytes: 5 },
      { label: 'label_3', bytes: 4 },
      { label: 'label_2', bytes: 3 },
    ]);
  });

  it('keeps measured log service coverage when the volume API is disabled', async () => {
    locationService.push('/drilldown?var-ds-logs=logs-1');
    jest.mocked(lokiLabelValues).mockResolvedValue(['checkout']);
    jest.mocked(lokiLabelVolumes).mockRejectedValue(new Error('Volume queries are disabled'));

    const { topLogLabels, signals, scopeValues, notes } = await loadOverview();

    expect(topLogLabels).toEqual([]);
    // Tempo names the services, so a service only Loki holds stays out of the list.
    expect(scopeValues.service).toEqual([]);
    expect(signals.find((signal) => signal.app === 'logs')).toMatchObject({
      covered: 1,
      total: 1,
      notMeasured: false,
    });
    expect(notes).toContainEqual({ source: 'logs', message: 'Volume queries are disabled' });
  });

  it('skips label volumes when no logs data source is selected', async () => {
    const { topLogLabels } = await loadOverview();

    expect(topLogLabels).toEqual([]);
    expect(lokiLabelVolumes).not.toHaveBeenCalled();
  });
});

describe('log queries that are slow to answer', () => {
  beforeEach(() => {
    locationService.push('/drilldown?var-ds-logs=logs-1');
    // The clock keeps the time the tests above set, so a query has the same time range.
    jest.useFakeTimers({ doNotFake: ['Date'] });
  });

  afterEach(() => jest.useRealTimers());

  it('waits 10 seconds for the error log count, then goes on without it and names it in the notes', async () => {
    jest.mocked(lokiInstant).mockReturnValue(new Promise<never>(() => {}));
    let settled = false;
    const loading = loadOverview().then((overview) => {
      settled = true;
      return overview;
    });

    await jest.advanceTimersByTimeAsync(9_999);
    expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    const { notes } = await loading;

    expect(notes.filter((note) => note.source === 'logs')).toEqual([
      { source: 'logs', message: 'The error log count did not answer within 10 seconds' },
    ]);
  });

  it('goes on without the log label volumes after 10 seconds and names them in the notes', async () => {
    jest.mocked(lokiLabelVolumes).mockReturnValue(new Promise<never>(() => {}));
    const loading = loadOverview();

    await jest.advanceTimersByTimeAsync(10_000);
    const { notes, topLogLabels } = await loading;

    expect(topLogLabels).toEqual([]);
    expect(notes.filter((note) => note.source === 'logs')).toEqual([
      { source: 'logs', message: 'The log label volumes did not answer within 10 seconds' },
    ]);
  });

  it('keeps an answer that arrives inside the limit', async () => {
    jest.mocked(lokiLabelVolumes).mockImplementation(
      () =>
        new Promise<InstantSample[]>((resolve) => {
          setTimeout(() => resolve([{ metric: { service_name: '' }, value: 5 }]), 9_000);
        })
    );
    const loading = loadOverview();

    await jest.advanceTimersByTimeAsync(9_000);
    const { notes, topLogLabels } = await loading;

    expect(topLogLabels).toEqual([{ label: 'service_name', bytes: 5 }]);
    expect(notes.filter((note) => note.source === 'logs')).toEqual([]);
  });
});

describe('findings from selected telemetry', () => {
  it('returns findings beyond the first page while keeping extra log sparkline queries bounded', async () => {
    locationService.push('/drilldown?var-ds-logs=logs-1');
    jest.mocked(lokiInstant).mockResolvedValue(
      ['checkout', 'payments', 'catalog', 'gateway', 'shipping', 'inventory'].map((service_name) => ({
        metric: { service_name },
        value: 12,
      }))
    );

    const { hints } = await loadOverview();

    expect(hints.map((hint) => hint.scope.value)).toEqual([
      'checkout',
      'payments',
      'catalog',
      'gateway',
      'shipping',
      'inventory',
    ]);
    expect(lokiCountRange).toHaveBeenCalledTimes(4);
  });

  it('shows log errors even when the selected metrics source fails', async () => {
    locationService.push('/drilldown?var-ds-metrics=metrics-1&var-ds-logs=logs-1');
    jest.mocked(promInstant).mockRejectedValue(new Error('Metrics unavailable'));
    jest.mocked(promRange).mockRejectedValue(new Error('Metrics unavailable'));
    jest.mocked(lokiInstant).mockResolvedValue([
      {
        metric: { service_name: 'checkout', deployment_environment_name: 'prod', service_namespace: 'shop' },
        value: 12,
      },
    ]);

    const { hints, notes } = await loadOverview();

    expect(hints).toEqual([
      expect.objectContaining({
        severity: 'errors',
        scope: { type: 'service', value: 'checkout', env: 'prod', namespace: 'shop' },
        evidence: [expect.objectContaining({ signal: 'logs', datasourceUid: 'logs-1', summary: '12 error logs' })],
        trend: [],
      }),
    ]);
    expect(notes).toContainEqual({ source: 'metrics', message: 'Metrics unavailable' });
    expect(lokiCountRange).toHaveBeenCalledWith(
      'sum(count_over_time({service_name="checkout"} | deployment_environment_name="prod" | service_namespace="shop" | detected_level=~"(?i)error|err|fatal|critical"[90s]))',
      expect.any(Number),
      expect.any(Number),
      90
    );
  });

  it('keeps services with the same name in different environments separate', async () => {
    locationService.push('/drilldown?var-ds-logs=logs-1');
    jest.mocked(lokiInstant).mockResolvedValue([
      { metric: { service_name: 'checkout', deployment_environment_name: 'prod' }, value: 12 },
      { metric: { service_name: 'checkout', deployment_environment_name: 'staging' }, value: 3 },
    ]);

    const { hints } = await loadOverview();

    expect(hints.map((hint) => hint.scope)).toEqual([
      { type: 'service', value: 'checkout', env: 'prod', namespace: undefined },
      { type: 'service', value: 'checkout', env: 'staging', namespace: undefined },
    ]);
  });

  it('attributes trace errors to the failing service rather than the trace root', async () => {
    locationService.push('/drilldown?var-ds-traces=traces-1');
    jest.mocked(tempoSearch).mockResolvedValue([{ traceID: 'trace-1', rootServiceName: 'gateway' }]);
    jest.mocked(tempoTrace).mockResolvedValue([
      {
        resource: { attributes: [{ key: 'service.name', value: { stringValue: 'payments' } }] },
        scopeSpans: [
          {
            spans: [
              {
                spanId: 'span-1',
                name: 'charge',
                startTimeUnixNano: '1700000010000000000',
                endTimeUnixNano: '1700000011000000000',
                status: { code: 2 },
              },
            ],
          },
        ],
      },
      {
        resource: { attributes: [{ key: 'service.name', value: { stringValue: 'gateway' } }] },
        scopeSpans: [
          {
            spans: [
              { spanId: 'span-2', name: 'request', startTimeUnixNano: '1', endTimeUnixNano: '2', status: { code: 1 } },
            ],
          },
        ],
      },
    ]);

    const { hints } = await loadOverview();

    expect(hints).toEqual([
      expect.objectContaining({
        scope: expect.objectContaining({ value: 'payments' }),
        evidence: [expect.objectContaining({ signal: 'traces', datasourceUid: 'traces-1', traceIds: ['trace-1'] })],
      }),
    ]);
  });

  it('combines supporting evidence across selected signals for the same service', async () => {
    locationService.push('/drilldown?var-ds-metrics=metrics-1&var-ds-logs=logs-1&var-ds-traces=traces-1');
    jest
      .mocked(promInstant)
      .mockImplementation(async (query) =>
        query.includes('STATUS_CODE_ERROR') ? [{ metric: { service_name: 'checkout' }, value: 0.05 }] : []
      );
    jest.mocked(lokiInstant).mockResolvedValue([{ metric: { service_name: 'checkout' }, value: 12 }]);
    jest.mocked(tempoSearch).mockResolvedValue([{ traceID: 'trace-1', rootServiceName: 'checkout' }]);
    jest.mocked(tempoTrace).mockResolvedValue([
      {
        resource: { attributes: [{ key: 'service.name', value: { stringValue: 'checkout' } }] },
        scopeSpans: [
          {
            spans: [
              {
                spanId: 'span-1',
                name: 'request',
                startTimeUnixNano: '1700000010000000000',
                endTimeUnixNano: '1700000011000000000',
                status: { code: 'STATUS_CODE_ERROR' },
              },
            ],
          },
        ],
      },
    ]);

    const { hints } = await loadOverview();

    expect(
      hints.map((hint) => ({ service: hint.scope.value, signals: hint.evidence.map((item) => item.signal) }))
    ).toEqual([{ service: 'checkout', signals: ['metrics', 'logs', 'traces'] }]);
  });

  it('does not attach evidence from an unselected data source', async () => {
    locationService.push('/drilldown?var-ds-metrics=metrics-1');
    jest
      .mocked(promInstant)
      .mockImplementation(async (query) =>
        query.includes('STATUS_CODE_ERROR') ? [{ metric: { service_name: 'checkout' }, value: 0.05 }] : []
      );
    jest.mocked(lokiInstant).mockResolvedValue([{ metric: { service_name: 'checkout' }, value: 12 }]);

    const { hints } = await loadOverview();

    expect(hints.map((hint) => hint.evidence.map((item) => item.signal))).toEqual([['metrics']]);
  });

  it('compares latency only within the same service environment', async () => {
    locationService.push('/drilldown?var-ds-metrics=metrics-1');
    jest.mocked(promInstant).mockImplementation(async (query, time) => {
      if (!query.startsWith('histogram_quantile')) {
        return [];
      }
      return [
        {
          metric: { service_name: 'checkout', deployment_environment_name: 'prod' },
          value: time === TO_SEC ? 300 : 100,
        },
        { metric: { service_name: 'checkout', deployment_environment_name: 'staging' }, value: 500 },
      ];
    });
    const { hints } = await loadOverview();

    expect(hints).toEqual([
      expect.objectContaining({
        severity: 'slow',
        scope: { type: 'service', value: 'checkout', env: 'prod', namespace: undefined },
        evidence: [expect.objectContaining({ signal: 'metrics', summary: 'p95 300ms, up 200% from 100ms' })],
        timeRange: { from: 1_700_000_000_000, to: 1_700_001_800_000 },
        trend: [],
      }),
    ]);
  });

  it('excludes error spans outside the measured window in a matching trace', async () => {
    locationService.push('/drilldown?var-ds-traces=traces-1');
    jest.mocked(tempoSearch).mockResolvedValue([{ traceID: 'trace-1', rootServiceName: 'checkout' }]);
    jest.mocked(tempoTrace).mockResolvedValue([
      {
        resource: { attributes: [{ key: 'service.name', value: { stringValue: 'checkout' } }] },
        scopeSpans: [
          {
            spans: [
              {
                spanId: 'old-span',
                name: 'request',
                startTimeUnixNano: '1699999900000000000',
                endTimeUnixNano: '1699999910000000000',
                status: { code: 2 },
              },
            ],
          },
        ],
      },
    ]);

    const { hints } = await loadOverview();

    expect(hints).toEqual([]);
  });

  it('does not present unrelated knowledge graph insights as telemetry errors', async () => {
    locationService.push('/drilldown?var-ds-logs=logs-1&var-ds-knowledgegraph=kg-1');
    jest.mocked(searchEntities).mockResolvedValue({
      complete: true,
      entities: [{ id: 1, type: 'Service', name: 'checkout', severity: 'warning', insights: ['ReplicaCountLow'] }],
    });

    const { hints } = await loadOverview();

    expect(hints).toEqual([]);
  });
});

describe('the SQL tile in the overview', () => {
  it('has no data source until one is chosen', async () => {
    const { signals } = await loadOverview();

    expect(signals.find((signal) => signal.app === 'sql')).toMatchObject({ noSource: true, notMeasured: false });
  });

  it('is not measured once a SQL data source is chosen, because nothing queries it', async () => {
    locationService.push('/drilldown?var-ds-sql=orders');

    const { signals } = await loadOverview();

    expect(signals.find((signal) => signal.app === 'sql')).toMatchObject({ noSource: false, notMeasured: true });
  });
});

describe('SQL in a scope', () => {
  it('asks to connect a SQL data source until one is chosen', async () => {
    const { insights, detectionSteps } = await loadScope(SCOPE, FROM_SEC, TO_SEC);

    expect(insights.find((insight) => insight.app === 'sql')).toMatchObject({
      value: 'No data source',
      change: 'Connect a SQL data source to see business impact',
    });
    expect(detectionSteps.find((step) => step.app === 'sql')?.finding).toBe('No SQL data source connected');
  });

  it('says a chosen SQL data source is not queried yet', async () => {
    locationService.push('/drilldown?var-ds-sql=orders');

    const { insights, detectionSteps } = await loadScope(SCOPE, FROM_SEC, TO_SEC);

    expect(insights.find((insight) => insight.app === 'sql')).toMatchObject({
      value: 'Not measured',
      change: 'A SQL data source is selected, but nothing queries it yet',
    });
    expect(detectionSteps.find((step) => step.app === 'sql')?.finding).toBe(
      'A SQL data source is selected, but nothing queries it yet'
    );
  });

  it.each([
    {
      name: 'nothing is chosen',
      url: '/drilldown',
      why: 'No profiles or SQL data source is connected, so this group has no data.',
    },
    {
      name: 'only SQL is chosen',
      url: '/drilldown?var-ds-sql=orders',
      why: 'No profiles data source is connected, and nothing queries the selected SQL data source yet, so this group has no data.',
    },
    {
      name: 'only profiles is chosen',
      url: '/drilldown?var-ds-profiles=pyro',
      why: 'No SQL data source is connected, and nothing queries the selected profiles data source yet, so this group has no data.',
    },
    {
      name: 'both are chosen',
      url: '/drilldown?var-ds-profiles=pyro&var-ds-sql=orders',
      why: 'Nothing queries the selected profiles or SQL data source yet, so this group has no data.',
    },
  ])('explains the empty Why group when $name', async ({ url, why }) => {
    locationService.push(url);

    const { evidenceText } = await loadScope(SCOPE, FROM_SEC, TO_SEC);

    expect(evidenceText.why).toBe(why);
  });
});

describe('the services in the overview', () => {
  const NOW_S = 1_700_000_000;
  const WINDOW_S = 1800;
  const row = (name: string, value: number) => ({ metric: { service_name: name }, value });
  const tempoRow = (name: string, value: number) => ({ metric: { service: name }, value });
  let dateNow: jest.SpyInstance;

  // The answers Tempo gives for the service names, with and without an environment filter, and for the environments.
  const tempoReturns = (answers: { services?: string[]; filtered?: string[]; environments?: string[] }) =>
    jest.mocked(tempoTagValues).mockImplementation(async (tag, _start, _end, filter) => {
      if (tag === 'resource.service.name') {
        return (filter ? answers.filtered : answers.services) ?? [];
      }
      return answers.environments ?? [];
    });

  beforeEach(() => {
    // Without this, the calls earlier tests made would count in the assertions on calls.
    jest.clearAllMocks();
    dateNow = jest.spyOn(Date, 'now').mockReturnValue(NOW_S * 1000);
  });

  afterEach(() => {
    dateNow.mockRestore();
  });

  it('lists the service names Tempo returns, once each and A to Z, without the collector or unnamed sources', async () => {
    tempoReturns({ services: ['payment', 'otelcol-contrib', 'checkout', 'unknown_service:java', 'payment'] });

    const { services, scopeValues } = await loadOverview();

    expect(services).toEqual(['checkout', 'payment']);
    expect(scopeValues.service).toEqual(['checkout', 'payment']);
  });

  it('puts failing services first, then slow ones, then the rest A to Z', async () => {
    tempoReturns({ services: ['alpha', 'beta', 'delta', 'gamma', 'zeta'] });
    jest.mocked(promInstant).mockImplementation(async (query, time) => {
      if (query.startsWith('histogram_quantile')) {
        return time === NOW_S
          ? [row('beta', 400), row('gamma', 110), row('alpha', 50)]
          : [row('beta', 100), row('gamma', 100), row('alpha', 50)];
      }
      if (query.startsWith('sum by (service_name) (rate(')) {
        return [row('zeta', 0.2), row('delta', 0.05)];
      }
      return [];
    });

    const { services } = await loadOverview();

    expect(services).toEqual(['zeta', 'delta', 'beta', 'alpha', 'gamma']);
  });

  it('leaves every service in A to Z order when the metrics did not answer', async () => {
    tempoReturns({ services: ['payment', 'checkout'] });
    jest.mocked(promInstant).mockRejectedValue(new Error('Prometheus answered 502'));

    const { services, notes } = await loadOverview();

    expect(services).toEqual(['checkout', 'payment']);
    expect(notes).toContainEqual({ source: 'metrics', message: 'Prometheus answered 502' });
  });

  it('lists no services and says why when Tempo did not answer', async () => {
    jest.mocked(tempoTagValues).mockRejectedValue(new Error('Tempo answered 502'));

    const { services, notes } = await loadOverview();

    expect(services).toEqual([]);
    expect(notes).toContainEqual({ source: 'traces', message: 'Tempo answered 502' });
  });

  it('narrows the list and its order to the chosen environment, and leaves the signal coverage whole', async () => {
    locationService.push('/drilldown?var-environment=prod');
    tempoReturns({ services: ['checkout', 'payment'], filtered: ['checkout'] });

    const { services, signals } = await loadOverview();

    const filters = jest
      .mocked(tempoTagValues)
      .mock.calls.filter(([tag]) => tag === 'resource.service.name')
      .map(([, , , filter]) => filter);
    expect(filters).toEqual([undefined, '{ resource.deployment.environment.name="prod" }']);
    expect(services).toEqual(['checkout']);
    expect(signals.find((signal) => signal.app === 'traces')).toMatchObject({ covered: 2, total: 2 });
    const inEnvironment = jest
      .mocked(promInstant)
      .mock.calls.filter(([query]) => query.includes('deployment_environment_name="prod"'));
    expect(inEnvironment).toHaveLength(3);
  });

  it('takes the environment values from Tempo, once each and A to Z, whatever the chosen environment', async () => {
    tempoReturns({ environments: ['prod', 'dev', 'prod'] });

    const { scopeValues } = await loadOverview();

    expect(scopeValues.environment).toEqual(['dev', 'prod']);
    expect(tempoTagValues).toHaveBeenCalledWith('resource.deployment.environment.name', NOW_S - WINDOW_S, NOW_S);
  });

  describe('on a stack with the Tempo span metrics', () => {
    const TEMPO_CALLS = 'traces_spanmetrics_calls_total';

    beforeEach(() => {
      jest.mocked(promLabelValues).mockResolvedValue([TEMPO_CALLS]);
    });

    it('looks the metric names up with a selector, over the overview window', async () => {
      await loadOverview();

      expect(promLabelValues).toHaveBeenCalledWith(
        '__name__',
        NOW_S - WINDOW_S,
        NOW_S,
        '{__name__=~"traces_span_?metrics_calls_total"}'
      );
    });

    it('puts failing services first by those span metrics, with the latency in milliseconds', async () => {
      tempoReturns({ services: ['alpha', 'beta', 'gamma'] });
      jest.mocked(promInstant).mockImplementation(async (query, time) => {
        if (query.startsWith('histogram_quantile')) {
          return time === NOW_S
            ? [tempoRow('beta', 400), tempoRow('alpha', 50)]
            : [tempoRow('beta', 100), tempoRow('alpha', 50)];
        }
        if (query.startsWith(`sum by (service) (rate(${TEMPO_CALLS}`)) {
          return [tempoRow('gamma', 0.2)];
        }
        return [];
      });

      const { services, spanMetrics } = await loadOverview();

      expect(services).toEqual(['gamma', 'beta', 'alpha']);
      expect(spanMetrics).toMatchObject({ calls: TEMPO_CALLS, service: 'service', toMs: 1000 });
      expect(promInstant).toHaveBeenCalledWith(
        'histogram_quantile(0.95, sum by (le, service) (rate(traces_spanmetrics_latency_bucket{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER"}[5m]))) * 1000',
        NOW_S
      );
    });

    it('leaves the hints on the collector span metrics', async () => {
      locationService.push('/drilldown?var-ds-metrics=metrics-1');
      jest
        .mocked(promInstant)
        .mockImplementation(async (query) =>
          query.startsWith(
            'sum by (service_name, service_namespace, deployment_environment_name) (rate(traces_span_metrics_calls_total'
          )
            ? [row('beta', 0.5)]
            : []
        );

      const { hints } = await loadOverview();

      expect(hints).toMatchObject([{ severity: 'errors', scope: { value: 'beta' } }]);
    });

    it('narrows the order to the chosen environment', async () => {
      locationService.push('/drilldown?var-environment=prod');

      await loadOverview();

      const ordering = jest.mocked(promInstant).mock.calls.filter(([query]) => query.includes('traces_spanmetrics_'));
      expect(ordering).toHaveLength(3);
      for (const [query] of ordering) {
        expect(query).toContain('span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER",deployment_environment_name="prod"');
      }
    });

    it('says why the list stays A to Z when the series have no service label', async () => {
      tempoReturns({ services: ['b', 'a'] });
      jest
        .mocked(promInstant)
        .mockImplementation(async (query) => (query.includes('traces_spanmetrics_') ? [row('a', 5)] : []));

      const { services, notes } = await loadOverview();

      expect(services).toEqual(['a', 'b']);
      expect(notes).toContainEqual({
        source: 'metrics',
        message: 'The span metrics series have no service label, so the list is not ordered by problems',
      });
    });
  });

  it('orders by the collector span metrics when the name lookup fails, and says why', async () => {
    tempoReturns({ services: ['alpha', 'beta'] });
    jest.mocked(promLabelValues).mockRejectedValue(new Error('Prometheus answered 502'));
    jest
      .mocked(promInstant)
      .mockImplementation(async (query) =>
        query.startsWith('sum by (service_name) (rate(') ? [row('beta', 0.3)] : []
      );

    const { services, spanMetrics, notes } = await loadOverview();

    expect(services).toEqual(['beta', 'alpha']);
    expect(spanMetrics).toMatchObject({ calls: 'traces_span_metrics_calls_total', service: 'service_name' });
    expect(notes).toContainEqual({ source: 'metrics', message: 'Prometheus answered 502' });
  });

  it('orders by the collector span metrics when the stack has both names', async () => {
    jest
      .mocked(promLabelValues)
      .mockResolvedValue(['traces_span_metrics_calls_total', 'traces_spanmetrics_calls_total']);

    await loadOverview();

    expect(jest.mocked(promInstant).mock.calls.some(([query]) => query.includes('traces_spanmetrics_'))).toBe(false);
  });

  it('hands the rows the Loki values and a list of Pyroscope values that one call fills for all of them', async () => {
    jest.mocked(lokiLabelValues).mockResolvedValue(['shop/checkout']);
    jest.mocked(pyroscopeLabelValues).mockResolvedValue(['shop/checkout', 'ebpf/shop/checkout']);

    const { logServiceNames, profileServiceNames } = await loadOverview();

    expect(logServiceNames).toEqual(['shop/checkout']);
    expect(pyroscopeLabelValues).not.toHaveBeenCalled();
    expect(await profileServiceNames()).toEqual(['shop/checkout', 'ebpf/shop/checkout']);
    await profileServiceNames();
    expect(pyroscopeLabelValues).toHaveBeenCalledTimes(1);
    expect(pyroscopeLabelValues).toHaveBeenCalledWith('service_name', NOW_S - WINDOW_S, NOW_S);
  });

  it('leaves out a span metric series that has no service name', async () => {
    locationService.push('/drilldown?var-ds-metrics=metrics-1');
    jest.mocked(promInstant).mockResolvedValue([
      { metric: {}, value: 5 },
      { metric: { service_name: 'checkout', service_version: '1.2' }, value: 5 },
    ]);

    const { services, hints, scopeValues, signals } = await loadOverview();

    expect(hints.map((hint) => hint.scope.value)).toEqual(['checkout']);
    expect(signals.find((signal) => signal.app === 'metrics')).toMatchObject({ covered: 1, total: 1 });
    // Tempo names the services, so a service only the span metrics hold stays out of the list.
    expect(services).toEqual([]);
    expect(scopeValues.service).toEqual([]);
  });
});
