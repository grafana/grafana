import { renderHook, waitFor } from '@testing-library/react';
import { produce } from 'immer';
import { getWrapper } from 'test/test-utils';

import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import {
  getAlertmanagerConfig,
  setAlertmanagerConfig,
} from 'app/features/alerting/unified/mocks/server/entities/alertmanagers';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';

import { useHasInhibitionRules } from './useHasInhibitionRules';

setupMswServer();

const wrapper = () => getWrapper({ renderWithRouter: true });

describe('useHasInhibitionRules', () => {
  it('should return false when no inhibition rules are configured', async () => {
    const config = getAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME);
    const configWithoutInhibitRules = produce(config, (draft) => {
      draft.alertmanager_config.inhibit_rules = [];
    });
    setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, configWithoutInhibitRules);

    const { result } = renderHook(() => useHasInhibitionRules(GRAFANA_RULES_SOURCE_NAME), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasInhibitionRules).toBe(false);
  });

  it('should return false when inhibit_rules is undefined', async () => {
    const config = getAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME);
    const configWithUndefinedInhibitRules = produce(config, (draft) => {
      delete (draft.alertmanager_config as Record<string, unknown>).inhibit_rules;
    });
    setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, configWithUndefinedInhibitRules);

    const { result } = renderHook(() => useHasInhibitionRules(GRAFANA_RULES_SOURCE_NAME), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasInhibitionRules).toBe(false);
  });

  it('should return true when inhibition rules are configured', async () => {
    const config = getAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME);
    const configWithInhibitRules = produce(config, (draft) => {
      draft.alertmanager_config.inhibit_rules = [
        {
          source_match: { severity: 'critical' },
          target_match: { severity: 'warning' },
          equal: ['alertname'],
        },
      ];
    });
    setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, configWithInhibitRules);

    const { result } = renderHook(() => useHasInhibitionRules(GRAFANA_RULES_SOURCE_NAME), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasInhibitionRules).toBe(true);
  });

  it('should return isLoading true while loading', async () => {
    const { result } = renderHook(() => useHasInhibitionRules(GRAFANA_RULES_SOURCE_NAME), { wrapper: wrapper() });

    // Initially should be loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should return false when alertmanagerSourceName is undefined', async () => {
    const { result } = renderHook(() => useHasInhibitionRules(undefined), { wrapper: wrapper() });

    expect(result.current.hasInhibitionRules).toBe(false);
  });
});
