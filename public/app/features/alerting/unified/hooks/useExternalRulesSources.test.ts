import { renderHook, waitFor } from '@testing-library/react';

import { AccessControlAction } from 'app/types/accessControl';

import { grantUserPermissions, mockDataSource } from '../mocks';
import { setupDataSources } from '../testSetup/datasources';
import { getExternalRulesSources } from '../utils/datasource';

import { useExternalRulesSources } from './useExternalRulesSources';

describe('useExternalRulesSources', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingRuleExternalRead]);
    setupDataSources(
      mockDataSource({ uid: 'zebra', name: 'Zebra', jsonData: { manageAlerts: true } }),
      mockDataSource({ uid: 'not-managing', name: 'apple', jsonData: { manageAlerts: false } }),
      mockDataSource({ uid: 'loki', name: 'Loki', type: 'loki', jsonData: { manageAlerts: true } }),
      mockDataSource({ uid: 'graphite', name: 'Graphite', type: 'graphite', jsonData: { manageAlerts: true } })
    );
  });

  // Temporary parity check against the sync function this hook replaces.
  it('returns the same rules sources in the same order as getExternalRulesSources', async () => {
    const { result } = renderHook(() => useExternalRulesSources());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toEqual(getExternalRulesSources());
    expect(result.current.items).toEqual([
      { name: 'Loki', uid: 'loki', ruleSourceType: 'datasource' },
      { name: 'Zebra', uid: 'zebra', ruleSourceType: 'datasource' },
    ]);
  });

  it('returns no rules sources while the list loads', async () => {
    const { result } = renderHook(() => useExternalRulesSources());

    expect(result.current).toEqual({ items: [], isLoading: true, error: undefined });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});
