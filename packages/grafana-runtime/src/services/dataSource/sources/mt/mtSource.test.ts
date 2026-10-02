import { type DataSourceInstanceSettings, type DataSourcePluginMeta } from '@grafana/data';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { config } from '../../../../config';
import { FlagKeys } from '../../../../internal/openFeature/openfeature.gen';
import { invalidateCachedPromisesCache } from '../../../../utils/getCachedPromise';
import { type DataSourceSrv, setDataSourceSrv } from '../../../dataSourceSrv';
import { setLogger } from '../../../logging/registry';
import { setDatasourcePluginMetas } from '../../../pluginMeta/datasources';
import {
  DIRECT_ACCESS_UNSUPPORTED_WARNING,
  FALLBACK_TO_LEGACY_SETTINGS_WARNING,
  MISSING_PLUGIN_DROPPED_WARNING,
  MT_FILL_FAILED,
  NUMERIC_ID_REF_WARNING,
  SETTINGS_FETCH_FAILED,
  SETTINGS_NOT_FOUND_STALE_LIST_WARNING,
} from '../../constants';
import { getDataSourceInstance, setDataSourcePluginImporter } from '../../dataSource';
import { DataSourceCacheFillError, DataSourceSettingsFetchError } from '../../errors';
import { getDataSourceInstanceListItem } from '../../listItem';
import {
  _resetForTests,
  getDataSourceInstanceList,
  getDataSourceInstanceSettings,
  initDataSourceInstanceSettings,
  syncDataSourceInstanceSettings,
} from '../../settings';

import { type DataSourceConnection, type DataSourceResource } from './types';

const CONNECTIONS_URL = 'apis/query.grafana.app/v0alpha1/namespaces/default/connections';
const PROM_URL = 'apis/prometheus.datasource.grafana.app/v0alpha1/namespaces/default/datasources/uid-prom';

function meta(id: string, name: string, extra: Partial<DataSourcePluginMeta> = {}): DataSourcePluginMeta {
  return { id, name, type: 'datasource', metrics: true, ...extra } as DataSourcePluginMeta;
}

const metas = {
  prometheus: meta('prometheus', 'Prometheus'),
  grafana: meta('grafana', '-- Grafana --', { builtIn: true }),
};

const promConnection: DataSourceConnection = {
  title: 'Prom',
  name: 'uid-prom',
  group: 'prometheus.datasource.grafana.app',
  version: 'v0alpha1',
  plugin: 'prometheus',
  labels: { default: 'true' },
};

const promResource: DataSourceResource = {
  metadata: { name: 'uid-prom', labels: { 'grafana.app/deprecatedInternalID': '12' } },
  spec: { title: 'Prom', access: 'proxy', url: 'http://prom:9090', jsonData: {} },
};

type Route = { status: number; body?: unknown };
let routes: Record<string, Route>;
const fetchMock = jest.fn(async (url: string) => {
  const route = routes[url] ?? { status: 404 };
  return {
    ok: route.status >= 200 && route.status < 300,
    status: route.status,
    statusText: route.status === 200 ? 'OK' : 'Error',
    json: async () => route.body,
  };
});

function callsTo(url: string): number {
  return fetchMock.mock.calls.filter(([calledUrl]) => calledUrl === url).length;
}

const logWarning = jest.fn();
const logError = jest.fn();
const originalFetch = global.fetch;

