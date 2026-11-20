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
