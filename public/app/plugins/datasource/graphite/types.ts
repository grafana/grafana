import { DataQuery, DataSourceJsonData } from '@grafana/data';

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
