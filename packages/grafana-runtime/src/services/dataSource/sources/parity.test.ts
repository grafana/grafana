import {
  type DataSourceInstanceListItem,
  type DataSourceInstanceSettings,
  type DataSourcePluginMeta,
} from '@grafana/data';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { config } from '../../../config';
import { FlagKeys } from '../../../internal/openFeature/openfeature.gen';
import { invalidateCachedPromisesCache } from '../../../utils/getCachedPromise';
import { type DataSourceSrv, setDataSourceSrv } from '../../dataSourceSrv';
import { setDatasourcePluginMetas } from '../../pluginMeta/datasources';
import { getDataSourceInstanceListItem } from '../listItem';
import {
  _resetForTests,
  getDataSourceInstanceList,
  getDataSourceInstanceSettings,
  initDataSourceInstanceSettings,
} from '../settings';

import { type DataSourceConnection, type DataSourceResource } from './mt/types';

// One set of data sources, written once as boot data (what /api/frontend/settings sends) and once
// as the MT responses for the same data sources. Both sources must give the same answers.

function meta(id: string, name: string, extra: Partial<DataSourcePluginMeta> = {}): DataSourcePluginMeta {
  return { id, name, type: 'datasource', metrics: true, ...extra } as DataSourcePluginMeta;
}

const metas: Record<string, DataSourcePluginMeta> = {
  prometheus: meta('prometheus', 'Prometheus'),
  'grafana-postgresql-datasource': meta('grafana-postgresql-datasource', 'PostgreSQL', { aliasIDs: ['postgres'] }),
  mysql: meta('mysql', 'MySQL'),
  loki: meta('loki', 'Loki', { metrics: false, logs: true }),
  grafana: meta('grafana', '-- Grafana --', { builtIn: true }),
  mixed: meta('mixed', '-- Mixed --', { builtIn: true }),
  dashboard: meta('dashboard', '-- Dashboard --', { builtIn: true }),
};

interface Fixture {
  id: number;
  uid: string;
  name: string;
  /** The type as stored on the data source; can be an alias. */
  storedType: string;
  access: 'proxy' | 'direct';
  url: string;
  database?: string;
  jsonData: Record<string, unknown>;
  isDefault?: boolean;
  readOnly?: boolean;
  /** What boot data adds for this data source (per-type tweaks, credentials). */
  boot: { jsonData?: Record<string, unknown>; basicAuth?: string };
}

const fixtures: Fixture[] = [
  {
    id: 1,
    uid: 'uid-prom',
    name: 'Prom',
    storedType: 'prometheus',
    access: 'proxy',
    url: 'http://prom:9090',
    jsonData: { httpMethod: 'POST' },
    isDefault: true,
    boot: { jsonData: { httpMethod: 'POST', directUrl: 'http://prom:9090' } },
  },
  {
    id: 2,
    uid: 'uid-pg',
    name: 'Postgres (aliased)',
    storedType: 'postgres',
    access: 'proxy',
    url: 'pg:5432',
    database: 'app',
    jsonData: {},
    readOnly: true,
    // Boot data matches the database backfill on the stored type, so the alias gets none.
    boot: {},
  },
  {
    id: 3,
    uid: 'uid-mysql',
    name: 'MySQL (root database)',
    storedType: 'mysql',
    access: 'proxy',
    url: 'mysql:3306',
    database: 'shop',
    jsonData: {},
    boot: { jsonData: { database: 'shop' } },
  },
  {
    id: 4,
    uid: 'uid-loki',
    name: 'Loki (direct)',
    storedType: 'loki',
    access: 'direct',
    url: 'http://loki:3100',
    jsonData: {},
    // Boot data exposes the basic auth header for direct access; MT never does.
    boot: { basicAuth: 'Basic ZHVtbXktdXNlcjpkdW1teS1wYXNzd29yZA==' },
  },
];

// Boot data drops this one, because the plugin is not installed; MT must drop it too.
const notInstalled = { uid: 'uid-gone', name: 'Gone', storedType: 'not-installed' };

function bootData(): Record<string, DataSourceInstanceSettings> {
  const datasources: Record<string, DataSourceInstanceSettings> = {};
  for (const f of fixtures) {
    const pluginMeta = metas[f.storedType] ?? metas['grafana-postgresql-datasource'];
    datasources[f.name] = {
      id: f.id,
      uid: f.uid,
      name: f.name,
      type: pluginMeta.id,
      meta: pluginMeta,
      url: f.access === 'proxy' ? `/api/datasources/proxy/uid/${f.uid}` : f.url,
      isDefault: f.isDefault ?? false,
      access: f.access,
      jsonData: f.jsonData,
      readOnly: f.readOnly ?? false,
      ...f.boot,
    };
  }
  datasources['-- Grafana --'] = {
    id: -1,
    uid: 'grafana',
    name: '-- Grafana --',
    type: 'datasource',
    meta: metas.grafana,
    jsonData: {},
    readOnly: false,
    isDefault: false,
  } as DataSourceInstanceSettings;
  for (const builtIn of [metas.mixed, metas.dashboard]) {
    datasources[builtIn.name] = {
      name: builtIn.name,
      type: 'datasource',
      meta: builtIn,
      jsonData: {},
      readOnly: false,
      isDefault: false,
    } as DataSourceInstanceSettings;
  }
  return datasources;
}

