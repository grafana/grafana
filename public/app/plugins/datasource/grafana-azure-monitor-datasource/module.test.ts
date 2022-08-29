import { DashboardLoadedEvent } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';

import './module';
import { AzureQueryType } from './types';

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
                { refId: 'A', queryType: 'Azure Monitor', hide: true },
                { refId: 'B', queryType: 'Azure Resource Graph', hide: false },
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
      user_id: 2,
      queries: [
        {
          query_type: 'Azure Monitor',
          hidden: true,
          datasource: {
            type: 'grafana-azure-monitor-datasource',
          },
        },
        { query_type: AzureQueryType.AzureResourceGraph, hidden: false },
      ],
    });
  });
});
