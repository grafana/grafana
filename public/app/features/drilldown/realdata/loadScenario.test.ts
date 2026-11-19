import { locationService } from '@grafana/runtime';

import { searchEntities } from './kgEntities';
import {
  lokiCount,
  lokiCountRange,
  lokiLabelValues,
  lokiLabelVolumes,
  lokiLogs,
  lokiInstant,
  promInstant,
  promRange,
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
    expect(scopeValues.service).toEqual(['checkout']);
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
  it('leaves out a span metric series that has no service name', async () => {
    locationService.push('/drilldown?var-ds-metrics=metrics-1');
    jest.mocked(promInstant).mockResolvedValue([
      { metric: {}, value: 5 },
      { metric: { service_name: 'checkout', service_version: '1.2' }, value: 5 },
    ]);

    const { services, hints, scopeValues, signals } = await loadOverview();

    expect(services.map((service) => service.name)).toEqual(['checkout']);
    expect(hints.map((hint) => hint.scope.value)).toEqual(['checkout']);
    expect(scopeValues.service).toEqual(['checkout']);
    expect(signals.find((signal) => signal.app === 'metrics')).toMatchObject({ covered: 1, total: 1 });
  });
});
