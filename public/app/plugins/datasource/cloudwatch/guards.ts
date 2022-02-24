import { CloudWatchMetricsQuery, CloudWatchQuery } from './types';

export const isMetricsQuery = (query: CloudWatchQuery): query is CloudWatchMetricsQuery => {
  return query.queryMode === 'Metrics';
};
