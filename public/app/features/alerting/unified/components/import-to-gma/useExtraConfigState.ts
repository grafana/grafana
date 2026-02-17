import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

interface UseExtraConfigStateResult {
  /** Identifier of the existing extra config that will be replaced, if any */
  existingIdentifier?: string;
  /** Whether data is still loading */
  isLoading: boolean;
}

/**
 * Hook to check if there is an existing imported Alertmanager configuration.
 *
 * If an extra config already exists, `existingIdentifier` will be set to its name,
 * signalling that importing will replace it.
 */
export function useExtraConfigState(): UseExtraConfigStateResult {
  const { data: grafanaConfig, isLoading } = useAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME);

  const existingIdentifier = grafanaConfig?.extra_config?.[0]?.identifier;

  return {
    existingIdentifier,
    isLoading,
  };
}
