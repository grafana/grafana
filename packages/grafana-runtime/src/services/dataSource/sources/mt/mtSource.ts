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
  MT_API_DISCOVERY_UNKNOWN_WARNING,
  MT_FILL_FAILED,
  MT_GROUP_NOT_SERVED_DROPPED_WARNING,
  MT_SETTINGS_FETCH_FAILED,
  MT_SETTINGS_NOT_FOUND_STALE_LIST_WARNING,
} from '../../constants';
import { DataSourceListFetchError, DataSourceSettingsFetchError } from '../../errors';
import { logDataSourceInstanceError, logDataSourceWarning } from '../../logging';
import { type DataSourceCacheSource, type DataSourceListSnapshot } from '../types';

import { fetchConnections, fetchDataSourceResource, getLegacyMTApiBaseUrl, resolveMTApiBaseUrl } from './api';
import { getDataSourceGroupsByUid, toInstanceSettings, toListSnapshot } from './mappers';
import { type DataSourceConnection } from './types';

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
export class MTDataSource implements DataSourceCacheSource {
  readonly kind = 'mt';
  // The list of the latest list fetch, kept to find the API group and version of a uid. Only the
  // latest fetch writes it, so it always matches the list that the cache applies.
  private connectionsByUid = new Map<string, DataSourceConnection>();
  private baseUrlsByUid = new Map<string, string | undefined>();
  private itemsByUid = new Map<string, DataSourceInstanceListItem>();
  private loggedDirectAccess = new Set<string>();
  private loggedDiscoveryUnknown = false;
  // Per instance, so a list fetch of an earlier instance is never joined or cancelled.
  private readonly listKey = `grafana-runtime:ds-cache-mt-list:${++instanceCount}`;
  private listGeneration = 0;
  private latestList?: Promise<ListFetchResult>;

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
    const baseUrl = this.baseUrlsByUid.get(uid);
    const item = this.itemsByUid.get(uid);
    if (!connection || !baseUrl || !item) {
      return undefined;
    }

    let resource;
    try {
      resource = await fetchDataSourceResource(baseUrl, uid);
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
    let discoveryUnknown = false;
    const onDiscoveryUnknown = (group: string) => {
      discoveryUnknown = true;
      this.logDiscoveryUnknown(group);
    };
    try {
      const list = await fetchConnections({ requestId: this.listKey, isCurrent, onDiscoveryUnknown });
      if (!list) {
        return { status: 'superseded' };
      }
      const metas = await getDatasourcePluginMetas();
      const connections = list.items ?? [];
      const groupsByUid = getDataSourceGroupsByUid(connections, metas);
      // Discovery never caches an unknown answer, so asking again in this fill would only repeat its timeouts.
      const resolveBaseUrl = discoveryUnknown
        ? async (group: string) => getLegacyMTApiBaseUrl(group)
        : (group: string) => resolveMTApiBaseUrl(group, onDiscoveryUnknown);
      const baseUrlsByUid = await resolveBaseUrlsByUid(groupsByUid, resolveBaseUrl);
      if (!isCurrent()) {
        return { status: 'superseded' };
      }
      return { status: 'done', snapshot: this.buildSnapshot(connections, metas, groupsByUid, baseUrlsByUid) };
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

  private logDiscoveryUnknown(group: string): void {
    if (!this.loggedDiscoveryUnknown) {
      this.loggedDiscoveryUnknown = true;
      logDataSourceWarning(MT_API_DISCOVERY_UNKNOWN_WARNING, { group });
    }
  }

  private buildSnapshot(
    latest: DataSourceConnection[],
    metas: DataSourcePluginMeta[],
    groupsByUid: Map<string, string>,
    baseUrlsByUid: Map<string, string | undefined>
  ): DataSourceListSnapshot {
    // Dropped before the join, as orphans are, so one can't become the default. No group means no plugin,
    // which the join drops and logs.
    const unservedGroups = new Set<string>();
    const served = latest.filter((connection) => {
      const group = groupsByUid.get(connection.name);
      if (group === undefined || baseUrlsByUid.get(connection.name) !== undefined) {
        return true;
      }
      unservedGroups.add(group);
      return false;
    });
    if (unservedGroups.size > 0) {
      logDataSourceWarning(MT_GROUP_NOT_SERVED_DROPPED_WARNING, {
        count: String(latest.length - served.length),
        groups: Array.from(unservedGroups).slice(0, MAX_LOGGED_TYPES).join(','),
      });
    }

    const { snapshot, droppedTypes } = toListSnapshot(served, metas);

    if (droppedTypes.length > 0) {
      logDataSourceWarning(MISSING_PLUGIN_DROPPED_WARNING, {
        count: String(droppedTypes.length),
        types: Array.from(new Set(droppedTypes)).slice(0, MAX_LOGGED_TYPES).join(','),
      });
    }

    this.connectionsByUid = new Map(served.map((connection) => [connection.name, connection]));
    this.baseUrlsByUid = baseUrlsByUid;
    this.itemsByUid = new Map(snapshot.items.map((item) => [item.uid, item]));
    return snapshot;
  }
}

// Resolved once per fill and reused by the settings loads, which would otherwise ask discovery per uid.
// Concurrent, so the groups share one discovery request.
async function resolveBaseUrlsByUid(
  groupsByUid: Map<string, string>,
  resolveBaseUrl: (group: string) => Promise<string | undefined>
): Promise<Map<string, string | undefined>> {
  const groups = Array.from(new Set(groupsByUid.values()));
  const baseUrls = await Promise.all(groups.map(resolveBaseUrl));
  const baseUrlsByGroup = new Map(groups.map((group, index) => [group, baseUrls[index]]));
  return new Map(Array.from(groupsByUid, ([uid, group]) => [uid, baseUrlsByGroup.get(group)]));
}