function connections(): DataSourceConnection[] {
  return [
    ...fixtures.map((f) => ({
      title: f.name,
      name: f.uid,
      group: `${f.storedType}.datasource.grafana.app`,
      version: 'v0alpha1',
      plugin: f.storedType,
      labels: f.isDefault ? { default: 'true' } : undefined,
    })),
    {
      title: notInstalled.name,
      name: notInstalled.uid,
      group: `${notInstalled.storedType}.datasource.grafana.app`,
      version: 'v0alpha1',
      plugin: notInstalled.storedType,
    },
  ];
}

function resources(): Record<string, DataSourceResource> {
  const byUrl: Record<string, DataSourceResource> = {};
  for (const f of fixtures) {
    const url = `apis/${f.storedType}.datasource.grafana.app/v0alpha1/namespaces/default/datasources/${f.uid}`;
    byUrl[url] = {
      metadata: {
        name: f.uid,
        labels: { 'grafana.app/deprecatedInternalID': String(f.id), ...(f.isDefault ? { default: 'true' } : {}) },
      },
      spec: {
        title: f.name,
        access: f.access,
        url: f.url,
        database: f.database,
        readOnly: f.readOnly,
        jsonData: f.jsonData,
        basicAuth: f.access === 'direct',
        basicAuthUser: f.access === 'direct' ? 'admin' : undefined,
      },
    };
  }
  return byUrl;
}

interface Answers {
  list: DataSourceInstanceListItem[];
  items: Array<DataSourceInstanceListItem | undefined>;
  settings: Array<DataSourceInstanceSettings | undefined>;
  defaultSettings: DataSourceInstanceSettings | undefined;
}

const uids = [...fixtures.map((f) => f.uid), 'grafana', '-- Mixed --', '-- Dashboard --', notInstalled.uid];

async function collectAnswers(): Promise<Answers> {
  return {
    list: await getDataSourceInstanceList({ all: true, mixed: true, dashboard: true }),
    items: await Promise.all(uids.map((uid) => getDataSourceInstanceListItem(uid))),
    settings: await Promise.all(uids.map((uid) => getDataSourceInstanceSettings(uid))),
    defaultSettings: await getDataSourceInstanceSettings(null),
  };
}

// The documented differences: MT reports the served API version, and never exposes credentials.
function withoutKnownDifferences<T extends object | undefined>(value: T): T {
  if (!value) {
    return value;
  }
  const {
    apiVersion: _apiVersion,
    basicAuth: _basicAuth,
    ...rest
  } = value as T & {
    apiVersion?: string;
    basicAuth?: string;
  };
  return rest as T;
}

function normalize(answers: Answers) {
  return {
    list: answers.list.map(withoutKnownDifferences),
    items: answers.items.map(withoutKnownDifferences),
    settings: answers.settings.map(withoutKnownDifferences),
    defaultSettings: withoutKnownDifferences(answers.defaultSettings),
  };
}

const originalFetch = global.fetch;

afterAll(() => {
  setTestFlags({});
  global.fetch = originalFetch;
});

beforeEach(() => {
  _resetForTests();
  invalidateCachedPromisesCache();
  setDatasourcePluginMetas(metas);
  setDataSourceSrv(undefined as unknown as DataSourceSrv);
  config.namespace = 'default';
});

async function answersFromBootData(): Promise<Answers> {
  setTestFlags({});
  initDataSourceInstanceSettings(bootData(), 'Prom');
  return collectAnswers();
}

async function answersFromMT(): Promise<Answers> {
  setTestFlags({
    [FlagKeys.PluginsInitDataSourcesAsync]: true,
    [FlagKeys.QueryService]: true,
    [FlagKeys.QueryServiceWithConnections]: true,
    [FlagKeys.PluginsUseMTPlugins]: true,
    [FlagKeys.DatasourcesConfigUiUseNewDatasourceCRUDAPIs]: true,
  });
  const byUrl: Record<string, unknown> = {
    'apis/query.grafana.app/v0alpha1/namespaces/default/connections': { items: connections() },
    ...resources(),
  };
  global.fetch = jest.fn(async (url: string) => ({
    ok: url in byUrl,
    status: url in byUrl ? 200 : 404,
    statusText: '',
    json: async () => byUrl[url],
  })) as unknown as typeof fetch;

  initDataSourceInstanceSettings({}, '');
  return collectAnswers();
}

describe('boot data and MT parity', () => {
  it('gives the same list, list items, settings and default from both sources', async () => {
    const boot = await answersFromBootData();

    _resetForTests();
    invalidateCachedPromisesCache();
    const mt = await answersFromMT();

    expect(normalize(mt)).toEqual(normalize(boot));
    // Guard against a vacuous pass: both sides found the data sources.
    expect(boot.list.map((item) => item.uid)).toEqual([
      'uid-loki',
      'uid-mysql',
      'uid-pg',
      'uid-prom',
      '-- Mixed --',
      '-- Dashboard --',
      'grafana',
    ]);
  });

  it('only differs in the documented fields', async () => {
    await answersFromBootData();
    const bootLoki = await getDataSourceInstanceSettings('uid-loki');

    _resetForTests();
    invalidateCachedPromisesCache();
    await answersFromMT();
    const mtLoki = await getDataSourceInstanceSettings('uid-loki');
    const mtProm = await getDataSourceInstanceListItem('uid-prom');

    expect(bootLoki?.basicAuth).toBe('Basic ZHVtbXktdXNlcjpkdW1teS1wYXNzd29yZA==');
    expect(mtLoki?.basicAuth).toBeUndefined();
    expect(mtProm?.apiVersion).toBe('v0alpha1');
  });
});
