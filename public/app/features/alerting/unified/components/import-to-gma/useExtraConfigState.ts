import { useMemo } from 'react';

import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

export type ExtraConfigState = 'none' | 'same' | 'different';

interface UseExtraConfigStateResult {
  /** State of existing extra config relative to the provided identifier */
  extraConfigState: ExtraConfigState;
  /** Identifier of the existing extra config, if any */
  existingIdentifier?: string;
  /** Whether data is still loading */
  isLoading: boolean;
}

/**
 * Hook to determine the state of existing extra Alertmanager configurations.
 *
 * Returns the relationship between any existing extra config and the provided identifier:
 * - 'none': No existing extra config, can import freely
 * - 'same': Existing config with same identifier, will overwrite (warning)
 * - 'different': Existing config with different identifier, cannot import (blocked)
 *
 * @param policyTreeName - The identifier to compare against existing extra configs
 */
export function useExtraConfigState(policyTreeName: string): UseExtraConfigStateResult {
  const { data: grafanaConfig, isLoading } = useAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME);

  const existingExtraConfig = grafanaConfig?.extra_config?.[0];
  const existingIdentifier = existingExtraConfig?.identifier;

  const extraConfigState = useMemo((): ExtraConfigState => {
    if (!existingIdentifier) {
      return 'none';
    }
    if (existingIdentifier === policyTreeName) {
      return 'same';
    }
    return 'different';
  }, [existingIdentifier, policyTreeName]);

  return {
    extraConfigState,
    existingIdentifier,
    isLoading,
  };
}
