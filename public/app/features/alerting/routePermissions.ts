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

/** Like `evaluateAccess`, for a check the "any of these actions" rule can't express, e.g. requiring several. */
export function allowIf(isAllowed: () => boolean) {
  // 'Reject' is the role no user has, which is how route guards deny access.
  return () => (isAllowed() ? [] : ['Reject']);
}
