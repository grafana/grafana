import { DashboardLoadedEvent } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';

import './module';

jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    reportInteraction: jest.fn(),
    getAppEvents: () => ({
      subscribe: jest.fn((_, handler) => {
        handler(
          new DashboardLoadedEvent({
            dashboardId: 'dash',
            orgId: 1,
            userId: 1,
            grafanaVersion: 'v9.4.0',
            queries: {
              tempo: [
                {
                  datasource: { type: 'tempo', uid: 'abc' },
                  queryType: 'nativeSearch',
                  refId: 'A',
                },
                {
                  datasource: { type: 'tempo', uid: 'abc' },
                  queryType: 'nativeSearch',
                  spanName: 'HTTP',
                  refId: 'A',
                },
                {
                  datasource: { type: 'tempo', uid: 'abc' },
                  queryType: 'nativeSearch',
                  spanName: '$var',
                  refId: 'A',
                },
                {
                  datasource: { type: 'tempo', uid: 'abc' },
                  queryType: 'search',
                  linkedQuery: {
                    expr: '{}',
                  },
                  refId: 'A',
                },
                {
                  datasource: { type: 'tempo', uid: 'abc' },
                  queryType: 'search',
                  linkedQuery: {
                    expr: '{$var}',
                  },
                  refId: 'A',
                },
                {
                  datasource: { type: 'tempo', uid: 'abc' },
                  queryType: 'serviceMap',
                  serviceMapQuery: '{}',
                  refId: 'A',
                },
                {
                  datasource: { type: 'tempo', uid: 'abc' },
                  queryType: 'serviceMap',
                  serviceMapQuery: '{$var}',
                  refId: 'A',
                },
                {
                  datasource: { type: 'tempo', uid: 'abc' },
                  queryType: 'traceql',
                  query: '{}',
                  refId: 'A',
                },
                {
                  datasource: { type: 'tempo', uid: 'abc' },
                  queryType: 'traceql',
                  query: '{$var}',
                  refId: 'A',
                },
                {
                  datasource: { type: 'tempo', uid: 'abc' },
                  queryType: 'upload',
                  refId: 'A',
                },
              ],
            },
          })
        );
      }),
    }),
    getTemplateSrv: () => ({
      containsTemplate: (val: string): boolean => {
        return val != null && val.includes('$');
      },
    }),
  };
});

describe('on dashboard loaded', () => {
  it('triggers reportInteraction with grafana_tempo_dashboard_loaded', () => {
    expect(reportInteraction).toHaveBeenCalledWith('grafana_tempo_dashboard_loaded', {
      grafana_version: 'v9.4.0',
      dashboard_id: 'dash',
      org_id: 1,
      traceql_query_count: 2,
      search_query_count: 2,
      service_map_query_count: 2,
      upload_query_count: 1,
      native_search_query_count: 3,
      traceql_queries_with_template_variables_count: 1,
      search_queries_with_template_variables_count: 1,
      service_map_queries_with_template_variables_count: 1,
      native_search_queries_with_template_variables_count: 1,
    });
  });
});
