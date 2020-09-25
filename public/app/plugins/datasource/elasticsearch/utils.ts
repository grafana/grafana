import { defaultBucketAgg, defaultMetricAgg } from './query_def';
import { ElasticsearchQuery, NormalizedElasticsearchQuery } from './types';

/**
 * Normalizes an incomplete query to a runnable Elasticsearch Query
 * @param query
 */
export const normalizeQuery = (query: ElasticsearchQuery): NormalizedElasticsearchQuery => {
  const metrics = query.metrics || [defaultMetricAgg()];
  const bucketAggs = query.bucketAggs || [defaultBucketAgg()];
  return {
    ...query,
    hide: !!query.hide,
    isLogsQuery: metrics.some(metric => metric.type === 'logs'),
    alias: query.alias || '',
    query: query.query || '',
    metrics,
    bucketAggs,
    // FIXME: This should come from config
    timeField: '@timestamp',
  };
};
