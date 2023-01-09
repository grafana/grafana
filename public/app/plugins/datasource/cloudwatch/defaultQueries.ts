import { CloudWatchLogsQuery, CloudWatchMetricsQuery, MetricEditorMode, MetricQueryType } from './types';

export const DEFAULT_METRICS_QUERY: Omit<CloudWatchMetricsQuery, 'refId'> = {
  queryMode: 'Metrics',
  namespace: '',
  metricName: '',
  expression: '',
  dimensions: {},
  region: 'default',
  id: '',
  statistic: 'Average',
  period: '',
  metricQueryType: MetricQueryType.Search,
  metricEditorMode: MetricEditorMode.Builder,
  sqlExpression: '',
  matchExact: true,
};

export const getDefaultLogsQuery = (defaultLogGroups?: string[]): Omit<CloudWatchLogsQuery, 'refId' | 'queryMode'> => ({
  id: '',
  region: 'default',
  expression: '',
  logGroupNames: defaultLogGroups,
});
