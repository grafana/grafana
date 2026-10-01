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

export function createBootDataSource(boot: BootDataSourceSettings): DataSourceCacheSource {
  return {
    kind: 'bootData',
    getInitialSnapshot: () => createBootDataSnapshot(boot),
    loadList: async () => createBootDataSnapshot(boot),
    refreshList: async (payload) => {
      const settings = payload ?? (await getBackendSrv().get<BootDataSourceSettings>('/api/frontend/settings'));
      return createBootDataSnapshot(settings);
    },
    refreshMetas: async () => undefined,
    // Every settings object is preloaded by the snapshot, so a miss means the uid is unknown.
    loadSettings: async () => undefined,
  };
}
