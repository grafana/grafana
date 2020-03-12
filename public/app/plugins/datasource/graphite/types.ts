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

export interface MetricTankRequestMeta {
  [key: string]: any; // TODO -- fill this with real values from metrictank
}

export interface MetricTankResultMeta {
  'schema-name': string;
  'schema-retentions': string; //"1s:35d:20min:5:1542274085,1min:38d:2h:1:true,10min:120d:6h:1:true,2h:2y:6h:2",
  'archive-read': number;
  'archive-interval': number;
  'aggnum-norm': number;
  'consolidate-normfetch': string; //"MaximumConsolidator",
  'aggnum-rc': number;
  'consolidate-rc': string; //"MaximumConsolidator",
  count: number;
}

export interface MetricTankMeta {
  request: MetricTankRequestMeta;
  info: MetricTankResultMeta[];
}
