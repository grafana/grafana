import { DataQuery, DataSourceJsonData } from '@grafana/ui';

export interface ElasticsearchOptions extends DataSourceJsonData {
  index: string;
  timeField: string;
  esVersion: number;
  interval: string;
  timeInterval: string;
  maxConcurrentShardRequests: number;
  logMessageField?: string;
  logLevelField?: string;
}

export interface ElasticsearchAggregation {
  id: string;
  type: string;
  settings?: any;
}

export interface ElasticsearchQuery extends DataQuery {
  alias?: string;
  query?: string;
  bucketAggs?: ElasticsearchAggregation[];
  metricAggs?: ElasticsearchAggregation[];
}
