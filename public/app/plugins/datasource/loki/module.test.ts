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
              loki: [
                {
                  datasource: { type: 'loki', uid: 'abc' },
                  editorMode: 'builder',
                  expr: '{place="$place"} |= ``',
                  queryType: 'range',
                  refId: 'A',
                },
                {
                  datasource: { type: 'loki', uid: 'abc' },
                  editorMode: 'builder',
                  expr: '{place="$place"} |= `error`',
                  maxLines: 60,
                  queryType: 'instant',
                  refId: 'A',
                },
                {
                  datasource: { type: 'loki', uid: 'abc' },
                  editorMode: 'builder',
                  expr: 'count_over_time({place="$place"} [5m])',
                  legendFormat: '{{place}}',
                  maxLines: 60,
                  queryType: 'range',
                  refId: 'A',
                  resolution: 1,
                },
                {
                  datasource: { type: 'loki', uid: 'abc' },
                  editorMode: 'code',
                  expr: 'count_over_time({place="moon"} [5m])',
                  legendFormat: '{{place}}',
                  queryType: 'range',
                  refId: 'A',
                },
                {
                  datasource: { type: 'loki', uid: 'abc' },
                  editorMode: 'code',
                  expr: 'count_over_time({place="luna"} [5m])',
                  legendFormat: '{{place}}',
                  queryType: 'range',
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

describe('queriesOnInitDashboard', () => {
  it('should report a grafana_loki_dashboard_loaded interaction ', () => {
    // subscribeDashboardLoadedEvent();
    expect(reportInteraction).toHaveBeenCalledWith('grafana_loki_dashboard_loaded', {
      builder_mode_queries_count: 3,
      grafana_version: 'v9.0.0',
      dashboard_id: 'dashboard123',
      org_id: 1,
      code_mode_queries_count: 2,
      instant_queries_count: 1,
      logs_queries_count: 2,
      metric_queries_count: 3,
      queries_count: 5,
      queries_with_changed_legend_count: 3,
      queries_with_changed_line_limit_count: 2,
      queries_with_changed_resolution_count: 0,
      queries_with_template_variables_count: 2,
      range_queries_count: 4,
    });
  });
});
