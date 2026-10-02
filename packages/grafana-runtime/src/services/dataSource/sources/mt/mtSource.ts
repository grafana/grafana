import { type DataSourceInstanceListItem, type DataSourceInstanceSettings } from '@grafana/data';

import { getDatasourcePluginMetas } from '../../../pluginMeta/datasources';
import {
  DIRECT_ACCESS_UNSUPPORTED_WARNING,
  MISSING_PLUGIN_DROPPED_WARNING,
  MT_FILL_FAILED,
  SETTINGS_FETCH_FAILED,
  SETTINGS_NOT_FOUND_STALE_LIST_WARNING,
} from '../../constants';
import { DataSourceCacheFillError, DataSourceSettingsFetchError } from '../../errors';
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
export class MTDataSource implements DataSourceCacheSource {
  readonly kind = 'mt';
  // The last list response, kept to find the API group and version of a uid.
  private connectionsByUid = new Map<string, DataSourceConnection>();
  private itemsByUid = new Map<string, DataSourceInstanceListItem>();
  private loggedDirectAccess = new Set<string>();

  getInitialSnapshot(): undefined {
    return undefined;
  }

  loadList(): Promise<DataSourceListSnapshot> {
    return this.fetchAndBuild();
  }

  async refreshList(): Promise<DataSourceListSnapshot> {
    try {
      return await this.fetchAndBuild();
    } catch (error) {
      logDataSourceInstanceError(MT_FILL_FAILED, error, { reason: 'reload', source: this.kind });
      throw new DataSourceCacheFillError(error);
    }
  }

  async loadSettings(uid: string): Promise<DataSourceInstanceSettings | undefined> {
    const connection = this.connectionsByUid.get(uid);
    const item = this.itemsByUid.get(uid);
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
    if (isDirectAccess && !this.loggedDirectAccess.has(uid)) {
      this.loggedDirectAccess.add(uid);
      logDataSourceWarning(DIRECT_ACCESS_UNSUPPORTED_WARNING, { uid, type: settings.type });
    }
    return settings;
  }

  private async fetchAndBuild(): Promise<DataSourceListSnapshot> {
    const list = await fetchConnections();
    return this.buildSnapshot(list.items ?? []);
  }

  private async buildSnapshot(latest: DataSourceConnection[]): Promise<DataSourceListSnapshot> {
    const metas = await getDatasourcePluginMetas();
    const { snapshot, droppedTypes } = toListSnapshot(latest, metas);

    if (droppedTypes.length > 0) {
      logDataSourceWarning(MISSING_PLUGIN_DROPPED_WARNING, {
        count: String(droppedTypes.length),
        types: Array.from(new Set(droppedTypes)).slice(0, MAX_LOGGED_TYPES).join(','),
      });
    }

    this.connectionsByUid = new Map(latest.map((connection) => [connection.name, connection]));
    this.itemsByUid = new Map(snapshot.items.map((item) => [item.uid, item]));
    return snapshot;
  }
}
