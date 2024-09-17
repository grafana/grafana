import { AnnotationQuery } from '@grafana/data';

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
