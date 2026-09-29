import { isEqual } from 'lodash';

import { type DataSourceInstanceListItem, type DataSourceInstanceSettings } from '@grafana/data';

import { config } from '../../config';
import {
  getCachedPromise,
  getFetchErrorContext,
  getOriginMessage,
  invalidateCachedPromise,
} from '../../utils/getCachedPromise';
import { getDataSourceSrv } from '../dataSourceSrv';
import { getDatasourcePluginMetas } from '../pluginMeta/datasources';

import {
  type DataSourceConnectionDescriptor,
  fetchDataSourceConnections,
  fetchDataSourceSettings,
  getDataSourceConnectionsUrl,
  getDataSourceSettingsUrl,
} from './api';
import { notifyDataSourceCacheChanged } from './cacheGeneration';
import {
  DATASOURCE_CONNECTION_MISSING_PLUGIN_WARNING,
  FALLBACK_TO_BOOTDATA_LIST_WARNING,
  FALLBACK_TO_BOOTDATA_SETTINGS_WARNING,
} from './constants';
import { createInstanceSettingsCache } from './instanceSettingsCache';
import { logDataSourceWarning } from './logging';
import { type DataSourceSettingsCacheProvider } from './settingsCacheProvider';

const INITIALIZATION_CACHE_KEY = 'grafana-runtime:ds-initialization';
const SETTINGS_CACHE_KEY_PREFIX = 'grafana-runtime:ds-settings';

