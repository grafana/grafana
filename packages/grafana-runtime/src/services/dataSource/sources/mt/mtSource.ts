import { type DataSourceInstanceListItem, type DataSourceInstanceSettings } from '@grafana/data';

import { getDatasourcePluginMetas } from '../../../pluginMeta/datasources';
import {
  DIRECT_ACCESS_UNSUPPORTED_WARNING,
  MISSING_PLUGIN_DROPPED_WARNING,
  MT_FILL_FAILED,
  MT_PARITY_MISMATCH_WARNING,
  MT_SETTINGS_PARITY_MISMATCH_WARNING,
  SETTINGS_FETCH_FAILED,
  SETTINGS_NOT_FOUND_STALE_LIST_WARNING,
} from '../../constants';
import { DataSourceCacheFillError, DataSourceSettingsFetchError } from '../../errors';
import { logDataSourceInstanceError, logDataSourceMeasurement, logDataSourceWarning } from '../../logging';
import { notifyDataSourceLoadFailed } from '../../notifications';
import { type BootDataSourceSettings, type DataSourceCacheSource, type DataSourceListSnapshot } from '../types';

import { fetchConnections, fetchDataSourceResource, MTRequestError } from './api';
import { toInstanceSettings, toListSnapshot } from './mappers';
import {
  compareListWithBootData,
  compareSettingsWithBootData,
  findInBootData,
  getBootDataBaseline,
  hasListMismatch,
  listForLog,
} from './parity';
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
  private loggedSettingsMismatch = new Set<string>();

  getInitialSnapshot(): undefined {
    return undefined;
  }

  loadList(): Promise<DataSourceListSnapshot> {
    return this.fetchAndBuild('boot', getBootDataBaseline());
  }

  /** `payload` is not read for the list; it is the boot data the MT list is compared with. */
  async refreshList(payload?: BootDataSourceSettings): Promise<DataSourceListSnapshot> {
    try {
      return await this.fetchAndBuild('reload', payload);
    } catch (error) {
      logDataSourceInstanceError(MT_FILL_FAILED, error, { reason: 'reload', source: this.kind });
      notifyDataSourceLoadFailed();
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
    this.compareSettings(settings);
    return settings;
  }

  private async fetchAndBuild(
    reason: 'boot' | 'reload',
    baseline: BootDataSourceSettings | undefined
  ): Promise<DataSourceListSnapshot> {
    const start = performance.now();
    const list = await fetchConnections();
    const connections = list.items ?? [];
    const { snapshot, droppedMissingPlugin } = await this.buildSnapshot(connections);
    if (baseline) {
      this.compareList(snapshot, baseline, {
        reason,
        durationMs: performance.now() - start,
        connections: connections.length,
        droppedMissingPlugin,
      });
    }
    return snapshot;
  }

  private compareList(
    snapshot: DataSourceListSnapshot,
    baseline: BootDataSourceSettings,
    fill: { reason: 'boot' | 'reload'; durationMs: number; connections: number; droppedMissingPlugin: number }
  ): void {
    const parity = compareListWithBootData(snapshot, baseline);
    logDataSourceMeasurement(
      'datasource_cache_fill',
      {
        durationMs: fill.durationMs,
        connections: fill.connections,
        items: snapshot.items.length,
        builtIns: snapshot.items.filter((item) => item.meta.builtIn).length,
        droppedMissingPlugin: fill.droppedMissingPlugin,
        bootItems: parity.bootItems,
        missingInMt: parity.missingInMt.length,
        extraInMt: parity.extraInMt.length,
        fieldMismatches: parity.fieldMismatches.length,
        defaultMismatch: parity.defaultMismatch ? 1 : 0,
      },
      { reason: fill.reason }
    );
    if (hasListMismatch(parity)) {
      logDataSourceWarning(MT_PARITY_MISMATCH_WARNING, {
        reason: fill.reason,
        missingInMt: listForLog(parity.missingInMt),
        extraInMt: listForLog(parity.extraInMt),
        fieldMismatches: listForLog(parity.fieldMismatches),
      });
    }
  }

  private compareSettings(settings: DataSourceInstanceSettings): void {
    if (this.loggedSettingsMismatch.has(settings.uid)) {
      return;
    }
    // A uid that boot data does not have is already reported by the list comparison.
    const boot = findInBootData(getBootDataBaseline(), settings.uid);
    if (!boot) {
      return;
    }
    const fields = compareSettingsWithBootData(settings, boot);
    if (fields.length > 0) {
      this.loggedSettingsMismatch.add(settings.uid);
      logDataSourceWarning(MT_SETTINGS_PARITY_MISMATCH_WARNING, {
        uid: settings.uid,
        type: settings.type,
        fields: fields.join(','),
      });
    }
  }

  private async buildSnapshot(
    latest: DataSourceConnection[]
  ): Promise<{ snapshot: DataSourceListSnapshot; droppedMissingPlugin: number }> {
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
    return { snapshot, droppedMissingPlugin: droppedTypes.length };
  }
}
