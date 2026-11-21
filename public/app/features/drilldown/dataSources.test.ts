import { type DataSourceInstanceListItem, type UrlQueryMap } from '@grafana/data';
import { getDataSourceInstanceList, getDefaultDataSourceInstanceListItem, locationService } from '@grafana/runtime';

import {
  SIGNALS,
  type Signal,
  chooseRelated,
  dataSourceParam,
  getSelectedDataSource,
  nameStem,
  requireDataSource,
  suggestDataSources,
} from './dataSources';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceInstanceList: jest.fn(),
  getDefaultDataSourceInstanceListItem: jest.fn(),
  locationService: { getSearchObject: jest.fn() },
}));

// A data source the list holds. It has the plugin id its signal needs unless a type is given, as a SQL one can have any of three.
type Fake = { uid: string; name: string; type?: string };
const option = (uid: string, name: string, type?: string): Fake => (type ? { uid, name, type } : { uid, name });

// The data sources of a Grafana Cloud stack on ops.grafana-ops.net, with other groups and oddly named ones around them.
const OPS_OPTIONS: Record<Signal, Fake[]> = {
  metrics: [
    option('grafanacloud-demoinfra-prom', 'grafanacloud-demoinfra-prom'),
    option('grafanacloud-prom', 'grafanacloud-ops-prom'),
    option('edprtf91hz01se', 'mimir-ops-03'),
    option('000000134', 'ops-cortex'),
  ],
  logs: [
    option('grafanacloud-demoinfra-logs', 'grafanacloud-demoinfra-logs'),
    option('grafanacloud-logs', 'grafanacloud-ops-logs'),
    option('c-R8UWvVk', 'Loki-Ops'),
  ],
  traces: [
    option('grafanacloud-demoinfra-traces', 'grafanacloud-demoinfra-traces'),
    option('grafanacloud-traces', 'grafanacloud-ops-traces'),
  ],
  profiles: [
    option('grafanacloud-demoinfra-profiles', 'grafanacloud-demoinfra-profiles'),
    option('grafanacloud-profiles', 'grafanacloud-ops-profiles'),
    option('dedixjk68oem8b', 'grafana-dev-pyroscope'),
  ],
  knowledgegraph: [option('grafanacloud-knowledgegraph', 'grafanacloud-ops-knowledgegraph')],
  // Its name shares the stem of the group above, which a SQL data source never joins.
  sql: [option('grafanacloud-ops-sql', 'grafanacloud-ops')],
};

describe('nameStem', () => {
  it('drops the signal word', () => {
    expect(nameStem('grafanacloud-demoinfra-prom')).toBe('grafanacloud-demoinfra');
    expect(nameStem('grafanacloud-demoinfra-logs')).toBe('grafanacloud-demoinfra');
  });

  it('drops the words it is told to ignore', () => {
    expect(nameStem('grafanacloud-ops-prom', ['ops'])).toBe('grafanacloud');
    expect(nameStem('Loki-Ops', ['ops'])).toBe('');
  });

  it('keeps a name made only of other words whole', () => {
    expect(nameStem('App o11y frontend')).toBe('app-o11y-frontend');
  });
});

describe('chooseRelated', () => {
  it('picks the group that covers the most signals, leaving SQL out even when its name shares the stem', () => {
    expect(chooseRelated(OPS_OPTIONS, {}, [], ['ops'])).toEqual({
      metrics: 'grafanacloud-prom',
      logs: 'grafanacloud-logs',
      traces: 'grafanacloud-traces',
      profiles: 'grafanacloud-profiles',
      knowledgegraph: 'grafanacloud-knowledgegraph',
    });
  });

  it('does not pair data sources only because they both say ops', () => {
    const options = {
      ...OPS_OPTIONS,
      metrics: [option('a', 'ops-cortex')],
      logs: [option('b', 'Loki-Ops')],
      traces: [],
      profiles: [],
      knowledgegraph: [],
    };

    expect(chooseRelated(options, {}, [], ['ops'])).toEqual({});
  });

  it('keeps the group a chosen data source belongs to, even when another group covers more', () => {
    const chosen = chooseRelated(OPS_OPTIONS, {}, ['grafanacloud-demoinfra'], ['ops']);

    expect(chosen).toEqual({
      metrics: 'grafanacloud-demoinfra-prom',
      logs: 'grafanacloud-demoinfra-logs',
      traces: 'grafanacloud-demoinfra-traces',
      profiles: 'grafanacloud-demoinfra-profiles',
    });
  });

  it('breaks a tie by the group that holds the instance defaults, then by name', () => {
    const options = {
      ...OPS_OPTIONS,
      metrics: [option('m-a', 'alpha-prom'), option('m-b', 'beta-prom')],
      logs: [option('l-a', 'alpha-logs'), option('l-b', 'beta-logs')],
      traces: [],
      profiles: [],
      knowledgegraph: [],
    };

    expect(chooseRelated(options, { metrics: 'm-b' }, [])).toEqual({ metrics: 'm-b', logs: 'l-b' });
    expect(chooseRelated(options, {}, [])).toEqual({ metrics: 'm-a', logs: 'l-a' });
  });

  it('chooses nothing when no two signals share a stem', () => {
    const options = {
      metrics: [option('a', 'one-prom')],
      logs: [option('b', 'two-logs')],
      traces: [],
      profiles: [],
      knowledgegraph: [],
    };

    expect(chooseRelated(options, {}, [])).toEqual({});
  });
});

