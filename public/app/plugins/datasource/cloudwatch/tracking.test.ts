import { SQLQuery } from '@grafana/aws-sdk';
import { DashboardLoadedEvent } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';

import { CloudWatchQuery } from './types';

import './module';

jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    reportInteraction: jest.fn(),
    getAppEvents: () => ({
      subscribe: jest.fn((e, handler) => {
        // Trigger test event
        handler(
          new DashboardLoadedEvent({
            dashboardId: 'dashboard123',
            orgId: 1,
            userId: 2,
            grafanaVersion: 'v9.0.0',
            queries: {
              //unrelated data source
              'grafana-redshift-datasource': [
                {
                  datasource: {
                    type: 'grafana-redshift-datasource',
                  },
                  rawSQL: 'SELECT *  FROM public.long_format_example LIMIT 10',
                  refId: 'A',
                },
              ] as SQLQuery[],
              cloudwatch: [
                {
                  alias: '',
                  datasource: {
                    type: 'cloudwatch',
                    uid: 'abc',
                  },
                  dimensions: {},
                  expression: '',
                  id: '',
                  matchExact: true,
                  metricEditorMode: 1,
                  metricName: '',
                  metricQueryType: 1,
                  namespace: '',
                  period: '',
                  queryMode: 'Metrics',
                  refId: 'A',
                  region: 'us-east-1',
                  sql: {
                    from: {
                      property: {
                        name: 'AWS/EC2',
                        type: 'string',
                      },
                      type: 'property',
                    },
                    groupBy: {
                      expressions: [
                        {
                          property: {
                            name: 'InstanceId',
                            type: 'string',
                          },
                          type: 'groupBy',
                        },
                      ],
                      type: 'and',
                    },
                    limit: 5,
                    orderBy: {
                      name: 'AVG',
                      type: 'function',
                    },
                    orderByDirection: 'DESC',
                    select: {
                      name: 'AVG',
                      parameters: [
                        {
                          name: 'CPUUtilization',
                          type: 'functionParameter',
                        },
                      ],
                      type: 'function',
                    },
                  },
                  sqlExpression:
                    'SELECT AVG(CPUUtilization) FROM "AWS/EC2" GROUP BY InstanceId ORDER BY AVG() DESC LIMIT 5',
                  statistic: 'Average',
                },
                {
                  alias: '',
                  datasource: {
                    type: 'cloudwatch',
                    uid: 'abc',
                  },
                  dimensions: {},
                  expression: '',
                  id: '',
                  matchExact: true,
                  metricEditorMode: 1,
                  metricName: '',
                  metricQueryType: 1,
                  namespace: '',
                  period: '',
                  queryMode: 'Metrics',
                  refId: 'A',
                  region: 'us-east-1',
                  sql: {
                    from: {
                      property: {
                        name: '$namespace',
                        type: 'string',
                      },
                      type: 'property',
                    },
                    groupBy: {
                      expressions: [
                        {
                          property: {
                            name: '$dimensionkey',
                            type: 'string',
                          },
                          type: 'groupBy',
                        },
                      ],
                      type: 'and',
                    },
                    limit: 5,
                    orderBy: {
                      name: 'SUM',
                      type: 'function',
                    },
                    orderByDirection: '$direction',
                    select: {
                      name: '$aggregation',
                      parameters: [
                        {
                          name: '$metric',
                          type: 'functionParameter',
                        },
                      ],
                      type: 'function',
                    },
                  },
                  sqlExpression:
                    'SELECT $aggregation($metric) FROM "$namespace" GROUP BY $dimensionkey ORDER BY SUM() $direction LIMIT 5',
                  statistic: 'Average',
                },
                {
                  alias: '',
                  datasource: {
                    type: 'cloudwatch',
                    uid: 'abc',
                  },
                  dimensions: {},
                  expression: '',
                  id: '',
                  matchExact: true,
                  metricEditorMode: 1,
                  metricName: '',
                  metricQueryType: 1,
                  namespace: '',
                  period: '900',
                  queryMode: 'Metrics',
                  refId: 'A',
                  region: 'us-east-1',
                  sql: {
                    from: {
                      name: 'SCHEMA',
                      parameters: [
                        {
                          name: 'AWS/EC2',
                          type: 'functionParameter',
                        },
                        {
                          name: 'InstanceId',
                          type: 'functionParameter',
                        },
                      ],
                      type: 'function',
                    },
                    orderByDirection: 'DESC',
                    select: {
                      name: 'AVG',
                      parameters: [
                        {
                          name: 'CPUUtilization',
                          type: 'functionParameter',
                        },
                      ],
                      type: 'function',
                    },
                  },
                  sqlExpression: 'SELECT AVG(CPUUtilization) FROM SCHEMA("AWS/EC2", InstanceId)',
                  statistic: 'Average',
                },
                {
                  alias: '',
                  datasource: {
                    type: 'cloudwatch',
                    uid: 'abc',
                  },
                  dimensions: {},
                  expression: '',
                  hide: false,
                  id: '',
                  matchExact: true,
                  metricEditorMode: 0,
                  metricName: '',
                  metricQueryType: 1,
                  namespace: '',
                  period: '',
                  queryMode: 'Metrics',
                  refId: 'A',
                  region: 'default',
                  sql: {
                    from: {
                      property: {
                        name: 'AWS/EC2',
                        type: 'string',
                      },
                      type: 'property',
                    },
                    groupBy: {
                      expressions: [
                        {
                          property: {
                            name: 'InstanceId',
                            type: 'string',
                          },
                          type: 'groupBy',
                        },
                      ],
                      type: 'and',
                    },
                    limit: 5,
                    orderBy: {
                      name: 'MAX',
                      type: 'function',
                    },
                    orderByDirection: 'DESC',
                    select: {
                      name: 'AVG',
                      parameters: [
                        {
                          name: 'CPUUtilization',
                          type: 'functionParameter',
                        },
                      ],
                      type: 'function',
                    },
                  },
                  sqlExpression:
                    'SELECT AVG(CPUUtilization) FROM "AWS/EC2" GROUP BY InstanceId ORDER BY MAX() DESC LIMIT 5',
                  statistic: 'Average',
                },
                {
                  alias: '',
                  datasource: {
                    type: 'cloudwatch',
                    uid: 'abc',
                  },
                  dimensions: {},
                  expression: '',
                  id: '',
                  matchExact: true,
                  metricEditorMode: 0,
                  metricName: '',
                  metricQueryType: 1,
                  namespace: '',
                  period: '',
                  queryMode: 'Metrics',
                  refId: 'A',
                  region: 'us-east-1',
                  sql: {
                    from: {
                      property: {
                        name: 'AWS/EC2',
                        type: 'string',
                      },
                      type: 'property',
                    },
                    groupBy: {
                      expressions: [
                        {
                          property: {
                            name: 'InstanceId',
                            type: 'string',
                          },
                          type: 'groupBy',
                        },
                      ],
                      type: 'and',
                    },
                    limit: 5,
                    orderBy: {
                      name: 'AVG',
                      type: 'function',
                    },
                    orderByDirection: 'DESC',
                    select: {
                      name: 'AVG',
                      parameters: [
                        {
                          name: 'CPUUtilization',
                          type: 'functionParameter',
                        },
                      ],
                      type: 'function',
                    },
                  },
                  sqlExpression:
                    'SELECT AVG(CPUUtilization) FROM "AWS/EC2" GROUP BY InstanceId ORDER BY AVG() DESC LIMIT 5',
                  statistic: 'Average',
                },
                {
                  alias: '',
                  datasource: {
                    type: 'cloudwatch',
                    uid: 'abc',
                  },
                  dimensions: {},
                  expression: '',
                  id: '',
                  matchExact: true,
                  metricEditorMode: 0,
                  metricName: '',
                  metricQueryType: 1,
                  namespace: '',
                  period: '900',
                  queryMode: 'Metrics',
                  refId: 'A',
                  region: 'us-east-1',
                  sql: {
                    from: {
                      name: 'SCHEMA',
                      parameters: [
                        {
                          name: 'AWS/EC2',
                          type: 'functionParameter',
                        },
                        {
                          name: 'InstanceId',
                          type: 'functionParameter',
                        },
                      ],
                      type: 'function',
                    },
                    orderByDirection: 'DESC',
                    select: {
                      name: 'AVG',
                      parameters: [
                        {
                          name: 'CPUUtilization',
                          type: 'functionParameter',
                        },
                      ],
                      type: 'function',
                    },
                  },
                  sqlExpression: 'SELECT AVG(CPUUtilization) FROM SCHEMA("AWS/EC2", InstanceId)',
                  statistic: 'Average',
                },
                {
                  alias: '',
                  datasource: {
                    type: 'cloudwatch',
                    uid: 'abc',
                  },
                  dimensions: {},
                  expression: '',
                  id: '',
                  matchExact: true,
                  metricEditorMode: 1,
                  metricName: '',
                  metricQueryType: 1,
                  namespace: 'AWS/EC2',
                  period: '300',
                  queryMode: 'Metrics',
                  refId: 'A',
                  region: 'default',
                  sql: {
                    select: {
                      name: 'AVG',
                      type: 'function',
                    },
                  },
                  sqlExpression: 'SELECT AVG(CPUUtilization) FROM "AWS/EC2" GROUP BY InstanceId',
                  statistic: 'Average',
                },
                {
                  alias: '',
                  datasource: {
                    type: 'cloudwatch',
                    uid: 'abc',
                  },
                  dimensions: {},
                  expression:
                    'REMOVE_EMPTY(SEARCH(\'{"AWS/EC2","InstanceId"} MetricName="CPUUtilization"\', \'Average\', 900))',
                  id: '',
                  matchExact: true,
                  metricEditorMode: 1,
                  metricName: 'CPUUtilization',
                  metricQueryType: 0,
                  namespace: 'AWS/EC2',
                  period: '',
                  queryMode: 'Metrics',
                  refId: 'A',
                  region: 'default',
                  sqlExpression: '',
                  statistic: 'Average',
                },
                {
                  alias: '',
                  datasource: {
                    type: 'cloudwatch',
                    uid: 'abc',
                  },
                  dimensions: {
                    InstanceId: 'i-123',
                  },
                  expression:
                    'REMOVE_EMPTY(SEARCH(\'{"AWS/EC2","InstanceId"} MetricName="CPUUtilization"\', \'Average\', 900))',
                  id: 'a',
                  matchExact: true,
                  metricEditorMode: 0,
                  metricName: 'CPUUtilization',
                  metricQueryType: 0,
                  namespace: 'AWS/EC2',
                  period: '',
                  queryMode: 'Metrics',
                  refId: 'A',
                  region: 'default',
                  sqlExpression: '',
                  statistic: 'Average',
                },
                {
                  alias: 'query a times 2',
                  datasource: {
                    type: 'cloudwatch',
                    uid: 'abc',
                  },
                  dimensions: {
                    InstanceId: 'i-123',
                  },
                  expression: 'a * 2',
                  hide: false,
                  id: 'b',
                  matchExact: true,
                  metricEditorMode: 1,
                  metricName: 'CPUUtilization',
                  metricQueryType: 0,
                  namespace: 'AWS/EC2',
                  period: '',
                  queryMode: 'Metrics',
                  refId: 'B',
                  region: 'default',
                  sqlExpression: '',
                  statistic: 'Average',
                },
                {
                  datasource: {
                    type: 'cloudwatch',
                    uid: 'P7DC3E4760CFAC4AP',
                  },
                  expression: 'fields @timestamp, @message | sort @timestamp desc | limit 300     ',
                  id: '',
                  logGroupNames: ['/aws/lambda/hello-world', '/aws/sagemaker/Endpoints/test', '/aws/sagemaker/test'],
                  namespace: '',
                  queryMode: 'Logs',
                  refId: 'A',
                  region: 'default',
                  statsGroups: [],
                },
                {
                  alias: '',
                  datasource: {
                    type: 'cloudwatch',
                    uid: 'APZ8b_Fnz',
                  },
                  dimensions: {
                    InstanceId: '*',
                  },
                  expression: '',
                  id: '',
                  matchExact: true,
                  metricEditorMode: 0,
                  metricName: 'CPUUtilization',
                  metricQueryType: 0,
                  namespace: 'AWS/EC2',
                  period: '',
                  queryMode: 'Metrics',
                  refId: 'A',
                  region: 'default',
                  sqlExpression: '',
                  statistic: 'Average',
                },
                {
                  alias: '{{InstanceId}}',
                  datasource: {
                    type: 'cloudwatch',
                    uid: 'abc',
                  },
                  dimensions: {
                    InstanceId: '$dimensionValue',
                  },
                  expression: '',
                  expressionMode: 'math',
                  hide: false,
                  id: 'a',
                  matchExact: true,
                  metricEditorMode: 0,
                  metricName: 'CPUUtilization',
                  metricQueryMode: 'sql',
                  metricQueryType: 0,
                  namespace: 'AWS/EC2',
                  period: '',
                  queryMode: 'Metrics',
                  refId: 'B',
                  region: 'default',
                  sqlExpression: '',
                  statistic: 'Average',
                },
                {
                  alias: 'Network Out',
                  datasource: {
                    type: 'cloudwatch',
                    uid: 'abc',
                  },
                  dimensions: {
                    InstanceId: 'i-123',
                  },
                  expression: '',
                  expressionMode: 'math',
                  hide: true,
                  id: '',
                  matchExact: true,
                  metricEditorMode: 0,
                  metricName: 'NetworkOut',
                  metricQueryMode: 'metricStat',
                  metricQueryType: 0,
                  namespace: 'AWS/EC2',
                  period: '',
                  queryMode: 'Metrics',
                  refId: 'A',
                  region: 'default',
                  sqlExpression: '',
                  statistic: 'Average',
                },
                {
                  alias: '{{InstanceId}}',
                  datasource: {
                    type: 'cloudwatch',
                    uid: 'YEc9mclMk',
                  },
                  dimensions: {
                    InstanceId: 'i-123',
                  },
                  expression: '',
                  id: '',
                  matchExact: true,
                  metricEditorMode: 0,
                  metricName: 'CPUUtilization',
                  metricQueryType: 0,
                  namespace: 'AWS/EC2',
                  period: '',
                  queryMode: 'Metrics',
                  refId: 'A',
                  region: 'us-east-2',
                  sqlExpression: '',
                  statistic: '$stats',
                },
                {
                  alias: '',
                  datasource: {
                    type: 'cloudwatch',
                    uid: 'abc',
                  },
                  dimensions: {
                    InstanceId: 'i-123',
                  },
                  expression: '',
                  id: 'a',
                  matchExact: true,
                  metricEditorMode: 0,
                  metricName: 'CPUUtilization',
                  metricQueryType: 0,
                  namespace: 'AWS/EC2',
                  period: '',
                  queryMode: 'Metrics',
                  refId: 'A',
                  region: 'default',
                  sqlExpression: '',
                  statistic: 'Average',
                },
                {
                  alias: '',
                  datasource: {
                    type: 'cloudwatch',
                    uid: 'abc',
                  },
                  dimensions: {
                    InstanceId: '*',
                  },
                  expression: 'a / 0',
                  hide: false,
                  id: '',
                  matchExact: true,
                  metricEditorMode: 1,
                  metricName: 'CPUUtilization',
                  metricQueryType: 0,
                  namespace: 'AWS/EC2',
                  period: '',
                  queryMode: 'Metrics',
                  refId: 'B',
                  region: 'default',
                  sqlExpression: '',
                  statistic: 'Average',
                },
                {
                  alias: '',
                  datasource: {
                    type: 'cloudwatch',
                    uid: 'abc',
                  },
                  dimensions: {
                    InstanceId: '*',
                  },
                  expression: "REMOVE_EMPTY(SEARCH('', 'Average', 900))",
                  id: '',
                  matchExact: true,
                  metricEditorMode: 1,
                  metricName: 'CPUUtilization',
                  metricQueryType: 0,
                  namespace: 'AWS/EC2',
                  period: '',
                  queryMode: 'Metrics',
                  refId: 'A',
                  region: 'us-east-2',
                  sqlExpression: '',
                  statistic: 'Average',
                },
                {
                  alias: '',
                  datasource: {
                    type: 'cloudwatch',
                    uid: 'abc',
                  },
                  dimensions: {
                    InstanceId: '*',
                  },
                  expression: '',
                  id: 'a',
                  matchExact: true,
                  metricEditorMode: 0,
                  metricName: 'CPUUtilization',
                  metricQueryType: 0,
                  namespace: 'AWS/EC2',
                  period: '',
                  queryMode: 'Metrics',
                  refId: 'A',
                  region: 'default',
                  sqlExpression: '',
                  statistic: 'Average',
                },
                {
                  alias: '',
                  datasource: {
                    type: 'cloudwatch',
                    uid: 'abc',
                  },
                  dimensions: {
                    InstanceId: '*',
                  },
                  expression: '',
                  hide: false,
                  id: 'a',
                  matchExact: true,
                  metricEditorMode: 0,
                  metricName: 'CPUUtilization',
                  metricQueryType: 0,
                  namespace: 'AWS/EC2',
                  period: '',
                  queryMode: 'Metrics',
                  refId: 'B',
                  region: 'default',
                  sqlExpression: '',
                  statistic: 'Average',
                },
                {
                  alias: '',
                  datasource: {
                    type: 'cloudwatch',
                    uid: 'abc',
                  },
                  dimensions: {
                    InstanceId: 'i-123',
                  },
                  expression: '',
                  id: 'a',
                  matchExact: true,
                  metricEditorMode: 0,
                  metricName: 'CPUUtilization',
                  metricQueryType: 0,
                  namespace: 'AWS/EC2',
                  period: '',
                  queryMode: 'Metrics',
                  refId: 'A',
                  region: 'default',
                  sqlExpression: '',
                  statistic: 'Average',
                },
                {
                  alias: '',
                  datasource: {
                    type: 'cloudwatch',
                    uid: 'abc',
                  },
                  dimensions: {
                    InstanceId: '*',
                  },
                  expression: 'a / ',
                  hide: false,
                  id: '',
                  matchExact: true,
                  metricEditorMode: 1,
                  metricName: 'CPUUtilization',
                  metricQueryType: 0,
                  namespace: 'AWS/EC2',
                  period: '',
                  queryMode: 'Metrics',
                  refId: 'B',
                  region: 'default',
                  sqlExpression: '',
                  statistic: 'Average',
                },
              ] as CloudWatchQuery[],
            },
          })
        );
      }),
    }),
  };
});

describe('onDashboardLoadedHandler', () => {
  it('should report a `grafana_ds_cloudwatch_dashboard_loaded` interaction ', () => {
    expect(reportInteraction).toHaveBeenCalledWith('grafana_ds_cloudwatch_dashboard_loaded', {
      dashboard_id: 'dashboard123',
      grafana_version: 'v9.0.0',
      org_id: 1,
      user_id: 2,
      logs_queries_count: 1,
      metrics_queries_count: 21,
      metrics_query_builder_count: 3,
      metrics_query_code_count: 4,
      metrics_query_count: 7,
      metrics_search_builder_count: 9,
      metrics_search_code_count: 5,
      metrics_search_count: 14,
      metrics_search_match_exact_count: 9,
    });
  });
});
