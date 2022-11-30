import { QueryEditorExpressionType } from '../expressions';
import { CloudWatchMetricsQuery, MetricQueryType, MetricEditorMode, CloudWatchLogsQuery } from '../types';

export const validMetricSearchCodeQuery: CloudWatchMetricsQuery = {
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
  expression: 'SEARCH()',
  refId: 'A',
  metricQueryType: MetricQueryType.Search,
  metricEditorMode: MetricEditorMode.Code,
  hide: false,
};

export const validMetricSearchBuilderQuery: CloudWatchMetricsQuery = {
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
  metricEditorMode: MetricEditorMode.Builder,
  hide: false,
};

export const validMetricQueryBuilderQuery: CloudWatchMetricsQuery = {
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
  sql: {
    select: {
      type: QueryEditorExpressionType.Function,
      name: 'AVERAGE',
      parameters: [
        {
          type: QueryEditorExpressionType.FunctionParameter,
          name: 'CPUUtilization',
        },
      ],
    },
  },
  refId: 'A',
  metricQueryType: MetricQueryType.Query,
  metricEditorMode: MetricEditorMode.Builder,
  hide: false,
};

export const validMetricQueryCodeQuery: CloudWatchMetricsQuery = {
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
  sqlExpression: 'SELECT * FROM "AWS/EC2" WHERE "InstanceId" = \'i-123\'',
  refId: 'A',
  metricQueryType: MetricQueryType.Query,
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
