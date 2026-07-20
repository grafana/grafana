import { skipToken } from '@reduxjs/toolkit/query';

import { useGetConfigQuery } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

// The per-org alerting Config resource is a singleton at this fixed name (backend
// ConfigSingletonName).
const CONFIG_SINGLETON_NAME = 'default';

interface AutoSyncState {
  isActive: boolean;
  isLoading: boolean;
}

// Reports whether external (Mimir/Cortex) Alertmanager sync is actively running for the org.
//
// Sourced from the per-org Config resource (notifications.alerting.grafana.app), gated on the
// ActionAlertingNotificationsConfigRead permission so non-admins who legitimately hold it are
// also blocked while sync is active. Fail-open: while loading or on a 404/403 (resource absent
// or no read access) data is undefined, so isActive is false. When the query is skipped
// (flag off or no read access) isLoading is also false.
export function useIsAutoSyncActive(): AutoSyncState {
  const flagOn = config.featureToggles['alerting.syncExternalAlertmanager'] === true;
  const canReadConfig = contextSrv.hasPermission(AccessControlAction.ActionAlertingNotificationsConfigRead);
  const { data, isLoading } = useGetConfigQuery(flagOn && canReadConfig ? { name: CONFIG_SINGLETON_NAME } : skipToken);
  return { isActive: Boolean(data?.status?.externalAlertmanagerSync?.datasourceUid), isLoading };
}
