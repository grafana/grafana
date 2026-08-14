import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

const ALERTMANAGER_IMPORTS_DELETE = 'notifications.alerting.grafana.app/alertmanagerimports:delete';

export interface StagedConfigPermissions {
  canRevert: boolean;
}

/**
 * Whether the current user may revert a staged import. Drives only the button's disabled state:
 * `contextSrv` can't evaluate resource scopes, so a user scoped to a different import still sees an enabled
 * button and gets a 403. The backend remains authoritative.
 */
export function getStagedConfigPermissions(): StagedConfigPermissions {
  const hasLegacyWrite = contextSrv.hasPermission(AccessControlAction.AlertingNotificationsWrite);

  return {
    canRevert: hasLegacyWrite || contextSrv.hasPermission(ALERTMANAGER_IMPORTS_DELETE),
  };
}
