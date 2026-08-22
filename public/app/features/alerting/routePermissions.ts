import { userHasAllPermissions } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';
import type { AccessControlAction } from 'app/types/accessControl';

export function evaluateAccess(actions: AccessControlAction[]) {
  return () => contextSrv.evaluatePermission(actions);
}

export function evaluateAccessAll(actions: AccessControlAction[]) {
  return () => (userHasAllPermissions(actions, contextSrv.user) ? [] : ['Reject']);
}