export function createApiCacheProvider(
  settings: Record<string, DataSourceInstanceSettings>,
  defaultName: string
): DataSourceSettingsCacheProvider {
  const cache = createInstanceSettingsCache();
  let initializationPromise: Promise<void> | undefined;
  let connectionsByUid: Record<string, DataSourceConnectionDescriptor> = {};
  const settingsCacheKeys = new Set<string>();
  let generation = 0;

  function connectionsRouteEnabled(): boolean {
    // These flags register and enable the route at process startup, so checking the
    // boot-time values avoids requests that are guaranteed to return 404 or 501.
    // eslint-disable-next-line @grafana/no-config-feature-toggles
    const queryServiceEnabled = config.featureToggles.queryService;
    // eslint-disable-next-line @grafana/no-config-feature-toggles
    const experimentalApiServerEnabled = config.featureToggles.grafanaAPIServerWithExperimentalAPIs;
    // eslint-disable-next-line @grafana/no-config-feature-toggles
    const connectionsEnabled = config.featureToggles.queryServiceWithConnections;
    return Boolean((queryServiceEnabled || experimentalApiServerEnabled) && connectionsEnabled);
  }

  function invalidateSettingsRequests(): void {
    for (const key of settingsCacheKeys) {
      invalidateCachedPromise(key);
    }
    settingsCacheKeys.clear();
    connectionsByUid = {};
  }

  function listItemForComparison(item: DataSourceInstanceListItem) {
    return {
      uid: item.uid,
      name: item.name,
      type: item.type,
      apiVersion: item.apiVersion,
      isDefault: item.isDefault,
      pluginId: item.meta.id,
    };
  }

  function compareByUid(a: { uid: string }, b: { uid: string }): number {
    return a.uid > b.uid ? 1 : a.uid < b.uid ? -1 : 0;
  }

  function validateStartupParity(items: DataSourceInstanceListItem[]): void {
    const expected = cache.getBootSettingsList().map(toListItem).map(listItemForComparison).sort(compareByUid);
    const actual = items.map(listItemForComparison).sort(compareByUid);
    if (!isEqual(actual, expected)) {
      throw new Error('datasource-list-parity-mismatch');
    }
  }

  async function loadAndCommitConnections(operation: 'startup' | 'reload', generation: number): Promise<void> {
    if (!connectionsRouteEnabled()) {
      activateBootDataFallback(generation, operation, 'prerequisites-disabled');
      return;
    }

    try {
      const [response, metas] = await Promise.all([fetchDataSourceConnections(), getDatasourcePluginMetas()]);
      const metaById = new Map(metas.map((meta) => [meta.id, meta]));
      const metaByAlias = new Map(metas.flatMap((meta) => (meta.aliasIDs ?? []).map((alias) => [alias, meta])));
      const items: DataSourceInstanceListItem[] = [];
      const connections: Record<string, DataSourceConnectionDescriptor> = {};

      for (const connection of response.items ?? []) {
        if (!connection.plugin) {
          logDataSourceWarning(DATASOURCE_CONNECTION_MISSING_PLUGIN_WARNING, {
            dataSourceUid: connection.name,
            dataSourceName: connection.title,
            operation,
            requestUrl: getDataSourceConnectionsUrl(),
          });
          continue;
        }

        const meta = metaById.get(connection.plugin) ?? metaByAlias.get(connection.plugin);
        if (!meta) {
          continue;
        }

        const item: DataSourceInstanceListItem = {
          uid: connection.name,
          name: connection.title,
          type: meta.id,
          meta,
          isDefault: connection.title === cache.getDefaultName(),
        };
        items.push(item);
        connections[item.uid] = { group: connection.group, version: connection.version };
      }

      // Built-ins have no connections rows; preserve their identity from boot data.
      for (const boot of cache.getBootSettingsList().filter(isBuiltInSettings)) {
        const meta = metaById.get(boot.meta.id) ?? boot.meta;
        items.push({ ...toListItem(boot), meta });
      }

      if (operation === 'startup') {
        validateStartupParity(items);
      }
      if (generation !== currentGeneration()) {
        return;
      }

      connectionsByUid = connections;
      cache.commitList(items);
      notifyDataSourceCacheChanged();
    } catch (error) {
      activateBootDataFallback(generation, operation, getOriginMessage(error) || 'request-failed', error);
    }
  }

  function activateBootDataFallback(
    generation: number,
    operation: 'startup' | 'reload',
    reason: string,
    error?: unknown
  ): void {
    if (generation !== currentGeneration()) {
      return;
    }

    if (operation === 'startup') {
      cache.activateBootData();
    }
    notifyDataSourceCacheChanged();
    logDataSourceWarning(FALLBACK_TO_BOOTDATA_LIST_WARNING, {
      operation,
      reason,
      requestUrl: getDataSourceConnectionsUrl(),
      ...getFetchErrorContext(error),
    });
  }

  function startInitialization(operation: 'startup' | 'reload'): Promise<void> {
    const generation = currentGeneration();
    return getCachedPromise(() => loadAndCommitConnections(operation, generation), {
      cacheKey: INITIALIZATION_CACHE_KEY,
    });
  }

  async function refreshCache(): Promise<void> {
    generation++;
    cache.clearSettings();
    invalidateCachedPromise(INITIALIZATION_CACHE_KEY);
    invalidateSettingsRequests();
    initializationPromise = startInitialization('reload');
    await initializationPromise;
  }

  function currentGeneration(): number {
    return generation;
  }

  function getFallbackSettings(uid: string): DataSourceInstanceSettings | undefined {
    return getDataSourceSrv()?.getInstanceSettings(uid) ?? cache.getBootSettingsByUid(uid);
  }

  function isBuiltInType(type: string): boolean {
    return type === 'grafana' || type === 'mixed' || type === 'dashboard';
  }

  function syncCache(): void {
    void refreshCache().catch((error) => {
      logDataSourceWarning(FALLBACK_TO_BOOTDATA_LIST_WARNING, {
        operation: 'reload',
        reason: getOriginMessage(error) || 'refresh-failed',
        requestUrl: getDataSourceConnectionsUrl(),
        ...getFetchErrorContext(error),
      });
    });
  }

  function isBuiltInSettings(settings: DataSourceInstanceSettings): boolean {
    return settings.meta.id === 'grafana' || settings.meta.id === 'mixed' || settings.meta.id === 'dashboard';
  }

  function toListItem(settings: DataSourceInstanceSettings): DataSourceInstanceListItem {
    return {
      uid: settings.uid || settings.name,
      type: settings.type,
      apiVersion: settings.apiVersion,
      name: settings.name,
      meta: settings.meta,
      isDefault: settings.isDefault ?? false,
    };
  }

  function settingsHaveParity(actual: DataSourceInstanceSettings, expected: DataSourceInstanceSettings): boolean {
    return isEqual(settingsForComparison(actual), settingsForComparison(expected));
  }

  function settingsForComparison(settings: DataSourceInstanceSettings) {
    return {
      id: settings.id,
      uid: settings.uid,
      type: settings.type,
      apiVersion: settings.apiVersion,
      name: settings.name,
      cachingConfig: settings.cachingConfig,
      readOnly: settings.readOnly,
      url: settings.url,
      jsonData: settings.jsonData,
      username: settings.username,
      password: settings.password,
      database: settings.database,
      isDefault: settings.isDefault ?? false,
      access: settings.access,
      basicAuth: settings.basicAuth,
      withCredentials: settings.withCredentials,
    };
  }

  function logSettingsFallback(
    item: DataSourceInstanceListItem,
    descriptor: DataSourceConnectionDescriptor,
    reason: string,
    error?: unknown
  ): void {
    logDataSourceWarning(FALLBACK_TO_BOOTDATA_SETTINGS_WARNING, {
      operation: 'settings',
      reason,
      pluginType: item.type,
      requestUrl: getDataSourceSettingsUrl(item.uid, descriptor),
      ...getFetchErrorContext(error),
    });
  }

  cache.setBootData(settings, defaultName);
  cache.clearSettings();
  generation++;
  initializationPromise = startInitialization('startup');
  void initializationPromise.catch((error) => {
    logDataSourceWarning(FALLBACK_TO_BOOTDATA_LIST_WARNING, {
      operation: 'startup',
      reason: getOriginMessage(error) || 'initialization-failed',
      requestUrl: getDataSourceConnectionsUrl(),
      ...getFetchErrorContext(error),
    });
  });

  return {
    ...cache,
    source: 'api',
    async waitUntilReady() {
      await initializationPromise;
    },
    async refreshSettings(uid, type) {
      await initializationPromise;
      const item = cache.getListItemByUid(uid);
      const descriptor = connectionsByUid[uid];

      if (!descriptor || !item) {
        const cacheKey = `${SETTINGS_CACHE_KEY_PREFIX}:${generation}:${uid}`;
        settingsCacheKeys.add(cacheKey);
        return getCachedPromise(
          async () => {
            const fallback = getFallbackSettings(uid);
            if (!isBuiltInType(type)) {
              logDataSourceWarning(FALLBACK_TO_BOOTDATA_SETTINGS_WARNING, {
                operation: 'settings',
                reason: 'connection-not-found',
                pluginType: type,
                requestUrl: getDataSourceConnectionsUrl(),
              });
            }
            return fallback ? cache.upsertSettings(fallback) : undefined;
          },
          { cacheKey }
        );
      }

      const requestGeneration = currentGeneration();
      const cacheKey = `${SETTINGS_CACHE_KEY_PREFIX}:${requestGeneration}:${uid}`;
      settingsCacheKeys.add(cacheKey);
      return getCachedPromise(
        async () => {
          try {
            const settings = await fetchDataSourceSettings(item, descriptor);
            const fallback = getFallbackSettings(uid);
            if (fallback && !settingsHaveParity(settings, fallback)) {
              logSettingsFallback(item, descriptor, 'datasource-settings-parity-mismatch');
              return requestGeneration === currentGeneration() ? cache.upsertSettings(fallback) : fallback;
            }
            return requestGeneration === currentGeneration() ? cache.upsertSettings(settings) : settings;
          } catch (error) {
            const fallback = getFallbackSettings(uid);
            logSettingsFallback(item, descriptor, getOriginMessage(error) || 'request-failed', error);
            if (!fallback) {
              return undefined;
            }
            return requestGeneration === currentGeneration() ? cache.upsertSettings(fallback) : fallback;
          }
        },
        { cacheKey }
      );
    },
    refreshList: refreshCache,
    sync() {
      syncCache();
    },
    reset() {
      invalidateCachedPromise(INITIALIZATION_CACHE_KEY);
      invalidateSettingsRequests();
      initializationPromise = undefined;
      generation++;
      cache.reset();
    },
  };
}
