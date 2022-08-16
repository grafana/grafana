import { DataQuery, DataSourceJsonData } from '@grafana/data';
import { QuerySettings } from './configuration/QuerySettings/types';
import { ConnectionSettings } from './configuration/ConnectionSettings/types';

//expr is a workaround: https://github.com/grafana/grafana/issues/30013
export interface DruidQuery extends DataQuery {
  builder: any;
  settings: QuerySettings;
  expr: string;
}

export interface DruidSettings extends DataSourceJsonData {
  connection?: ConnectionSettings;
  query?: QuerySettings;
}

export interface DruidSecureSettings {}
