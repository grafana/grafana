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
            grafanaVersion: 'v10.0.0',
            queries: {
              tempo: [
                {
                  datasource: { type: 'tempo', uid: 'abc' },
                  queryType: 'traceql',
                  refId: 'A',
                },
                {
                  datasource: { type: 'tempo', uid: 'abc' },
                  queryType: 'search',
                  refId: 'A',
                },
                {
                  datasource: { type: 'tempo', uid: 'abc' },
                  queryType: 'serviceMap',
                  refId: 'A',
                },
                {
                  datasource: { type: 'tempo', uid: 'abc' },
                  queryType: 'upload',
                  refId: 'A',
                },
                {
                  datasource: { type: 'tempo', uid: 'abc' },
                  queryType: 'nativeSearch',
                  refId: 'A',
                },
                {
                  datasource: { type: 'tempo', uid: 'abc' },
                  queryType: 'nativeSearch',
                  refId: 'A',
                },
              ],
            },
          })
        );
      }),
    }),
  };
});

describe('on dashboard loaded', () => {
  it('triggers reportInteraction with grafana_tempo_dashboard_loaded', () => {
    expect(reportInteraction).toHaveBeenCalledWith('grafana_tempo_dashboard_loaded', {
      grafana_version: 'v10.0.0',
      dashboard_id: 'dash',
      org_id: 1,
      traceql_query_count: 1,
      search_query_count: 1,
      service_map_query_count: 1,
      upload_query_count: 1,
      native_search_query_count: 2,
    });
  });
});
