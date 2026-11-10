import { useEffect, useRef } from 'react';

import { type Config } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';

import { useAutoSyncConfigQuery } from '../../api/configApi';
import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { SYNCED_CONDITION_TYPE } from '../../utils/autoSync';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { type StagedExtraConfig, isStagedExtraConfig } from './stagedConfig';

/**
 * The staged Alertmanager import, read off the Grafana Alertmanager config it is carried on. Safe to call
 * from several components — they share one RTK Query cache entry. Pass `skip` for users who can't read
 * the Alertmanager config, so the request isn't made at all.
 */
export function useStagedConfig({ skip = false }: { skip?: boolean } = {}) {
  const { data, ...rest } = useAlertmanagerConfig(skip ? undefined : GRAFANA_RULES_SOURCE_NAME, {
    // Auto-sync can replace the staged config while the user is in another tab.
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  // A user can have at most one staged configuration at a time
  const rawStagedConfig: unknown = data?.extra_config?.[0];
  const stagedConfig: StagedExtraConfig | undefined = isStagedExtraConfig(rawStagedConfig)
    ? rawStagedConfig
    : undefined;

  return { ...rest, stagedConfig, liveConfig: data?.alertmanager_config };
}

/**
 * Re-fetches the staged config whenever the auto-sync status changes, for example when the first sync
 * lands. The status is polled already, while the Alertmanager config it changes is not, so without this
 * the page keeps showing the config from before the sync. Call it once per page: each call re-fetches.
 */
export function useRefetchStagedConfigOnSyncChange(refetch: () => void, { skip = false }: { skip?: boolean } = {}) {
  const { currentData } = useAutoSyncConfigQuery();
  const configResource: Config | undefined = currentData;
  const condition = configResource?.status?.conditions?.find((c) => c.type === SYNCED_CONDITION_TYPE);
  // lastTransitionTime only moves when the status flips, so a sync that keeps succeeding doesn't re-fetch.
  const syncStateKey = configResource
    ? [
        configResource.status?.externalAlertmanagerSync?.datasourceUid,
        condition?.status,
        condition?.reason,
        condition?.lastTransitionTime,
      ].join('|')
    : undefined;

  const previousKey = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (skip || syncStateKey === undefined) {
      return;
    }
    // The first value is what the page loaded with; only later changes mean the staged config may be stale.
    if (previousKey.current !== undefined && previousKey.current !== syncStateKey) {
      refetch();
    }
    previousKey.current = syncStateKey;
  }, [syncStateKey, refetch, skip]);
}
