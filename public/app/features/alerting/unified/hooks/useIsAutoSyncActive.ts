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
// Sourced from the per-org Config resource (notifications.alerting.grafana.app), whose read
// action is granted to Viewer — so this works for non-admins too, unlike the legacy
// admin-only /api/v1/ngalert/admin_config it replaces. The Config resource is also the
// syncer's own source of truth, so this mirrors what the backend actually syncs.
//
// We read status (not spec): status.externalAlertmanagerSync.datasourceUid is the UID used on
// the last sync attempt, so it reflects an actually-active sync regardless of how it was
// configured — including the `ini` operator override, which never appears in spec. Trade-off:
// in the brief window after sync is first enabled (before the first tick writes status) this
// returns false; the backend convert API rejects imports there, so it's a UX gap, not a hole.
//
// Fail-open: while loading or on a 404/403 (resource absent or no read access) data is
// undefined and this returns false.
export function useIsAutoSyncActive(): boolean {
  const flagOn = config.featureToggles['alerting.syncExternalAlertmanager'] === true;
  const canReadConfig = contextSrv.hasPermission(AccessControlAction.ActionAlertingNotificationsConfigRead);
  const { data } = useGetConfigQuery(flagOn && canReadConfig ? { name: CONFIG_SINGLETON_NAME } : skipToken);
  return Boolean(data?.status?.externalAlertmanagerSync?.datasourceUid);
}
