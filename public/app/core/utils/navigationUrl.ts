import { contextSrv } from '../services/context_srv';

/**
 * Appends ?orgId=<N> to a path if it is not already present.
 * Use this for React Router <Link to> props, which bypass locationService
 * and therefore don't benefit from the automatic orgId injection there.
 */
export function appendOrgId(path: string): string {
  const orgId = contextSrv.user.orgId;
  if (!orgId) {
    return path;
  }
  const hashIndex = path.indexOf('#');
  const pathAndQuery = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const fragment = hashIndex >= 0 ? path.slice(hashIndex) : '';
  if (pathAndQuery.includes('orgId=')) {
    return path;
  }
  return pathAndQuery + (pathAndQuery.includes('?') ? '&' : '?') + `orgId=${orgId}` + fragment;
}
