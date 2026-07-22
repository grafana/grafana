import { skipToken } from '@reduxjs/toolkit/query';

import { config } from '@grafana/runtime';

import { alertmanagerApi } from '../api/alertmanagerApi';
import { isAdmin } from '../utils/misc';

interface AutoSyncState {
  isActive: boolean;
  isLoading: boolean;
}

// GET /api/v1/ngalert/admin_config is gated behind ReqOrgAdmin server-side
// (pkg/services/ngalert/api/authorization.go), so non-admins cannot read sync
// state and this hook returns isActive=false for them (the query is skipped, so
// isLoading is also false). The convert API's IsExternalAMSyncConfiguredForOrg
// check is the server-side safety net.
export function useIsAutoSyncActive(): AutoSyncState {
  const flagOn = config.featureToggles['alerting.syncExternalAlertmanager'] === true;
  const { data, isLoading } = alertmanagerApi.endpoints.getGrafanaAlertingConfiguration.useQuery(
    isAdmin() && flagOn ? undefined : skipToken
  );
  return { isActive: Boolean(data?.external_alertmanager_uid), isLoading };
}
