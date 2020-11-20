import { DataQuery, DataSourceJsonData } from '@grafana/data';

export interface ElasticsearchOptions extends DataSourceJsonData {
  timeField: string;
  esVersion: number;
  interval?: string;
  timeInterval: string;
  maxConcurrentShardRequests?: number;
  logMessageField?: string;
  logLevelField?: string;
  dataLinks?: DataLinkConfig[];
  pplSupportEnabled?: boolean;
}

export interface ElasticsearchAggregation {
  id: string;
  type: string;
  settings?: any;
  field?: string;
  pipelineVariables?: Array<{ name?: string; pipelineAgg?: string }>;
}

export interface ElasticsearchQuery extends DataQuery {
  isLogsQuery: boolean;
  alias?: string;
  query?: string;
  queryType?: ElasticsearchQueryType;
  bucketAggs?: ElasticsearchAggregation[];
  metrics?: ElasticsearchAggregation[];
  format?: string;
}

export type DataLinkConfig = {
  field: string;
  url: string;
  datasourceUid?: string;
};

export enum ElasticsearchQueryType {
  Lucene = 'lucene',
  PPL = 'PPL',
}
