import { userHasAllPermissions } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';
import type { AccessControlAction } from 'app/types/accessControl';

// evaluateAccess uses contextSrv.evaluatePermission directly (route-guard API).

/**
 * Returns a route-guard thunk for Grafana's route config.
 * The returned function is called at navigation time to check if the user can
 * access the route.
 */
export function evaluateAccess(actions: AccessControlAction[]) {
  return () => contextSrv.evaluatePermission(actions);
}

/**
 * Like `evaluateAccess`, but requires the user to hold ALL of the given actions (AND
 * semantics) rather than any one of them. Use when access depends on a combination of
 * permissions — e.g. the import-to-GMA route, which needs both the convert endpoint's
 * rule-create and provisioning-set-status permissions.
 */
export function evaluateAccessAll(actions: AccessControlAction[]) {
  return () => (userHasAllPermissions(actions, contextSrv.user) ? [] : ['Reject']);
}
