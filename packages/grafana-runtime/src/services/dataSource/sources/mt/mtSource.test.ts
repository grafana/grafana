import {
  type CurrentUserDTO,
  type DataSourceInstanceSettings,
  type DataSourcePluginMeta,
  OrgRole,
} from '@grafana/data';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { config } from '../../../../config';
import { FlagKeys } from '../../../../internal/openFeature/openfeature.gen';
import { invalidateCachedPromisesCache } from '../../../../utils/getCachedPromise';
import { invalidateAPIDiscovery, setAPIDiscoveryForTesting } from '../../../apiDiscovery/discovery';
import { type APIGroupInfo } from '../../../apiDiscovery/types';
import { type BackendSrv, setBackendSrv } from '../../../backendSrv';
import { type DataSourceSrv, setDataSourceSrv } from '../../../dataSourceSrv';
import { setLogger } from '../../../logging/registry';
import { setDatasourcePluginMetas } from '../../../pluginMeta/datasources';
import {
  DIRECT_ACCESS_UNSUPPORTED_WARNING,
  FALLBACK_TO_LEGACY_SETTINGS_WARNING,
  MISSING_PLUGIN_DROPPED_WARNING,
  MT_API_DISCOVERY_UNKNOWN_WARNING,
  MT_FILL_FAILED,
  MT_GROUP_NOT_SERVED_DROPPED_WARNING,
  NUMERIC_ID_REF_WARNING,
  MT_SETTINGS_FETCH_FAILED,
  MT_SETTINGS_NOT_FOUND_STALE_LIST_WARNING,
} from '../../constants';
import { getDataSourceInstance, setDataSourcePluginImporter } from '../../dataSource';
import { DataSourceListFetchError, DataSourceSettingsFetchError } from '../../errors';
import { getDataSourceInstanceListItem } from '../../listItem';
import {
  _resetForTests,
  getDataSourceInstanceList,
  getDataSourceInstanceSettings,
  initDataSourceInstanceSettings,
  syncDataSourceInstanceSettings,
} from '../../settings';

import { MTDataSource } from './mtSource';
import { type DataSourceConnection, type DataSourceResource } from './types';

const CONNECTIONS_URL = '/apis/query.grafana.app/v0alpha1/namespaces/default/connections';
const PROM_URL = '/apis/prometheus.datasource.grafana.app/v0alpha1/namespaces/default/datasources/uid-prom';

function served(group: string, versions: string[] = ['v0alpha1']): APIGroupInfo {
  return { group, versions, preferredVersion: versions[0] };
}

const defaultDiscovery = [served('query.grafana.app'), served('prometheus.datasource.grafana.app')];

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
  plugin: 'prometheus',
  labels: { default: 'true' },
};

const promResource: DataSourceResource = {
  metadata: { name: 'uid-prom', labels: { 'grafana.app/deprecatedInternalID': '12' } },
  spec: { title: 'Prom', access: 'proxy', url: 'http://prom:9090', jsonData: {} },
};

type Route = { status: number; body?: unknown };
let routes: Record<string, Route>;
// Rejects the way backendSrv does: with a FetchError-shaped value.
const backendGet = jest.fn(
  async (url: string, params?: { continue?: string }, requestId?: string): Promise<unknown> => {
    const route = routes[params?.continue ? `${url}?continue=${params.continue}` : url] ?? { status: 404 };
    if (route.status < 200 || route.status >= 300) {
      throw Object.assign(new Error('Error'), { status: route.status, statusText: 'Error', data: {} });
    }
    return route.body;
  }
);

function callsTo(url: string): number {
  return backendGet.mock.calls.filter(([calledUrl]) => calledUrl === url).length;
}

const logWarning = jest.fn();
const logError = jest.fn();
const cachedPromiseLogError = jest.fn();

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeAll(() => {
  setTestFlags({
    [FlagKeys.PluginsInitDataSourcesAsync]: true,
    [FlagKeys.QueryService]: true,
    [FlagKeys.QueryServiceWithConnections]: true,
    [FlagKeys.PluginsUseMTPlugins]: true,
    [FlagKeys.DatasourcesConfigUiUseNewDatasourceCRUDAPIs]: true,
  });
  setBackendSrv({ get: backendGet } as unknown as BackendSrv);
});

afterAll(() => {
  setTestFlags({});
  invalidateAPIDiscovery();
});

