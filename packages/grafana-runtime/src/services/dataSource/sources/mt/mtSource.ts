import {
  type DataSourceInstanceListItem,
  type DataSourceInstanceSettings,
  type DataSourcePluginMeta,
} from '@grafana/data';

import { getCachedPromise, invalidateCachedPromise } from '../../../../utils/getCachedPromise';
import { isFetchError } from '../../../backendSrv';
import { getDatasourcePluginMetas } from '../../../pluginMeta/datasources';
import {
  DIRECT_ACCESS_UNSUPPORTED_WARNING,
  MISSING_PLUGIN_DROPPED_WARNING,
  MT_FILL_FAILED,
  MT_SETTINGS_FETCH_FAILED,
  MT_SETTINGS_NOT_FOUND_STALE_LIST_WARNING,
} from '../../constants';
import { DataSourceListFetchError, DataSourceSettingsFetchError } from '../../errors';
import { logDataSourceInstanceError, logDataSourceWarning } from '../../logging';
import { type DataSourceCacheSource, type DataSourceListSnapshot } from '../types';

import {
  fetchConnections as fetchViaConnections,
  type FetchConnectionsOptions,
  fetchConnectionsFromGroups,
  fetchDataSourceResource,
} from './api';
import { toInstanceSettings, toListSnapshot } from './mappers';
import { type DataSourceConnection, type DataSourceConnectionList } from './types';

const MAX_LOGGED_TYPES = 20;

let instanceCount = 0;

// The cached list fetch resolves with its outcome instead of rejecting, so getCachedPromise does
// not log a failure that the cache logs already.
type ListFetchResult =
  | { status: 'done'; snapshot: DataSourceListSnapshot }
  | { status: 'failed'; error: unknown }
  | { status: 'superseded' };

/**
 * Fills the cache from the MT APIs: the list from `connections` joined with the plugin metas, and
 * the settings on demand, one request per uid.
 */
/**
 * How a source lists every data source. `connections` is one request but is backed by the legacy
 * data source service; the per-group fetcher reads what each plugin serves. See
 * {@link fetchConnectionsFromGroups}.
 */
export type ConnectionsFetcher = (options: FetchConnectionsOptions) => Promise<DataSourceConnectionList | undefined>;

/** Reads the API group each installed plugin serves. See {@link fetchConnectionsFromGroups}. */
export const fetchConnectionsViaApiGroups: ConnectionsFetcher = async (options) =>
  fetchConnectionsFromGroups(await getDatasourcePluginMetas(), options);

export class MTDataSource implements DataSourceCacheSource {
  readonly kind = 'mt';
  // The list of the latest list fetch, kept to find the API group and version of a uid. Only the
  // latest fetch writes it, so it always matches the list that the cache applies.
  private connectionsByUid = new Map<string, DataSourceConnection>();
  private itemsByUid = new Map<string, DataSourceInstanceListItem>();
  private loggedDirectAccess = new Set<string>();
  // Per instance, so a list fetch of an earlier instance is never joined or cancelled.
  private readonly listKey = `grafana-runtime:ds-cache-mt-list:${++instanceCount}`;
  private listGeneration = 0;
  private latestList?: Promise<ListFetchResult>;

  /**
   * @param fetchConnections how to list the data sources. Defaults to the connections endpoint; pass
   * {@link fetchConnectionsViaApiGroups} to read the API groups instead, which is the only way to
   * see a data source that lives only in unified storage.
   */
  constructor(private readonly fetchConnections: ConnectionsFetcher = fetchViaConnections) {}

  getInitialSnapshot(): undefined {
    return undefined;
  }

  /** Joins the list fetch in flight, if there is one. */
  loadList(): Promise<DataSourceListSnapshot> {
    return this.getList(false);
  }

  /**
   * Always starts a new list fetch, because the list in flight can be older than the data source
   * change that caused the refresh. The new fetch cancels the old one, and every caller of the old
   * one gets the new result.
   */
  async refreshList(): Promise<DataSourceListSnapshot> {
    try {
      return await this.getList(true);
    } catch (error) {
      logDataSourceInstanceError(MT_FILL_FAILED, error, { reason: 'reload', source: this.kind });
      throw new DataSourceListFetchError(error);
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
      logDataSourceInstanceError(MT_SETTINGS_FETCH_FAILED, error, {
        uid,
        status: isFetchError(error) ? String(error.status) : 'network',
      });
      throw new DataSourceSettingsFetchError(uid, error);
    }

    if (!resource) {
      logDataSourceWarning(MT_SETTINGS_NOT_FOUND_STALE_LIST_WARNING, { uid });
      return undefined;
    }

    const { settings, isDirectAccess } = toInstanceSettings(resource, item, connection);
    if (isDirectAccess && !this.loggedDirectAccess.has(uid)) {
      this.loggedDirectAccess.add(uid);
      logDataSourceWarning(DIRECT_ACCESS_UNSUPPORTED_WARNING, { uid, type: settings.type });
    }
    return settings;
  }

  private getList(replace: boolean): Promise<DataSourceListSnapshot> {
    const generation = this.listGeneration;
    const fetchList = () => this.fetchList(++this.listGeneration);
    const pending = getCachedPromise(fetchList, { cacheKey: this.listKey, invalidate: replace });
    if (this.listGeneration !== generation) {
      this.latestList = pending;
    }
    return this.settleList(pending);
  }

  private async settleList(pending: Promise<ListFetchResult>): Promise<DataSourceListSnapshot> {
    const result = await pending;
    if (result.status === 'superseded' && this.latestList && this.latestList !== pending) {
      return this.settleList(this.latestList);
    }
    if (result.status === 'done') {
      return result.snapshot;
    }
    throw result.status === 'failed' ? result.error : new Error('DataSource: the MT list fetch was superseded');
  }

  private async fetchList(generation: number): Promise<ListFetchResult> {
    const isCurrent = () => generation === this.listGeneration;
    try {
      const list = await this.fetchConnections({ requestId: this.listKey, isCurrent });
      if (!list) {
        return { status: 'superseded' };
      }
      const metas = await getDatasourcePluginMetas();
      if (!isCurrent()) {
        return { status: 'superseded' };
      }
      return { status: 'done', snapshot: this.buildSnapshot(list.items ?? [], metas) };
    } catch (error) {
      // A newer fetch cancels this one's request, so a failure of a replaced fetch is expected.
      return isCurrent() ? { status: 'failed', error } : { status: 'superseded' };
    } finally {
      // Settled fetches are not reused. A replaced fetch must not drop the newer cache entry.
      if (isCurrent()) {
        invalidateCachedPromise(this.listKey);
      }
    }
  }

  private buildSnapshot(latest: DataSourceConnection[], metas: DataSourcePluginMeta[]): DataSourceListSnapshot {
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
