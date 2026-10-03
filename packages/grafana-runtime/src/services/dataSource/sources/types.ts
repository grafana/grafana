import { type DataSourceInstanceListItem, type DataSourceInstanceSettings } from '@grafana/data';

/** The data source part of the `/api/frontend/settings` payload (boot data). */
export interface BootDataSourceSettings {
  datasources: Record<string, DataSourceInstanceSettings>;
  defaultDatasource: string;
}

/** Everything a source hands the shared cache in one fill. */
export interface DataSourceListSnapshot {
  /** Every data source, built-ins included. Runtime data sources are not part of a snapshot. */
  items: DataSourceInstanceListItem[];
  /** Numeric id (as a string) to uid. Only boot data knows ids up front. */
  uidById?: Record<string, string>;
  defaultUid?: string;
  /** Settings keyed by uid, when the source has them up front. Preloads the settings layer. */
  settings?: Record<string, DataSourceInstanceSettings>;
  /** What the source fetched to build the list, for the fill measurement. */
  stats?: { connections: number; droppedMissingPlugin: number };
}

/**
 * Where the async data source cache gets its data from. The shared cache, the lookups and the
 * hooks only see this interface, so a source can be swapped or removed without touching them.
 */
export interface DataSourceCacheSource {
  readonly kind: 'bootData' | 'mt';
  /** A snapshot that is available without waiting, or `undefined` when the list must be fetched. */
  getInitialSnapshot(): DataSourceListSnapshot | undefined;
  /** First fill, and the retry after a failed fill. */
  loadList(): Promise<DataSourceListSnapshot>;
  /** After a data source add, update or delete. `payload` is an already-fetched `/api/frontend/settings`. */
  refreshList(payload?: BootDataSourceSettings): Promise<DataSourceListSnapshot>;
  /** Settings for one uid. `undefined` means not found; every other failure throws. */
  loadSettings(uid: string): Promise<DataSourceInstanceSettings | undefined>;
}
