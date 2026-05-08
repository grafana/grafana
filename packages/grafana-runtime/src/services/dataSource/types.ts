import {
  type DataSourceApi,
  type DataSourceInstanceSettings,
  type DataSourceJsonData,
  type DataSourcePlugin,
  type DataSourcePluginMeta,
} from '@grafana/data';
import { type DataQuery } from '@grafana/schema';

import { type GetDataSourceListFilters } from '../dataSourceSrv';

/**
 * Paginated response shape. The initial implementation always returns
 * every item in a single page — `hasMore` is false and `nextCursor` undefined.
 * The shape is in place so callers don't need to migrate twice when real
 * pagination lands on the backend.
 *
 * @public
 */
export interface DataSourceSettingsPage {
  items: DataSourceInstanceSettings[];
  /** Opaque cursor for fetching the next page. Undefined when no more pages. */
  nextCursor?: string;
  hasMore: boolean;
}

/**
 * @public
 */
export interface GetDataSourceSettingsListOptions {
  filters?: GetDataSourceListFilters;
  /** Cursor returned by a previous call; omit to fetch the first page. */
  cursor?: string;
}

/** @internal */
export type GenericDataSourcePlugin = DataSourcePlugin<
  DataSourceApi<DataQuery, DataSourceJsonData>,
  DataQuery,
  DataSourceJsonData
>;

/** @internal */
export type ImportDataSourceFn = (meta: DataSourcePluginMeta) => Promise<GenericDataSourcePlugin>;
