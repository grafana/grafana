import { skipToken } from '@reduxjs/toolkit/query';

import { config } from '@grafana/runtime';

import { alertmanagerApi } from '../api/alertmanagerApi';
import { isAdmin } from '../utils/misc';

// GET /api/v1/ngalert/admin_config is gated behind ReqOrgAdmin server-side
// (pkg/services/ngalert/api/authorization.go), so non-admins cannot read sync
// state and this hook returns false for them. The convert API's
// IsExternalAMSyncConfiguredForOrg check is the server-side safety net.
export function useIsAutoSyncActive(): boolean {
  const flagOn = config.featureToggles['alerting.syncExternalAlertmanager'] === true;
  const { data } = alertmanagerApi.endpoints.getGrafanaAlertingConfiguration.useQuery(
    isAdmin() && flagOn ? undefined : skipToken
  );
  return Boolean(data?.external_alertmanager_uid);
}
