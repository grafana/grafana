import { DashboardLoadedEvent } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
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
              'grafana-azure-monitor-datasource': [
                { queryType: 'Azure Monitor', hide: false },
                { queryType: 'Azure Log Analytics', hide: false },
                { queryType: 'Azure Resource Graph', hide: true },
                { queryType: 'Azure Monitor', hide: false },
              ],
            },
          })
        );
      }),
    }),
  };
});

describe('queriesOnInitDashboard', () => {
  it('should report a `grafana_ds_azuremonitor_dashboard_loaded` interaction ', () => {
    // subscribeDashboardLoadedEvent();
    expect(reportInteraction).toHaveBeenCalledWith('grafana_ds_azuremonitor_dashboard_loaded', {
      dashboard_id: 'dashboard123',
      grafana_version: 'v9.0.0',
      org_id: 1,
      azure_monitor_queries: 2,
      azure_log_analytics_queries: 1,
      azure_resource_graph_queries: 0,
      azure_monitor_queries_hidden: 0,
      azure_log_analytics_queries_hidden: 0,
      azure_resource_graph_queries_hidden: 1,
    });
  });
});
