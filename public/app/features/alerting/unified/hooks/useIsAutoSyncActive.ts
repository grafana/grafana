import { skipToken } from '@reduxjs/toolkit/query';

import { type Config, useGetConfigQuery } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

// The per-org alerting Config resource is a singleton at this fixed name (backend
// ConfigSingletonName).
const CONFIG_SINGLETON_NAME = 'default';

// Mirrors the syncer's condition contract (conditionTypeExternalAlertmanagerSynced and
// conditionReasonNotConfigured in pkg/services/ngalert/notifier/external_am_syncer.go). The generated
// client types both fields as plain strings, so nothing links these to the backend at compile time.
const SYNCED_CONDITION_TYPE = 'ExternalAlertmanagerSynced';
const REASON_NOT_CONFIGURED = 'NotConfigured';

interface AutoSyncState {
  isActive: boolean;
  /** Datasource the org syncs from. Undefined while loading, when sync is off, or when the Config is unreadable. */
  datasourceUid?: string;
  isLoading: boolean;
}

/**
 * The datasource UID the sync worker will actually use, resolved the way the backend does in
 * resolveExternalAMUIDForOrg: the operator ini override first, then the per-org spec.
 *
 * Status is ignored at the "api" origin because it holds the last sync attempt and lags — it stays
 * populated after sync is disabled and restarted, so it reports active when it isn't. The ini
 * override (unified_alerting.external_alertmanager_uid) is the exception: it never reaches spec, so
 * status is the only place it surfaces. A stale ini reading is released by the
 * ExternalAlertmanagerSynced/NotConfigured condition, which the syncer writes on the first tick after
 * sync stops (every alertmanager_config_poll_interval, default 1 minute) while deliberately keeping
 * externalAlertmanagerSync as last-attempt context.
 *
 * Residual gap: before the syncer's first tick status is empty, so an ini-configured sync is
 * invisible here. IsExternalAMSyncConfiguredForOrg on the convert endpoint stays the real guard.
 */
export function resolveEffectiveSyncUid(orgConfig?: Config): string | undefined {
  const lastAttempt = orgConfig?.status?.externalAlertmanagerSync;
  const syncTurnedOff = orgConfig?.status?.conditions?.some(
    (condition) => condition.type === SYNCED_CONDITION_TYPE && condition.reason === REASON_NOT_CONFIGURED
  );

  if (lastAttempt?.origin === 'ini' && !syncTurnedOff && lastAttempt.datasourceUid) {
    return lastAttempt.datasourceUid;
  }
  return orgConfig?.spec?.externalAlertmanagerSync?.datasourceUid;
}

// Reports whether external (Mimir/Cortex) Alertmanager sync is actively running for the org.
//
// Sourced from the per-org Config resource (notifications.alerting.grafana.app); see
// resolveEffectiveSyncUid for how spec and status combine. Gated on the
// ActionAlertingNotificationsConfigRead permission so non-admins who legitimately hold it are also
// blocked while sync is active. Fail-open: while loading or on a 404/403 (resource absent or no read
// access) data is undefined, so isActive is false; when the query is skipped (flag off or no read
// access) isLoading is also false.
export function useIsAutoSyncActive(): AutoSyncState {
  const flagOn = config.featureToggles['alerting.syncExternalAlertmanager'] === true;
  const canReadConfig = contextSrv.hasPermission(AccessControlAction.ActionAlertingNotificationsConfigRead);
  const { data, isLoading } = useGetConfigQuery(flagOn && canReadConfig ? { name: CONFIG_SINGLETON_NAME } : skipToken);
  const datasourceUid = resolveEffectiveSyncUid(data);
  return { isActive: Boolean(datasourceUid), datasourceUid, isLoading };
}
