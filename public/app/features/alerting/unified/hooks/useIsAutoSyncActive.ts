import { skipToken } from '@reduxjs/toolkit/query';

import { useGetConfigQuery } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

// The per-org alerting Config resource is a singleton at this fixed name (backend
// ConfigSingletonName).
const CONFIG_SINGLETON_NAME = 'default';

// Reports whether external (Mimir/Cortex) Alertmanager sync is actively running for the org.
//
// Sourced from the per-org Config resource (notifications.alerting.grafana.app)
// Fail-open: while loading or on a 404/403 (resource absent or no read access) data is
// undefined and this returns false.
export function useIsAutoSyncActive(): boolean {
  const flagOn = config.featureToggles['alerting.syncExternalAlertmanager'] === true;
  const canReadConfig = contextSrv.hasPermission(AccessControlAction.ActionAlertingNotificationsConfigRead);
  const { data } = useGetConfigQuery(flagOn && canReadConfig ? { name: CONFIG_SINGLETON_NAME } : skipToken);
  return Boolean(data?.status?.externalAlertmanagerSync?.datasourceUid);
}
