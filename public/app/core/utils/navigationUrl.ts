import { contextSrv } from '../services/context_srv';

/**
 * Appends the current orgId as a query param if not already present.
 * Used to keep ?orgId in the URL after programmatic navigation so links
 * remain shareable and reloadable when the user is in a non-default org.
 */
export function appendOrgId(path: string): string {
  const orgId = contextSrv.user.orgId;
  if (!orgId || path.includes('orgId=')) {
    return path;
  }
  return path + (path.includes('?') ? '&' : '?') + `orgId=${orgId}`;
}
