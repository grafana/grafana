import {
  type DataSourceApi,
  type DataSourceJsonData,
  type DataSourcePlugin,
  type DataSourcePluginMeta,
} from '@grafana/data';
import { type DataQuery } from '@grafana/schema';

/** @internal */
type GenericDataSourcePlugin = DataSourcePlugin<
  DataSourceApi<DataQuery, DataSourceJsonData>,
  DataQuery,
  DataSourceJsonData
>;

/** @internal */
export type ImportDataSourcePluginFn = (meta: DataSourcePluginMeta) => Promise<GenericDataSourcePlugin>;
