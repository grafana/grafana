import { skipToken } from '@reduxjs/toolkit/query';

import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { CONFIG_SINGLETON_NAME, configApi } from '../api/configApi';

interface AutoSyncState {
  isActive: boolean;
  isLoading: boolean;
}

// Reports whether external (Mimir/Cortex) Alertmanager sync is actively running for the org.
//
// Sourced from the per-org Config resource (notifications.alerting.grafana.app), from two places:
//
//   - spec.externalAlertmanagerSync.datasourceUid — the desired configuration, for API-managed orgs.
//     We deliberately do not read status.externalAlertmanagerSync for this case: status holds the
//     last sync attempt and lags, staying populated after sync is disabled, so it would report
//     active when it isn't.
//   - status.externalAlertmanagerSync with origin='ini' — an operator-configured sync
//     (unified_alerting.external_alertmanager_uid). spec is dormant for those orgs, so status is the
//     only surface, and the lag concern doesn't apply: the ini key can only change with a restart.
//
// Gated on the ActionAlertingNotificationsConfigRead permission so non-admins who legitimately hold
// it are also blocked while sync is active. Fail-open: while loading or on a 404/403 (resource absent
// or no read access) data is undefined, so isActive is false; when the query is skipped (flag off or
// no read access) isLoading is also false. The backend convert endpoint's
// IsExternalAMSyncConfiguredForOrg check remains the real safety net.
export function useIsAutoSyncActive(): AutoSyncState {
  const flagOn = config.featureToggles['alerting.syncExternalAlertmanager'] === true;
  const canReadConfig = contextSrv.hasPermission(AccessControlAction.ActionAlertingNotificationsConfigRead);
  const { data, isLoading } = configApi.useGetConfigQuery(
    flagOn && canReadConfig ? { name: CONFIG_SINGLETON_NAME } : skipToken
  );

  const observedSync = data?.status?.externalAlertmanagerSync;
  const iniUid = observedSync?.origin === 'ini' ? observedSync.datasourceUid : undefined;
  const specUid = data?.spec?.externalAlertmanagerSync?.datasourceUid;

  return { isActive: Boolean(iniUid || specUid), isLoading };
}
