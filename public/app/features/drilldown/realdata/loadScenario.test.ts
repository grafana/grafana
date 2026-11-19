import { locationService } from '@grafana/runtime';

import { searchEntities } from './kgEntities';
import {
  lokiCount,
  lokiCountRange,
  lokiLabelValues,
  lokiLogs,
  promInstant,
  promLabelValues,
  promRange,
  pyroscopeLabelValues,
  tempoSearch,
  tempoTagValues,
} from './labApi';
import { type Scope } from './liveScenario';
import { loadOverview, loadScope } from './loadScenario';

jest.mock('./labApi');
jest.mock('./kgEntities');

const SCOPE: Scope = { type: 'service', value: 'checkout' };
const FROM_SEC = 1_700_000_000;
const TO_SEC = FROM_SEC + 1800;

beforeEach(() => {
  // No data source answers anything, so a test sees only what the data sources chosen in the URL change.
  jest.mocked(promInstant).mockResolvedValue([]);
  jest.mocked(promLabelValues).mockResolvedValue([]);
  jest.mocked(promRange).mockResolvedValue([]);
  jest.mocked(lokiCount).mockResolvedValue(0);
  jest.mocked(lokiCountRange).mockResolvedValue([]);
  jest.mocked(lokiLogs).mockResolvedValue([]);
  jest.mocked(lokiLabelValues).mockResolvedValue([]);
  jest.mocked(tempoSearch).mockResolvedValue([]);
  jest.mocked(tempoTagValues).mockResolvedValue([]);
  jest.mocked(searchEntities).mockResolvedValue({ entities: [], complete: true });
  locationService.replace('/drilldown');
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
      jest.mocked(promInstant).mockImplementation(async (query) => {
        if (query.startsWith('sum by (service_name, service_namespace, service_version)')) {
          return [row('beta', 5)];
        }
        if (query.startsWith('sum by (service_name) (rate(traces_span_metrics_calls_total')) {
          return [row('beta', 0.5)];
        }
        return [];
      });

      const { hints } = await loadOverview();

      expect(hints.map((hint) => hint.id)).toEqual(['errors-beta']);
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
