import { DataQuery, DataSourceJsonData } from '@grafana/ui';

export interface ElasticsearchOptions extends DataSourceJsonData {
  timeField: string;
  esVersion: number;
  interval: string;
  timeInterval: string;
  maxConcurrentShardRequests?: number;
  logMessageField?: string;
  logLevelField?: string;
}

export interface ElasticsearchAggregation {
  id: string;
  type: string;
  settings?: any;
  field?: string;
}

export interface ElasticsearchQuery extends DataQuery {
  isLogsQuery: boolean;
  alias?: string;
  query?: string;
  bucketAggs?: ElasticsearchAggregation[];
  metrics?: ElasticsearchAggregation[];
}