beforeAll(() => {
  setTestFlags({
    [FlagKeys.PluginsInitDataSourcesAsync]: true,
    [FlagKeys.QueryService]: true,
    [FlagKeys.QueryServiceWithConnections]: true,
    [FlagKeys.PluginsUseMTPlugins]: true,
    [FlagKeys.DatasourcesConfigUiUseNewDatasourceCRUDAPIs]: true,
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  setTestFlags({});
  global.fetch = originalFetch;
});

beforeEach(() => {
  _resetForTests();
  invalidateCachedPromisesCache();
  fetchMock.mockClear();
  logWarning.mockClear();
  logError.mockClear();
  setLogger('grafana/runtime.plugins.datasource', {
    logDebug: jest.fn(),
    logError,
    logInfo: jest.fn(),
    logMeasurement: jest.fn(),
    logWarning,
  });
  config.namespace = 'default';
  setDatasourcePluginMetas(metas);
  setDataSourceSrv(undefined as unknown as DataSourceSrv);
  routes = {
    [CONNECTIONS_URL]: { status: 200, body: { items: [promConnection] } },
    [PROM_URL]: { status: 200, body: promResource },
  };
});

describe('list', () => {
  it('fills the list from connections and the metas, with the built-ins appended', async () => {
    initDataSourceInstanceSettings({}, '');

    const items = await getDataSourceInstanceList();

    expect(items).toEqual([
      {
        uid: 'uid-prom',
        name: 'Prom',
        type: 'prometheus',
        apiVersion: 'v0alpha1',
        meta: metas.prometheus,
        isDefault: true,
      },
      { uid: 'grafana', name: '-- Grafana --', type: 'datasource', meta: metas.grafana, isDefault: false },
    ]);
    expect(callsTo(CONNECTIONS_URL)).toBe(1);
  });

  it('logs the types of connections dropped because their plugin is not installed', async () => {
    routes[CONNECTIONS_URL] = {
      status: 200,
      body: { items: [promConnection, { ...promConnection, name: 'uid-x', plugin: 'not-installed' }] },
    };
    initDataSourceInstanceSettings({}, '');

    const items = await getDataSourceInstanceList({ all: true });

    expect(items.map((item) => item.uid)).toEqual(['uid-prom', 'grafana']);
    expect(logWarning).toHaveBeenCalledWith(MISSING_PLUGIN_DROPPED_WARNING, { count: '1', types: 'not-installed' });
  });

  it('refreshes from the MT APIs, not the boot data, when DataSourceSrv syncs the cache', async () => {
    initDataSourceInstanceSettings({}, '');
    await getDataSourceInstanceList();

    await syncDataSourceInstanceSettings({ datasources: {}, defaultDatasource: '' });

    expect((await getDataSourceInstanceList()).map((item) => item.uid)).toEqual(['uid-prom', 'grafana']);
  });
});

describe('settings', () => {
  it('loads the settings for a uid on demand and serves later lookups from the cache', async () => {
    initDataSourceInstanceSettings({}, '');

    const first = await getDataSourceInstanceSettings('uid-prom');
    const second = await getDataSourceInstanceSettings('Prom');

    expect(first).toEqual({
      id: 12,
      uid: 'uid-prom',
      name: 'Prom',
      type: 'prometheus',
      apiVersion: 'v0alpha1',
      meta: metas.prometheus,
      isDefault: true,
      access: 'proxy',
      readOnly: false,
      url: '/api/datasources/proxy/uid/uid-prom',
      jsonData: { directUrl: 'http://prom:9090' },
    });
    expect(second).toBe(first);
    expect(callsTo(PROM_URL)).toBe(1);
  });

  it('resolves the default ref through the default label', async () => {
    initDataSourceInstanceSettings({}, '');

    expect((await getDataSourceInstanceSettings(null))?.uid).toBe('uid-prom');
  });

  it('serves built-in settings without a per-uid request', async () => {
    initDataSourceInstanceSettings({}, '');

    expect((await getDataSourceInstanceSettings('-- Grafana --'))?.uid).toBe('grafana');
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([CONNECTIONS_URL]);
  });

  it('never makes a per-uid request for getDataSourceInstanceListItem', async () => {
    initDataSourceInstanceSettings({}, '');

    const item = await getDataSourceInstanceListItem('uid-prom');

    expect(item?.name).toBe('Prom');
    expect(callsTo(PROM_URL)).toBe(0);
  });

  it('resolves undefined without the legacy fallback when the per-uid API returns 404', async () => {
    const getInstanceSettings = jest.fn().mockReturnValue({ uid: 'uid-prom' });
    setDataSourceSrv({ getInstanceSettings } as unknown as DataSourceSrv);
    routes[PROM_URL] = { status: 404 };
    initDataSourceInstanceSettings({}, '');

    expect(await getDataSourceInstanceSettings('uid-prom')).toBeUndefined();
    expect(getInstanceSettings).not.toHaveBeenCalled();
    expect(logWarning).toHaveBeenCalledWith(SETTINGS_NOT_FOUND_STALE_LIST_WARNING, { uid: 'uid-prom' });
  });

  it('rejects with DataSourceSettingsFetchError on a failed request, and retries on the next lookup', async () => {
    routes[PROM_URL] = { status: 500 };
    initDataSourceInstanceSettings({}, '');

    await expect(getDataSourceInstanceSettings('uid-prom')).rejects.toBeInstanceOf(DataSourceSettingsFetchError);
    expect(logError).toHaveBeenCalledWith(expect.anything(), { uid: 'uid-prom', status: '500' });
    expect(logError.mock.calls[0][0].message).toBe(SETTINGS_FETCH_FAILED);

    routes[PROM_URL] = { status: 200, body: promResource };
    expect((await getDataSourceInstanceSettings('uid-prom'))?.name).toBe('Prom');
    expect(callsTo(PROM_URL)).toBe(2);
  });

  it('logs a direct-access data source once per uid', async () => {
    routes[PROM_URL] = { status: 200, body: { ...promResource, spec: { ...promResource.spec, access: 'direct' } } };
    initDataSourceInstanceSettings({}, '');

    const settings = await getDataSourceInstanceSettings('uid-prom');
    await getDataSourceInstanceSettings('uid-prom');

    expect(settings?.url).toBe('http://prom:9090');
    const directWarnings = logWarning.mock.calls.filter(([message]) => message === DIRECT_ACCESS_UNSUPPORTED_WARNING);
    expect(directWarnings).toEqual([[DIRECT_ACCESS_UNSUPPORTED_WARNING, { uid: 'uid-prom', type: 'prometheus' }]]);
  });

  it('logs a numeric-id ref and resolves it through the legacy fallback', async () => {
    const legacy = { uid: 'uid-prom', name: 'Prom' } as DataSourceInstanceSettings;
    setDataSourceSrv({ getInstanceSettings: jest.fn().mockReturnValue(legacy) } as unknown as DataSourceSrv);
    initDataSourceInstanceSettings({}, '');

    const result = await getDataSourceInstanceSettings('12');

    expect(result).toBe(legacy);
    expect(logWarning).toHaveBeenCalledWith(NUMERIC_ID_REF_WARNING, expect.objectContaining({ id: '12', path: 'mt' }));
    expect(logWarning).toHaveBeenCalledWith(FALLBACK_TO_LEGACY_SETTINGS_WARNING, { ref: '12' });
  });
});

describe('failed fill', () => {
  it('rejects the async APIs with DataSourceCacheFillError and logs the failure', async () => {
    routes[CONNECTIONS_URL] = { status: 500 };
    initDataSourceInstanceSettings({}, '');

    await expect(getDataSourceInstanceList()).rejects.toBeInstanceOf(DataSourceCacheFillError);
    expect(logError.mock.calls.map(([error]) => error.message)).toContain(MT_FILL_FAILED);
  });

  it('does not fall back to the legacy DataSourceSrv from getDataSourceInstance', async () => {
    const get = jest.fn().mockResolvedValue({ uid: 'uid-prom' });
    setDataSourceSrv({ get } as unknown as DataSourceSrv);
    setDataSourcePluginImporter(jest.fn());
    routes[CONNECTIONS_URL] = { status: 500 };
    initDataSourceInstanceSettings({}, '');

    await expect(getDataSourceInstance('uid-prom')).rejects.toBeInstanceOf(DataSourceCacheFillError);
    expect(get).not.toHaveBeenCalled();
  });

  it('starts a new fill on the next call once the API recovers', async () => {
    routes[CONNECTIONS_URL] = { status: 500 };
    initDataSourceInstanceSettings({}, '');
    await expect(getDataSourceInstanceList()).rejects.toBeInstanceOf(DataSourceCacheFillError);

    routes[CONNECTIONS_URL] = { status: 200, body: { items: [promConnection] } };
    const items = await getDataSourceInstanceList();

    expect(items.map((item) => item.uid)).toEqual(['uid-prom', 'grafana']);
    expect(callsTo(CONNECTIONS_URL)).toBe(2);
  });
});

describe('refresh after a data source change', () => {
  it('keeps the current list and resolves when the connections refetch fails', async () => {
    initDataSourceInstanceSettings({}, '');
    await getDataSourceInstanceList();
    routes[CONNECTIONS_URL] = { status: 500 };

    await expect(syncDataSourceInstanceSettings({ datasources: {}, defaultDatasource: '' })).resolves.toBeUndefined();

    expect((await getDataSourceInstanceList()).map((item) => item.uid)).toEqual(['uid-prom', 'grafana']);
    expect(logError).toHaveBeenCalledWith(expect.objectContaining({ message: MT_FILL_FAILED }), {
      reason: 'reload',
      source: 'mt',
    });
  });
});
