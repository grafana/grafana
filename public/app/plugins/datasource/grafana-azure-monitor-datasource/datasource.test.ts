const GRAFANA_VERSION = 'v8.0.0';
import { reportInteraction } from '@grafana/runtime';

import { createMockInstanceSetttings } from './__mocks__/instanceSettings';
import createMockQuery from './__mocks__/query';
import Datasource from './datasource';
import { AzureMonitorQuery } from './types';

jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    reportInteraction: jest.fn(),
    config: {
      buildInfo: {
        version: GRAFANA_VERSION,
      },
    },
  };
});

describe('Azure Monitor Datasource', () => {
  describe('interpolateVariablesInQueries()', () => {
    it('should interpolate variables in the queries', () => {
      const ds = new Datasource(createMockInstanceSetttings());
      const queries = [createMockQuery({ azureMonitor: { resourceGroup: '$resourceGroup' } })];

      const interpolatedQueries = ds.interpolateVariablesInQueries(queries, {
        resourceGroup: { text: 'the-resource-group', value: 'the-resource-group' },
      });

      expect(interpolatedQueries).toContainEqual(
        expect.objectContaining({
          azureMonitor: expect.objectContaining({ resourceGroup: 'the-resource-group' }),
        })
      );
    });

    it('should include a datasource ref when interpolating queries', () => {
      const ds = new Datasource(createMockInstanceSetttings());
      const query = createMockQuery();
      delete query.datasource;
      const queries = [query];

      const interpolatedQueries = ds.interpolateVariablesInQueries(queries, {});

      expect(interpolatedQueries).toContainEqual(
        expect.objectContaining({
          datasource: expect.objectContaining({ type: 'azuremonitor', uid: 'abc' }),
        })
      );
    });
  });

  describe('onDashboardLoaded', () => {
    it('should report a `grafana_ds_azuremonitor_dashboard_loaded` interaction ', () => {
      const ds = new Datasource(createMockInstanceSetttings());
      ds.onDashboardLoaded({
        dashboardId: 'dashboard123',
        orgId: 1,
        queries: [
          { queryType: 'Azure Monitor', hide: false },
          { queryType: 'Azure Log Analytics', hide: false },
          { queryType: 'Azure Resource Graph', hide: true },
          { queryType: 'Azure Monitor', hide: false },
        ] as AzureMonitorQuery[],
      });

      expect(reportInteraction).toHaveBeenCalledWith('grafana_ds_azuremonitor_dashboard_loaded', {
        dashboard_id: 'dashboard123',
        grafana_version: GRAFANA_VERSION,
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
});
