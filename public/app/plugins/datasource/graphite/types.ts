import { DataQuery, DataSourceJsonData, QueryResultDataSourceMeta } from '@grafana/data';

export interface GraphiteQuery extends DataQuery {
  target?: string;
}

export interface GraphiteOptions extends DataSourceJsonData {
  graphiteVersion: string;
  graphiteType: GraphiteType;
}

export enum GraphiteType {
  Default = 'default',
  Metrictank = 'metrictank',
}

export interface MetricTankRequestMeta {
  [key: string]: string; // TODO -- fill this with real values from metrictank
}
export interface MetricTankResultMeta {
  [key: string]: string; // TODO -- fill this with real values from metrictank
}

export interface MetricTankMeta extends QueryResultDataSourceMeta {
  request: MetricTankRequestMeta;
  info: MetricTankResultMeta[];
}
