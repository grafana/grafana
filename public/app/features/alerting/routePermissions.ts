import { userHasAllPermissions } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

export {
  PERMISSIONS_CONTACT_POINTS,
  PERMISSIONS_NOTIFICATION_POLICIES,
  PERMISSIONS_TEMPLATES,
  PERMISSIONS_TIME_INTERVALS_MODIFY,
  PERMISSIONS_TIME_INTERVALS_READ,
} from './unified/utils/alertmanagerPermissions';

export function evaluateAccess(actions: AccessControlAction[]) {
  return () => contextSrv.evaluatePermission(actions);
}

export function evaluateAccessAll(actions: AccessControlAction[]) {
  return () => (userHasAllPermissions(actions, contextSrv.user) ? [] : ['Reject']);
}
