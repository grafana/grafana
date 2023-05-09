import { DashboardLoadedEvent } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';

import './module';
import { AzureMonitorQuery } from './types';

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
                {
                  queryType: 'Azure Monitor',
                  hide: false,
                  azureMonitor: { resources: ['test_resource_1', 'test_resource_2'] },
                },
                { queryType: 'Azure Monitor', hide: true },
                {
                  queryType: 'Azure Log Analytics',
                  hide: false,
                  azureLogAnalytics: { resources: ['test_workspace_1', 'test_workspace_2'] },
                },
                {
                  queryType: 'Azure Log Analytics',
                  hide: true,
                },
                { queryType: 'Azure Resource Graph', hide: true, subscriptions: ['sub1', 'sub2'] },
                { queryType: 'Azure Resource Graph', hide: false },
                {
                  queryType: 'Azure Traces',
                  hide: false,
                  azureTraces: {
                    resources: ['test-ai-1', 'test-ai-2'],
                    operationId: 'test-op-id',
                    resultFormat: 'table',
                    traceTypes: ['trace'],
                    filters: [{ filters: 'test-filter', operation: 'eq', property: 'test-property' }],
                  },
                },
                { queryType: 'Azure Traces', hide: true, azureTraces: { resultFormat: 'trace' } },
              ] as AzureMonitorQuery[],
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
      azure_monitor_queries: 1,
      azure_monitor_queries_hidden: 1,
      azure_monitor_multiple_resource: 1,

      azure_log_analytics_queries: 1,
      azure_log_analytics_queries_hidden: 1,
      azure_log_multiple_resource: 1,

      azure_resource_graph_queries: 1,
      azure_resource_graph_queries_hidden: 1,
      azure_resource_graph_multiple_subscription: 1,

      azure_traces_queries: 1,
      azure_traces_queries_hidden: 1,
      azure_traces_multiple_resource: 1,
      azure_traces_table: 1,
      azure_traces_trace: 1,
      azure_traces_operation_id_specified: 1,
      azure_traces_event_type_specified: 1,
      azure_traces_filters: 1,
    });
  });
});
