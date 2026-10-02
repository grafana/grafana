import { type DataSourceInstanceListItem } from '@grafana/data';

import { getDatasourcePluginMetas } from '../../../pluginMeta/datasources';
import {
  DIRECT_ACCESS_UNSUPPORTED_WARNING,
  MISSING_PLUGIN_DROPPED_WARNING,
  SETTINGS_FETCH_FAILED,
  SETTINGS_NOT_FOUND_STALE_LIST_WARNING,
} from '../../constants';
import { DataSourceSettingsFetchError } from '../../errors';
import { logDataSourceInstanceError, logDataSourceWarning } from '../../logging';
import { type DataSourceCacheSource, type DataSourceListSnapshot } from '../types';

import { fetchConnections, fetchDataSourceResource, MTRequestError } from './api';
import { toInstanceSettings, toListSnapshot } from './mappers';
import { type DataSourceConnection } from './types';

const MAX_LOGGED_TYPES = 20;

/**
 * Fills the cache from the MT APIs: the list from `connections` joined with the plugin metas, and
 * the settings on demand, one request per uid.
 */
export function createMTDataSource(): DataSourceCacheSource {
  // The last list response, kept to find the API group and version of a uid.
  let connectionsByUid = new Map<string, DataSourceConnection>();
  let itemsByUid = new Map<string, DataSourceInstanceListItem>();
  const loggedDirectAccess = new Set<string>();

  async function buildSnapshot(latest: DataSourceConnection[]): Promise<DataSourceListSnapshot> {
    const metas = await getDatasourcePluginMetas();
    const { snapshot, droppedTypes } = toListSnapshot(latest, metas);

    if (droppedTypes.length > 0) {
      logDataSourceWarning(MISSING_PLUGIN_DROPPED_WARNING, {
        count: String(droppedTypes.length),
        types: Array.from(new Set(droppedTypes)).slice(0, MAX_LOGGED_TYPES).join(','),
      });
    }

    connectionsByUid = new Map(latest.map((connection) => [connection.name, connection]));
    itemsByUid = new Map(snapshot.items.map((item) => [item.uid, item]));
    return snapshot;
  }

  async function fetchAndBuild(): Promise<DataSourceListSnapshot> {
    const list = await fetchConnections();
    return buildSnapshot(list.items ?? []);
  }

  return {
    kind: 'mt',
    getInitialSnapshot: () => undefined,
    loadList: fetchAndBuild,
    refreshList: fetchAndBuild,
    loadSettings: async (uid) => {
      const connection = connectionsByUid.get(uid);
      const item = itemsByUid.get(uid);
      if (!connection || !item) {
        return undefined;
      }

      let resource;
      try {
        resource = await fetchDataSourceResource(connection);
      } catch (error) {
        logDataSourceInstanceError(SETTINGS_FETCH_FAILED, error, {
          uid,
          status: error instanceof MTRequestError ? String(error.status) : 'network',
        });
        throw new DataSourceSettingsFetchError(uid, error);
      }

      if (!resource) {
        logDataSourceWarning(SETTINGS_NOT_FOUND_STALE_LIST_WARNING, { uid });
        return undefined;
      }

      const { settings, isDirectAccess } = toInstanceSettings(resource, item, connection);
      if (isDirectAccess && !loggedDirectAccess.has(uid)) {
        loggedDirectAccess.add(uid);
        logDataSourceWarning(DIRECT_ACCESS_UNSUPPORTED_WARNING, { uid, type: settings.type });
      }
      return settings;
    },
  };
}
