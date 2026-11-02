import { skipToken } from '@reduxjs/toolkit/query';

import { generatedAPI } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

export const configApi = generatedAPI;

/**
 * Config is a per-org singleton served at this fixed name. Humans cannot create it, so a 404 means
 * the sync worker has not seeded it yet — not a wrong name.
 */
export const CONFIG_SINGLETON_NAME = 'default';

type GetConfigQueryOptions = Parameters<typeof configApi.useGetConfigQuery>[1];

/** Auto-sync specific: the flag gate would be wrong for a consumer of some other Config field. */
export function useAutoSyncConfigQuery(options?: GetConfigQueryOptions) {
  const flagOn = config.featureToggles['alerting.syncExternalAlertmanager'] === true;
  const canReadConfig = contextSrv.hasPermission(AccessControlAction.ActionAlertingNotificationsConfigRead);

  return configApi.useGetConfigQuery(flagOn && canReadConfig ? { name: CONFIG_SINGLETON_NAME } : skipToken, options);
}
