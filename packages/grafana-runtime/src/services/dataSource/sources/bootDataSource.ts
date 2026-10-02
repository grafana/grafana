import { type DataSourceInstanceSettings } from '@grafana/data';

import { getBackendSrv } from '../../backendSrv';
import { toListItem } from '../cache';

import { type BootDataSourceSettings, type DataSourceCacheSource, type DataSourceListSnapshot } from './types';

/**
 * Build a snapshot from boot data. Boot data carries full settings for every data source, so
 * the snapshot preloads the settings layer and no per-uid load is ever needed.
 */
export function createBootDataSnapshot({
  datasources,
  defaultDatasource,
}: BootDataSourceSettings): DataSourceListSnapshot {
  const items = [];
  const settings: Record<string, DataSourceInstanceSettings> = {};
  const uidById: Record<string, string> = {};
  let defaultByName: DataSourceInstanceSettings | undefined;

  for (const dsSettings of Object.values(datasources)) {
    if (!dsSettings.uid) {
      dsSettings.uid = dsSettings.name; // e.g. -- Grafana --, -- Mixed --
    }
    items.push(toListItem(dsSettings));
    settings[dsSettings.uid] = dsSettings;
    if (dsSettings.id) {
      uidById[String(dsSettings.id)] = dsSettings.uid;
    }
    if (dsSettings.name === defaultDatasource) {
      defaultByName = dsSettings;
    }
  }

  // The configured default is a name, but a uid has always been accepted too, and wins.
  const defaultUid = settings[defaultDatasource]?.uid ?? defaultByName?.uid;

  return { items, uidById, defaultUid, settings };
}

/**
 * Fills the cache from boot data. Keeps the latest snapshot, so a per-uid load answers from the
 * same data the cache was filled with.
 */
export class BootDataSource implements DataSourceCacheSource {
  readonly kind = 'bootData';
  private snapshot: DataSourceListSnapshot;

  constructor(boot: BootDataSourceSettings) {
    this.snapshot = createBootDataSnapshot(boot);
  }

  getInitialSnapshot(): DataSourceListSnapshot {
    return this.snapshot;
  }

  async loadList(): Promise<DataSourceListSnapshot> {
    return this.snapshot;
  }

  async refreshList(payload?: BootDataSourceSettings): Promise<DataSourceListSnapshot> {
    const settings = payload ?? (await getBackendSrv().get<BootDataSourceSettings>('/api/frontend/settings'));
    this.snapshot = createBootDataSnapshot(settings);
    return this.snapshot;
  }

  async loadSettings(uid: string): Promise<DataSourceInstanceSettings | undefined> {
    return this.snapshot.settings?.[uid];
  }
}
