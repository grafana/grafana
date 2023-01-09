import { CloudWatchLogsQuery, CloudWatchMetricsQuery, LogGroup, MetricEditorMode, MetricQueryType } from './types';

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

export const getDefaultLogsQuery = (
  defaultLogGroups?: LogGroup[],
  legacyDefaultLogGroups?: string[]
): Omit<CloudWatchLogsQuery, 'refId' | 'queryMode'> => ({
  id: '',
  region: 'default',
  expression: '',
  // in case legacy default log groups have been defined in the ConfigEditor, they will be migrated in the LogGroupsField component or the next time the ConfigEditor is opened.
  // the migration requires async backend calls, so we don't want to do it here as it would block the UI.
  logGroupNames: legacyDefaultLogGroups,
  logGroups: defaultLogGroups ?? [],
});
