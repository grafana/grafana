import {
  CloudWatchAnnotationQuery,
  CloudWatchLogsQuery,
  CloudWatchMetricsQuery,
  LogGroup,
  LogsQueryLanguage,
  MetricEditorMode,
  MetricQueryType,
  VariableQuery,
  VariableQueryType,
} from './types';

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
  sql: undefined,
  sqlExpression: '',
  matchExact: true,
};

export const DEFAULT_ANNOTATIONS_QUERY: Omit<CloudWatchAnnotationQuery, 'refId'> = {
  queryMode: 'Annotations',
  namespace: '',
  region: 'default',
  statistic: 'Average',
};

export const DEFAULT_CWLI_QUERY_STRING = 'fields @timestamp, @message |\nsort @timestamp desc |\nlimit 20';
export const DEFAULT_PPL_QUERY_STRING = 'fields `@timestamp`, `@message`\n| sort - `@timestamp`\n| head 25s';
export const DEFAULT_SQL_QUERY_STRING =
  'SELECT `@timestamp`, `@message`\nFROM `log_group`\nORDER BY `@timestamp` DESC\nLIMIT 25;';

export const getDefaultLogsQuery = (
  defaultLogGroups?: LogGroup[],
  legacyDefaultLogGroups?: string[]
): Omit<CloudWatchLogsQuery, 'refId' | 'queryMode'> => ({
  id: '',
  region: 'default',
  // in case legacy default log groups have been defined in the ConfigEditor, they will be migrated in the LogGroupsField component or the next time the ConfigEditor is opened.
  // the migration requires async backend calls, so we don't want to do it here as it would block the UI.
  logGroupNames: legacyDefaultLogGroups,
  logGroups: defaultLogGroups ?? [],
  queryLanguage: LogsQueryLanguage.CWLI,
});

export const DEFAULT_VARIABLE_QUERY: Partial<VariableQuery> = {
  queryType: VariableQueryType.Regions,
  region: 'default',
};
