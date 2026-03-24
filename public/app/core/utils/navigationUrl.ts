import { contextSrv } from '../services/context_srv';

/**
 * Appends ?orgId=<N> to a path if it is not already present.
 * Use this for React Router <Link to> props, which bypass locationService
 * and therefore don't benefit from the automatic orgId injection there.
 */
export function appendOrgId(path: string): string {
  const orgId = contextSrv.user.orgId;
  if (!orgId || path.includes('orgId=')) {
    return path;
  }
  return path + (path.includes('?') ? '&' : '?') + `orgId=${orgId}`;
}
