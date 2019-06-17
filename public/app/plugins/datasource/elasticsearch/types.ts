import { DataQuery } from '@grafana/ui';

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