describe('data sources in the URL', () => {
  const urlHolds = (values: UrlQueryMap) => jest.mocked(locationService.getSearchObject).mockReturnValue(values);

  beforeEach(() => {
    jest.mocked(getDataSourceInstanceList).mockReset();
    jest.mocked(getDefaultDataSourceInstanceListItem).mockReset().mockResolvedValue(undefined);
    jest.mocked(getDataSourceInstanceList).mockImplementation(listFor(OPS_OPTIONS));
    urlHolds({});
  });

  // Like the real list, it returns the data sources whose type is among the types asked for, given as one or a list,
  // and adds the built-in Grafana data source to every result.
  function listFor(options: Record<Signal, Fake[]>) {
    return async (filters?: { type?: string | string[] }): Promise<DataSourceInstanceListItem[]> => {
      const asked = [filters?.type ?? []].flat();
      const own = SIGNALS.flatMap((signal) =>
        options[signal].map((item) => ({ type: typeOf(signal), ...item })).filter((item) => asked.includes(item.type))
      );
      return [...own, { uid: 'grafana', name: '-- Grafana --', type: 'grafana' }].map(
        (item) => item as DataSourceInstanceListItem
      );
    };
  }

  function typeOf(signal: Signal) {
    return {
      metrics: 'prometheus',
      logs: 'loki',
      traces: 'tempo',
      profiles: 'grafana-pyroscope-datasource',
      knowledgegraph: 'grafana-knowledgegraph-datasource',
      sql: 'grafana-postgresql-datasource',
    }[signal];
  }

  it('selects the uid the URL holds when it names a listed data source', async () => {
    urlHolds({ [dataSourceParam('logs')]: 'c-R8UWvVk' });

    await expect(getSelectedDataSource('logs')).resolves.toBe('c-R8UWvVk');
  });

  it('never offers the built-in Grafana data source, and never groups on its name', async () => {
    urlHolds({ [dataSourceParam('metrics')]: 'grafana' });
    await expect(getSelectedDataSource('metrics')).resolves.toBeUndefined();

    const suggestion = await suggestDataSources();
    expect(Object.values(suggestion)).not.toContain('grafana');
  });

  it('selects nothing for a uid that is not listed, or when the URL holds none', async () => {
    urlHolds({ [dataSourceParam('logs')]: 'gone' });
    await expect(getSelectedDataSource('logs')).resolves.toBeUndefined();

    urlHolds({});
    await expect(getSelectedDataSource('logs')).resolves.toBeUndefined();
  });

  it('ignores a URL value that is not a single string', async () => {
    urlHolds({ [dataSourceParam('logs')]: ['grafanacloud-logs', 'c-R8UWvVk'] });

    await expect(getSelectedDataSource('logs')).resolves.toBeUndefined();
  });

  it('throws a clear error for a signal with no selected data source', async () => {
    await expect(requireDataSource('profiles')).rejects.toThrow(
      'No grafana-pyroscope-datasource data source is selected for profiles'
    );
  });

  it('suggests only the signals the URL leaves open', async () => {
    urlHolds({ [dataSourceParam('metrics')]: 'edprtf91hz01se' });

    const suggestion = await suggestDataSources();

    expect(suggestion.metrics).toBeUndefined();
    expect(suggestion.logs).toBe('grafanacloud-logs');
  });

  it('falls back to the instance default for a signal the related group lacks', async () => {
    const options = { ...OPS_OPTIONS, profiles: [option('only-pyro', 'weird-name')] };
    jest.mocked(getDataSourceInstanceList).mockImplementation(listFor(options));
    jest
      .mocked(getDefaultDataSourceInstanceListItem)
      .mockImplementation(async (items) => items.find((item) => item.uid === 'only-pyro'));

    const suggestion = await suggestDataSources();

    expect(suggestion.profiles).toBe('only-pyro');
    expect(suggestion.metrics).toBe('grafanacloud-prom');
  });

  it('never suggests a SQL data source, whether its name shares the stem or the instance defaults to it', async () => {
    jest
      .mocked(getDefaultDataSourceInstanceListItem)
      .mockImplementation(async (items) => items.find((item) => item.uid === 'grafanacloud-ops-sql'));

    const suggestion = await suggestDataSources();

    expect(suggestion).toEqual({
      metrics: 'grafanacloud-prom',
      logs: 'grafanacloud-logs',
      traces: 'grafanacloud-traces',
      profiles: 'grafanacloud-profiles',
      knowledgegraph: 'grafanacloud-knowledgegraph',
    });
  });

  it.each(['mysql', 'grafana-postgresql-datasource', 'mssql'])(
    'selects the SQL data source the URL holds when it is a %s data source',
    async (type) => {
      jest
        .mocked(getDataSourceInstanceList)
        .mockImplementation(listFor({ ...OPS_OPTIONS, sql: [option('orders', 'orders', type)] }));
      urlHolds({ [dataSourceParam('sql')]: 'orders' });

      await expect(getSelectedDataSource('sql')).resolves.toBe('orders');
    }
  );

  it('does not offer a data source of another SQL-like type as the SQL data source', async () => {
    jest
      .mocked(getDataSourceInstanceList)
      .mockImplementation(
        listFor({ ...OPS_OPTIONS, sql: [option('warehouse', 'warehouse', 'grafana-bigquery-datasource')] })
      );
    urlHolds({ [dataSourceParam('sql')]: 'warehouse' });

    await expect(getSelectedDataSource('sql')).resolves.toBeUndefined();
  });
});