beforeEach(() => {
  _resetForTests();
  invalidateCachedPromisesCache();
  backendGet.mockClear();
  logWarning.mockClear();
  logError.mockClear();
  setLogger('grafana/runtime.plugins.datasource', {
    logDebug: jest.fn(),
    logError,
    logInfo: jest.fn(),
    logMeasurement: jest.fn(),
    logWarning,
  });
  cachedPromiseLogError.mockClear();
  setLogger('grafana/runtime.utils.getCachedPromise', {
    logDebug: jest.fn(),
    logError: cachedPromiseLogError,
    logInfo: jest.fn(),
    logMeasurement: jest.fn(),
    logWarning: jest.fn(),
  });
  config.namespace = 'default';
  // The MT fill needs a user session.
  config.bootData.user = { isSignedIn: true, orgRole: OrgRole.Admin } as CurrentUserDTO;
  setDatasourcePluginMetas(metas);
  setDataSourceSrv(undefined as unknown as DataSourceSrv);
  setAPIDiscoveryForTesting(defaultDiscovery);
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
        meta: metas.prometheus,
      },
      { uid: 'grafana', name: '-- Grafana --', type: 'datasource', meta: metas.grafana },
    ]);
    expect(callsTo(CONNECTIONS_URL)).toBe(1);
  });

  it('follows the continue token until the last page', async () => {
    const lokiConnection = { ...promConnection, name: 'uid-loki', title: 'Loki', labels: {} };
    routes[CONNECTIONS_URL] = { status: 200, body: { items: [promConnection], metadata: { continue: 'v1_1' } } };
    routes[`${CONNECTIONS_URL}?continue=v1_1`] = { status: 200, body: { items: [lokiConnection] } };
    initDataSourceInstanceSettings({}, '');

    const items = await getDataSourceInstanceList();

    expect(items.map((item) => item.uid)).toEqual(['uid-loki', 'uid-prom', 'grafana']);
    expect(backendGet.mock.calls.map(([, params]) => params)).toEqual([undefined, { continue: 'v1_1' }]);
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

  it('requests through backendSrv without its error toast', async () => {
    initDataSourceInstanceSettings({}, '');

    await getDataSourceInstanceSettings('uid-prom');

    expect(backendGet).toHaveBeenCalledWith(PROM_URL, undefined, undefined, { showErrorAlert: false });
  });

  it('resolves the default ref through the default label', async () => {
    initDataSourceInstanceSettings({}, '');

    expect((await getDataSourceInstanceSettings(null))?.uid).toBe('uid-prom');
  });

  it('serves built-in settings without a per-uid request', async () => {
    initDataSourceInstanceSettings({}, '');

    expect((await getDataSourceInstanceSettings('-- Grafana --'))?.uid).toBe('grafana');
    expect(backendGet.mock.calls.map(([url]) => url)).toEqual([CONNECTIONS_URL]);
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
    expect(logWarning).toHaveBeenCalledWith(MT_SETTINGS_NOT_FOUND_STALE_LIST_WARNING, { uid: 'uid-prom' });
  });

  it('rejects with DataSourceSettingsFetchError on a failed request, and retries on the next lookup', async () => {
    routes[PROM_URL] = { status: 500 };
    initDataSourceInstanceSettings({}, '');

    await expect(getDataSourceInstanceSettings('uid-prom')).rejects.toBeInstanceOf(DataSourceSettingsFetchError);
    expect(logError).toHaveBeenCalledWith(expect.anything(), { uid: 'uid-prom', status: '500' });
    expect(logError.mock.calls[0][0].message).toBe(MT_SETTINGS_FETCH_FAILED);

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
  it('rejects the async APIs with DataSourceListFetchError and logs the failure', async () => {
    routes[CONNECTIONS_URL] = { status: 500 };
    initDataSourceInstanceSettings({}, '');

    await expect(getDataSourceInstanceList()).rejects.toBeInstanceOf(DataSourceListFetchError);
    expect(logError.mock.calls.map(([error]) => error.message)).toContain(MT_FILL_FAILED);
  });

  it('logs whether the failed fill was the boot fill or a later lookup', async () => {
    routes[CONNECTIONS_URL] = { status: 500 };
    initDataSourceInstanceSettings({}, '');

    // Joins the boot fill, so the failure is logged once, as the boot fill's.
    await expect(getDataSourceInstanceList()).rejects.toBeInstanceOf(DataSourceListFetchError);
    // Starts a new fill.
    await expect(getDataSourceInstanceList()).rejects.toBeInstanceOf(DataSourceListFetchError);

    const fillFailures = logError.mock.calls.filter(([error]) => error.message === MT_FILL_FAILED);
    expect(fillFailures.map(([, context]) => context)).toEqual([
      { reason: 'fill', source: 'mt', trigger: 'boot' },
      { reason: 'fill', source: 'mt', trigger: 'lookup' },
    ]);
  });

  it('does not fall back to the legacy DataSourceSrv from getDataSourceInstance', async () => {
    const get = jest.fn().mockResolvedValue({ uid: 'uid-prom' });
    setDataSourceSrv({ get } as unknown as DataSourceSrv);
    setDataSourcePluginImporter(jest.fn());
    routes[CONNECTIONS_URL] = { status: 500 };
    initDataSourceInstanceSettings({}, '');

    await expect(getDataSourceInstance('uid-prom')).rejects.toBeInstanceOf(DataSourceListFetchError);
    expect(get).not.toHaveBeenCalled();
  });

  it('starts a new fill on the next call once the API recovers', async () => {
    routes[CONNECTIONS_URL] = { status: 500 };
    initDataSourceInstanceSettings({}, '');
    await expect(getDataSourceInstanceList()).rejects.toBeInstanceOf(DataSourceListFetchError);

    routes[CONNECTIONS_URL] = { status: 200, body: { items: [promConnection] } };
    const items = await getDataSourceInstanceList();

    expect(items.map((item) => item.uid)).toEqual(['uid-prom', 'grafana']);
    expect(callsTo(CONNECTIONS_URL)).toBe(2);
  });
});

describe('overlapping list fetches', () => {
  const lokiConnection: DataSourceConnection = { ...promConnection, name: 'uid-loki', title: 'Loki', labels: {} };
  const lokiUrl = '/apis/prometheus.datasource.grafana.app/v0alpha1/namespaces/default/datasources/uid-loki';
  const cancelled = () => Object.assign(new Error('Request was aborted'), { cancelled: true, status: -1, data: null });

  it('loads the settings of a data source that a refresh added while an older fill was in flight', async () => {
    const olderFill = deferred<unknown>();
    backendGet.mockImplementationOnce(() => olderFill.promise);
    initDataSourceInstanceSettings({}, '');
    await flushPromises();
    expect(callsTo(CONNECTIONS_URL)).toBe(1);

    routes[CONNECTIONS_URL] = { status: 200, body: { items: [promConnection, lokiConnection] } };
    routes[lokiUrl] = { status: 200, body: { metadata: { name: 'uid-loki' }, spec: { title: 'Loki', jsonData: {} } } };
    await syncDataSourceInstanceSettings({ datasources: {}, defaultDatasource: '' });
    olderFill.resolve({ items: [promConnection] });
    await flushPromises();

    expect((await getDataSourceInstanceSettings('uid-loki'))?.name).toBe('Loki');
  });

  it('gives the callers of a replaced fetch the newer list, and does not log the cancelled request', async () => {
    const older = deferred<unknown>();
    backendGet.mockImplementationOnce(() => older.promise);
    const source = new MTDataSource();

    const first = source.loadList();
    await flushPromises();
    routes[CONNECTIONS_URL] = { status: 200, body: { items: [promConnection, lokiConnection] } };
    const second = source.refreshList();
    older.reject(cancelled());

    const [firstSnapshot, secondSnapshot] = await Promise.all([first, second]);
    expect(firstSnapshot).toBe(secondSnapshot);
    expect(firstSnapshot.items.map((item) => item.uid)).toEqual(['uid-prom', 'uid-loki', 'grafana']);
    const [firstRequestId, secondRequestId] = backendGet.mock.calls.map(([, , requestId]) => requestId);
    expect(firstRequestId).toEqual(expect.any(String));
    expect(secondRequestId).toBe(firstRequestId);
    expect(logError).not.toHaveBeenCalled();
    expect(cachedPromiseLogError).not.toHaveBeenCalled();
  });

  it('joins the fetch in flight for loadList', async () => {
    const source = new MTDataSource();

    const [first, second] = await Promise.all([source.loadList(), source.loadList()]);

    expect(first).toBe(second);
    expect(callsTo(CONNECTIONS_URL)).toBe(1);
  });

  it('stops a replaced fetch before its next page', async () => {
    const olderFirstPage = deferred<unknown>();
    backendGet.mockImplementationOnce(() => olderFirstPage.promise);
    const source = new MTDataSource();

    const first = source.loadList();
    await flushPromises();
    const second = source.refreshList();
    olderFirstPage.resolve({ items: [promConnection], metadata: { continue: 'v1_1' } });
    await Promise.all([first, second]);

    expect(backendGet.mock.calls.map(([, params]) => params)).toEqual([undefined, undefined]);
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

describe('API versions from discovery', () => {
  const PROM_V1BETA1_URL = '/apis/prometheus.datasource.grafana.app/v1beta1/namespaces/default/datasources/uid-prom';
  const postgres = meta('grafana-postgresql-datasource', 'PostgreSQL', { aliasIDs: ['postgres'] });
  const pgConnection: DataSourceConnection = {
    title: 'PG',
    name: 'uid-pg',
    group: 'postgres.datasource.grafana.app',
    plugin: 'postgres',
  };
  const pgResource: DataSourceResource = { metadata: { name: 'uid-pg' }, spec: { title: 'PG', jsonData: {} } };

  function discoveryCalls(): string[] {
    return backendGet.mock.calls.map(([url]) => url).filter((url) => url === '/apis' || url.endsWith('/'));
  }

  it('loads the settings from the preferred version of a promoted group', async () => {
    setAPIDiscoveryForTesting([
      served('query.grafana.app'),
      served('prometheus.datasource.grafana.app', ['v1beta1', 'v0alpha1']),
    ]);
    routes[PROM_V1BETA1_URL] = { status: 200, body: promResource };
    initDataSourceInstanceSettings({}, '');

    expect((await getDataSourceInstanceSettings('uid-prom'))?.name).toBe('Prom');
    expect(callsTo(PROM_V1BETA1_URL)).toBe(1);
    expect(callsTo(PROM_URL)).toBe(0);
  });

  it('lists connections from the preferred version of a promoted query.grafana.app', async () => {
    const promotedConnectionsUrl = '/apis/query.grafana.app/v1beta1/namespaces/default/connections';
    setAPIDiscoveryForTesting([
      served('query.grafana.app', ['v1beta1', 'v0alpha1']),
      served('prometheus.datasource.grafana.app'),
    ]);
    routes[promotedConnectionsUrl] = routes[CONNECTIONS_URL];
    initDataSourceInstanceSettings({}, '');

    expect((await getDataSourceInstanceList()).map((item) => item.uid)).toEqual(['uid-prom', 'grafana']);
    expect(callsTo(promotedConnectionsUrl)).toBe(1);
    expect(callsTo(CONNECTIONS_URL)).toBe(0);
  });

  it('resolves an aliased plugin type through the group of its canonical plugin id', async () => {
    const canonicalUrl =
      '/apis/grafana-postgresql-datasource.datasource.grafana.app/v0alpha1/namespaces/default/datasources/uid-pg';
    setDatasourcePluginMetas({ ...metas, postgres });
    setAPIDiscoveryForTesting([...defaultDiscovery, served('grafana-postgresql-datasource.datasource.grafana.app')]);
    routes[CONNECTIONS_URL] = { status: 200, body: { items: [promConnection, pgConnection] } };
    routes[canonicalUrl] = { status: 200, body: pgResource };
    initDataSourceInstanceSettings({}, '');

    expect((await getDataSourceInstanceList()).map((item) => item.uid)).toEqual(['uid-pg', 'uid-prom', 'grafana']);
    expect((await getDataSourceInstanceSettings('uid-pg'))?.type).toBe('grafana-postgresql-datasource');
    expect(callsTo(canonicalUrl)).toBe(1);
  });

  it('keeps a data source whose group is not served out of the list and lookups, without requesting it', async () => {
    setAPIDiscoveryForTesting([served('query.grafana.app')]);
    initDataSourceInstanceSettings({}, '');

    expect((await getDataSourceInstanceList({ all: true })).map((item) => item.uid)).toEqual(['grafana']);
    expect(await getDataSourceInstanceListItem('uid-prom')).toBeUndefined();
    expect(await getDataSourceInstanceSettings('uid-prom')).toBeUndefined();
    // Like an orphan, a dropped default leaves -- Grafana -- as the default.
    expect((await getDataSourceInstanceSettings(null))?.uid).toBe('grafana');
    expect(backendGet.mock.calls.map(([url]) => url)).toEqual([CONNECTIONS_URL]);
    expect(logWarning).toHaveBeenCalledWith(MT_GROUP_NOT_SERVED_DROPPED_WARNING, {
      count: '1',
      groups: 'prometheus.datasource.grafana.app',
    });
  });

  it('drops a data source whose group is served in no version this client supports', async () => {
    setAPIDiscoveryForTesting([served('query.grafana.app'), served('prometheus.datasource.grafana.app', ['v2'])]);
    initDataSourceInstanceSettings({}, '');

    expect((await getDataSourceInstanceList()).map((item) => item.uid)).toEqual(['grafana']);
    expect(callsTo(PROM_URL)).toBe(0);
  });

  it('falls back to v0alpha1 and logs once when discovery cannot answer', async () => {
    invalidateAPIDiscovery();
    const lokiConnection = { ...promConnection, name: 'uid-loki', title: 'Loki', labels: {} };
    const lokiUrl = '/apis/prometheus.datasource.grafana.app/v0alpha1/namespaces/default/datasources/uid-loki';
    routes['/apis'] = { status: 500 };
    routes['/apis/query.grafana.app/'] = { status: 500 };
    routes['/apis/prometheus.datasource.grafana.app/'] = { status: 500 };
    routes[CONNECTIONS_URL] = { status: 200, body: { items: [promConnection, lokiConnection] } };
    routes[lokiUrl] = { status: 200, body: { metadata: { name: 'uid-loki' }, spec: { title: 'Loki', jsonData: {} } } };
    initDataSourceInstanceSettings({}, '');

    expect((await getDataSourceInstanceList()).map((item) => item.uid)).toEqual(['uid-loki', 'uid-prom', 'grafana']);
    // The data source groups reuse the unknown answer instead of asking again.
    expect(discoveryCalls()).toEqual(['/apis', '/apis/query.grafana.app/']);
    const discoveryCallsAfterFill = discoveryCalls().length;
    expect((await getDataSourceInstanceSettings('uid-prom'))?.name).toBe('Prom');
    expect((await getDataSourceInstanceSettings('uid-loki'))?.name).toBe('Loki');
    // Unknown answers are not cached, so the settings loads reuse the fill's URLs instead of asking again.
    expect(discoveryCalls()).toHaveLength(discoveryCallsAfterFill);
    const unknownWarnings = logWarning.mock.calls.filter(([message]) => message === MT_API_DISCOVERY_UNKNOWN_WARNING);
    expect(unknownWarnings).toEqual([[MT_API_DISCOVERY_UNKNOWN_WARNING, { group: 'query.grafana.app' }]]);
  });

  it('fails the fill without requesting connections when query.grafana.app is not served', async () => {
    setAPIDiscoveryForTesting([served('prometheus.datasource.grafana.app')]);
    initDataSourceInstanceSettings({}, '');

    await expect(getDataSourceInstanceList()).rejects.toBeInstanceOf(DataSourceListFetchError);
    expect(backendGet).not.toHaveBeenCalled();
    expect(logError.mock.calls.map(([error]) => error.message)).toContain(MT_FILL_FAILED);
  });

  it('shares one discovery request between the fill and every settings load', async () => {
    invalidateAPIDiscovery();
    const lokiConnection: DataSourceConnection = {
      title: 'Loki',
      name: 'uid-loki',
      group: 'loki.datasource.grafana.app',
      plugin: 'loki',
    };
    const lokiUrl = '/apis/loki.datasource.grafana.app/v0alpha1/namespaces/default/datasources/uid-loki';
    const promConnections = ['uid-prom', 'uid-prom-2', 'uid-prom-3'].map((name) => ({
      ...promConnection,
      name,
      title: name,
    }));
    setDatasourcePluginMetas({ ...metas, loki: meta('loki', 'Loki') });
    const groupVersion = (name: string) => ({
      name,
      versions: [{ groupVersion: `${name}/v0alpha1`, version: 'v0alpha1' }],
    });
    routes['/apis'] = {
      status: 200,
      body: {
        groups: [
          groupVersion('query.grafana.app'),
          groupVersion('prometheus.datasource.grafana.app'),
          groupVersion('loki.datasource.grafana.app'),
        ],
      },
    };
    routes[CONNECTIONS_URL] = { status: 200, body: { items: [...promConnections, lokiConnection] } };
    routes[lokiUrl] = { status: 200, body: { metadata: { name: 'uid-loki' }, spec: { title: 'Loki', jsonData: {} } } };
    initDataSourceInstanceSettings({}, '');

    expect(await getDataSourceInstanceList()).toHaveLength(5);
    await Promise.all([getDataSourceInstanceSettings('uid-prom'), getDataSourceInstanceSettings('uid-loki')]);

    expect(discoveryCalls()).toEqual(['/apis']);
  });
});
