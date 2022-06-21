import { CloudWatchMetricsQuery, MetricQueryType, MetricEditorMode, CloudWatchLogsQuery } from '../types';

export const validMetricsQuery: CloudWatchMetricsQuery = {
  id: '',
  queryMode: 'Metrics',
  region: 'us-east-2',
  namespace: 'AWS/EC2',
  period: '3000',
  alias: '',
  metricName: 'CPUUtilization',
  dimensions: { InstanceId: 'i-123' },
  matchExact: true,
  statistic: 'Average',
  expression: '',
  refId: 'A',
  metricQueryType: MetricQueryType.Search,
  metricEditorMode: MetricEditorMode.Code,
  hide: false,
};

export const validLogsQuery: CloudWatchLogsQuery = {
  queryMode: 'Logs',
  logGroupNames: ['group-A', 'group-B'],
  hide: false,
  id: '',
  region: 'us-east-2',
  refId: 'A',
};
