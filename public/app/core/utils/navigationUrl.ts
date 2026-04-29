import { appendOrgIdToPath } from '@grafana/runtime';

import { contextSrv } from '../services/context_srv';

/**
 * Appends ?orgId=<N> to a path if it is not already present.
 * Use this for React Router <Link to> props, which bypass locationService
 * and therefore don't benefit from the automatic orgId injection there.
 */
export function appendOrgId(path: string): string {
  return appendOrgIdToPath(path, contextSrv.user.orgId);
}
