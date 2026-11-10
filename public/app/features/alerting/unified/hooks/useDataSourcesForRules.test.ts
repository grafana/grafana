import { renderHook, waitFor } from '@testing-library/react';

import { config } from '@grafana/runtime';
import { AccessControlAction } from 'app/types/accessControl';

import { grantUserPermissions, mockDataSource } from '../mocks';
import { setupDataSources } from '../testSetup/datasources';
import { getRulesDataSources } from '../utils/datasource';

import { useDataSourcesForRules } from './useDataSourcesForRules';

const originalToggle = config.defaultDatasourceManageAlertsUiToggle;

afterEach(() => {
  config.defaultDatasourceManageAlertsUiToggle = originalToggle;
  jest.restoreAllMocks();
});

// The names are out of order and mix cases, so the test also covers the sort.
function setupMixedDataSources() {
  setupDataSources(
    mockDataSource({ uid: 'zebra', name: 'Zebra', jsonData: { manageAlerts: true } }),
    mockDataSource({ uid: 'unset', name: 'ähnlich', jsonData: {} }),
    mockDataSource({ uid: 'not-managing', name: 'apple', jsonData: { manageAlerts: false } }),
    mockDataSource({ uid: 'loki', name: 'Loki', type: 'loki', jsonData: { manageAlerts: true } }),
    mockDataSource({ uid: 'graphite', name: 'Graphite', type: 'graphite', jsonData: { manageAlerts: true } }),
    mockDataSource({ uid: 'am', name: 'Alertmanager', type: 'alertmanager', jsonData: {} })
  );
}

describe('useDataSourcesForRules', () => {
  // Temporary parity check against the sync function this hook replaces.
  describe.each([
    { permissions: [AccessControlAction.AlertingRuleExternalRead], label: 'read' },
    { permissions: [AccessControlAction.AlertingRuleExternalWrite], label: 'write' },
    { permissions: [], label: 'no external rule permission' },
  ])('with $label', ({ permissions }) => {
    it.each([true, false])(
      'returns the same data sources in the same order as getRulesDataSources, with the manageAlerts default %s',
      async (defaultToggle) => {
        config.defaultDatasourceManageAlertsUiToggle = defaultToggle;
        grantUserPermissions(permissions);
        setupMixedDataSources();

        const { result } = renderHook(() => useDataSourcesForRules());

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.items.map((ds) => ds.uid)).toEqual(getRulesDataSources().map((ds) => ds.uid));
      }
    );
  });

  it('returns the rules sources that manage alerts, sorted by name', async () => {
    config.defaultDatasourceManageAlertsUiToggle = true;
    grantUserPermissions([AccessControlAction.AlertingRuleExternalRead]);
    setupMixedDataSources();

    const { result } = renderHook(() => useDataSourcesForRules());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.map((ds) => ds.name)).toEqual(['ähnlich', 'Loki', 'Zebra']);
  });

  it('returns no data sources while the list loads', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleExternalRead]);
    setupMixedDataSources();

    const { result } = renderHook(() => useDataSourcesForRules());

    expect(result.current).toEqual({ items: [], isLoading: true, error: undefined });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});
