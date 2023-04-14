import { DashboardLoadedEvent } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import './module';

jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    reportInteraction: jest.fn(),
    getAppEvents: () => ({
      subscribe: jest.fn((_, handler) => {
        // Trigger test event
        handler(
          new DashboardLoadedEvent({
            dashboardId: 'dashboard123',
            orgId: 1,
            userId: 2,
            grafanaVersion: 'v9.0.0',
            queries: {
              elasticsearch: [
                {
                  alias: '',
                  bucketAggs: [],
                  datasource: {
                    type: 'elasticsearch',
                    uid: 'PE50363A9B6833EE7',
                  },
                  metrics: [
                    {
                      id: '1',
                      settings: {
                        limit: '501',
                      },
                      type: 'logs',
                    },
                  ],
                  query: 'abc:def',
                  refId: 'A',
                  timeField: '@timestamp',
                },
                {
                  alias: '',
                  bucketAggs: [],
                  datasource: {
                    type: 'elasticsearch',
                    uid: 'es1',
                  },
                  metrics: [
                    {
                      id: '1',
                      settings: {
                        size: '600',
                      },
                      type: 'raw_data',
                    },
                  ],
                  query: '',
                },
                {
                  alias: 'alias',
                  bucketAggs: [
                    {
                      field: '@timestamp',
                      id: '2',
                      settings: {
                        interval: 'auto',
                      },
                      type: 'date_histogram',
                    },
                  ],
                  datasource: {
                    type: 'elasticsearch',
                    uid: 'es1',
                  },
                  metrics: [
                    {
                      id: '3',
                      type: 'count',
                    },
                  ],
                  query: 'abc:def',
                },
                {
                  alias: '',
                  bucketAggs: [],
                  datasource: {
                    type: 'elasticsearch',
                    uid: 'PE50363A9B6833EE7',
                  },
                  metrics: [
                    {
                      id: '1',
                      settings: {
                        size: '600',
                      },
                      type: 'raw_document',
                    },
                  ],
                  query: '',
                  refId: 'A',
                  timeField: '@timestamp',
                },
                {
                  alias: '',
                  bucketAggs: [
                    {
                      field: '@timestamp',
                      id: '2',
                      settings: {
                        interval: 'auto',
                      },
                      type: 'date_histogram',
                    },
                  ],
                  datasource: {
                    type: 'elasticsearch',
                    uid: 'es1',
                  },
                  metrics: [
                    {
                      field: 'counter',
                      id: '1',
                      type: 'avg',
                    },
                  ],
                  query: '$test:abc',
                },
              ],
            },
          })
        );
      }),
    }),
  };
});

describe('queriesOnInitDashboard', () => {
  it('should report a grafana_elasticsearch_dashboard_loaded interaction ', () => {
    expect(reportInteraction).toHaveBeenCalledWith('grafana_elasticsearch_dashboard_loaded', {
      grafana_version: 'v9.0.0',
      dashboard_id: 'dashboard123',
      org_id: 1,
      queries_count: 5,
      queries_with_changed_line_limit_count: 1,
      queries_with_lucene_query_count: 3,
      queries_with_template_variables_count: 1,
      raw_data_queries_count: 1,
      raw_document_queries_count: 1,
      logs_queries_count: 1,
      metric_queries_count: 2,
    });
  });
});
