import { locationService } from '@grafana/runtime';

import { searchEntities } from './kgEntities';
import {
  lokiCount,
  lokiCountRange,
  lokiLabelValues,
  lokiLogs,
  promInstant,
  promRange,
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
  it('leaves out a span metric series that has no service name', async () => {
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
