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
// Sourced from spec.externalAlertmanagerSync on the per-org Config resource
// (notifications.alerting.grafana.app). We read spec (the desired configuration), not status: status
// holds the last sync attempt and lags — it stays populated after sync is disabled + restarted, so it
// reports active when it isn't. Gated on the ActionAlertingNotificationsConfigRead permission so
// non-admins who legitimately hold it are also blocked while sync is active. Fail-open: while loading
// or on a 404/403 (resource absent or no read access) data is undefined, so isActive is false; when
// the query is skipped (flag off or no read access) isLoading is also false.
//
// Known gap: spec does not reflect an ini-configured sync (unified_alerting.external_alertmanager_uid),
// which surfaces only in status with origin='ini'. The backend convert endpoint's
// IsExternalAMSyncConfiguredForOrg check is the real safety net; covering the ini case in the frontend
// would require exposing the setting through frontend settings (a separate backend change).
export function useIsAutoSyncActive(): AutoSyncState {
  const flagOn = config.featureToggles['alerting.syncExternalAlertmanager'] === true;
  const canReadConfig = contextSrv.hasPermission(AccessControlAction.ActionAlertingNotificationsConfigRead);
  const { data, isLoading } = useGetConfigQuery(flagOn && canReadConfig ? { name: CONFIG_SINGLETON_NAME } : skipToken);
  return { isActive: Boolean(data?.spec?.externalAlertmanagerSync?.datasourceUid), isLoading };
}
