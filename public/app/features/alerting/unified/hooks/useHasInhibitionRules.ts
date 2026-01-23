import { useMemo } from 'react';

import { useAlertmanagerConfig } from './useAlertmanagerConfig';

/**
 * Hook to detect if the selected Alertmanager has inhibition rules configured.
 * @param alertmanagerSourceName - The name of the Alertmanager datasource
 * @returns An object with `hasInhibitionRules` boolean and `isLoading` state
 */
export function useHasInhibitionRules(alertmanagerSourceName: string | undefined) {
  const { data: config, isLoading } = useAlertmanagerConfig(alertmanagerSourceName);

  const hasInhibitionRules = useMemo(() => {
    const rules = config?.alertmanager_config?.inhibit_rules;
    return Array.isArray(rules) && rules.length > 0;
  }, [config]);

  return { hasInhibitionRules, isLoading };
}
