import { QueryEditorExpressionType } from '../expressions';
import { MetricQueryType, MetricEditorMode } from '../types';
export const validMetricSearchCodeQuery = {
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
export const validMetricSearchBuilderQuery = {
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
export const validMetricQueryBuilderQuery = {
    queryMode: 'Metrics',
    refId: '',
    id: '',
    region: 'us-east-1',
    namespace: 'ec2',
    dimensions: { somekey: 'somevalue' },
    metricQueryType: MetricQueryType.Query,
    metricEditorMode: MetricEditorMode.Builder,
    sql: {
        from: {
            type: QueryEditorExpressionType.Function,
            name: 'SCHEMA',
            parameters: [
                {
                    type: QueryEditorExpressionType.FunctionParameter,
                    name: 'AWS/EC2',
                },
                {
                    type: QueryEditorExpressionType.FunctionParameter,
                    name: 'InstanceId',
                },
            ],
        },
    },
};
export const validMetricQueryCodeQuery = {
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
export const validLogsQuery = {
    queryMode: 'Logs',
    logGroupNames: ['group-A', 'group-B'],
    hide: false,
    id: '',
    region: 'us-east-2',
    refId: 'A',
    expression: `fields @timestamp, @message | sort @timestamp desc | limit 25`,
};
//# sourceMappingURL=queries.js.map