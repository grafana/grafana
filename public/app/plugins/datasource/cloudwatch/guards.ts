import { AnnotationQuery, DataQuery } from '@grafana/data';

import pluginJson from './plugin.json';
import { CloudWatchAnnotationQuery, CloudWatchLogsQuery, CloudWatchMetricsQuery, CloudWatchQuery } from './types';

export const isCloudWatchLogsQuery = (cloudwatchQuery: CloudWatchQuery): cloudwatchQuery is CloudWatchLogsQuery =>
  cloudwatchQuery.queryMode === 'Logs';

export const isCloudWatchMetricsQuery = (cloudwatchQuery: CloudWatchQuery): cloudwatchQuery is CloudWatchMetricsQuery =>
  cloudwatchQuery.queryMode === 'Metrics' || !cloudwatchQuery.hasOwnProperty('queryMode'); // in early versions of this plugin, queryMode wasn't defined in a CloudWatchMetricsQuery

export const isCloudWatchAnnotationQuery = (
  cloudwatchQuery: CloudWatchQuery
): cloudwatchQuery is CloudWatchAnnotationQuery => cloudwatchQuery.queryMode === 'Annotations';

export const isCloudWatchAnnotation = (query: unknown): query is AnnotationQuery<CloudWatchAnnotationQuery> =>
  (query as AnnotationQuery<CloudWatchAnnotationQuery>).target?.queryMode === 'Annotations';

export const isCloudWatchQuery = (query: DataQuery): query is CloudWatchQuery => {
  return query.datasource?.type === pluginJson.id;
};
