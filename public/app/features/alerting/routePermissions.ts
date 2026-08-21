import { userHasAllPermissions } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

// Keep route permissions separate from React ability hooks because this module loads during app startup.
export const ROUTE_PERMISSIONS_CONTACT_POINTS = [
  AccessControlAction.AlertingNotificationsRead,
  AccessControlAction.AlertingNotificationsWrite,
  AccessControlAction.AlertingReceiversRead,
  AccessControlAction.AlertingReceiversCreate,
  AccessControlAction.AlertingReceiversWrite,
  AccessControlAction.AlertingReceiversDelete,
  AccessControlAction.AlertingReceiversTest,
  AccessControlAction.AlertingReceiversTestCreate,
];

export const ROUTE_PERMISSIONS_NOTIFICATION_POLICIES = [
  AccessControlAction.AlertingNotificationsRead,
  AccessControlAction.AlertingNotificationsWrite,
  AccessControlAction.AlertingRoutesRead,
  AccessControlAction.AlertingRoutesWrite,
  AccessControlAction.ActionAlertingManagedRoutesRead,
  AccessControlAction.ActionAlertingManagedRoutesWrite,
  AccessControlAction.ActionAlertingManagedRoutesCreate,
  AccessControlAction.ActionAlertingManagedRoutesDelete,
];

export const ROUTE_PERMISSIONS_TEMPLATES = [
  AccessControlAction.AlertingNotificationsRead,
  AccessControlAction.AlertingNotificationsWrite,
  AccessControlAction.AlertingTemplatesRead,
  AccessControlAction.AlertingTemplatesWrite,
  AccessControlAction.AlertingTemplatesDelete,
  AccessControlAction.AlertingNotificationsTemplatesTest,
];

export const ROUTE_PERMISSIONS_TIME_INTERVALS_READ = [AccessControlAction.AlertingTimeIntervalsRead];

export const ROUTE_PERMISSIONS_TIME_INTERVALS_MODIFY = [
  AccessControlAction.AlertingNotificationsWrite,
  AccessControlAction.AlertingTimeIntervalsWrite,
];

export function evaluateAccess(actions: AccessControlAction[]) {
  return () => contextSrv.evaluatePermission(actions);
}

export function evaluateAccessAll(actions: AccessControlAction[]) {
  return () => (userHasAllPermissions(actions, contextSrv.user) ? [] : ['Reject']);
}
