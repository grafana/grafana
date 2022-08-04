import { reportInteraction } from '@grafana/runtime';

import { createMockInstanceSetttings } from './__mocks__/instanceSettings';
import createMockQuery from './__mocks__/query';
import Datasource from './datasource';
import { AzureQueryType } from './types';

jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    reportInteraction: jest.fn(),
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

  describe('queriesOnInitDashboard', () => {
    it('should report a `grafana_ds_azuremonitor_dashboard_loaded` interaction ', () => {
      const ds = new Datasource(createMockInstanceSetttings());
      const queries = [
        createMockQuery({ queryType: AzureQueryType.AzureMonitor, hide: true }),
        createMockQuery({ queryType: AzureQueryType.AzureResourceGraph, hide: false }),
      ];

      ds.onTrackQuery({ queries, dashboardId: 'dashboard123', orgId: 1, userId: 2, grafanaVersion: 'v9.0.0' });

      expect(reportInteraction).toBeCalledTimes(1);
      expect(reportInteraction).toHaveBeenCalledWith('grafana_ds_azuremonitor_dashboard_loaded', {
        dashboard_id: 'dashboard123',
        grafana_version: 'v9.0.0',
        org_id: 1,
        user_id: 2,
        queries: [
          {
            query_type: 'Azure Monitor',
            hidden: true,
          },
          {
            query_type: 'Azure Resource Graph',
            hidden: false,
          },
        ],
      });
    });
  });
});
