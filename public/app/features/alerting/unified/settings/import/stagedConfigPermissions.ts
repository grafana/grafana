import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

const ALERTMANAGER_IMPORTS_DELETE = 'notifications.alerting.grafana.app/alertmanagerimports:delete';
const INHIBITION_RULES_WRITE = 'alert.notifications.inhibition-rules:write';

// Promoting authorizes create/write on every resource type the import contains, which isn't known until
// the dry-run has parsed it. Any one of them opens the modal; the dry-run reports what's actually missing.
const PROMOTE_ACTIONS = [
  AccessControlAction.AlertingReceiversCreate,
  AccessControlAction.ActionAlertingManagedRoutesCreate,
  AccessControlAction.AlertingTemplatesWrite,
  AccessControlAction.AlertingTimeIntervalsWrite,
  INHIBITION_RULES_WRITE,
];

export interface StagedConfigPermissions {
  canPromote: boolean;
  canRevert: boolean;
}

/**
 * Whether the current user may promote or revert a staged import. Drives only the buttons' disabled state:
 * `contextSrv` can't evaluate resource scopes, so a user scoped to a different import still sees an enabled
 * button and gets a 403. The backend authorizes both actions independently and remains authoritative.
 */
export function getStagedConfigPermissions(): StagedConfigPermissions {
  const hasLegacyWrite = contextSrv.hasPermission(AccessControlAction.AlertingNotificationsWrite);

  return {
    canPromote: hasLegacyWrite || PROMOTE_ACTIONS.some((action) => contextSrv.hasPermission(action)),
    canRevert: hasLegacyWrite || contextSrv.hasPermission(ALERTMANAGER_IMPORTS_DELETE),
  };
}
