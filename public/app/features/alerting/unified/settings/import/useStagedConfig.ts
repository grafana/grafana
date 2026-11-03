import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { type StagedExtraConfig, isStagedExtraConfig } from './stagedConfig';

/**
 * The staged Alertmanager import, read off the Grafana Alertmanager config it is carried on. Safe to call
 * from several components — they share one RTK Query cache entry.
 */
export function useStagedConfig() {
  const { data, ...rest } = useAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME);

  // A user can have at most one staged configuration at a time
  const rawStagedConfig: unknown = data?.extra_config?.[0];
  const stagedConfig: StagedExtraConfig | undefined = isStagedExtraConfig(rawStagedConfig)
    ? rawStagedConfig
    : undefined;

  return { ...rest, stagedConfig, liveConfig: data?.alertmanager_config };
}
