import { contextSrv } from 'app/core/services/context_srv';

import { type CommitUser } from './commitMessage';

/**
 * Snapshot of the currently signed-in Grafana user, shaped for use as
 * commit-message template vars and the `Grafana-saved-by:` trailer.
 * Returns undefined when nobody is signed in (which shouldn't happen in
 * the UI flows that call this, but keeps the helper safe to use anywhere).
 */
export function getCurrentCommitUser(): CommitUser | undefined {
  const u = contextSrv.user;
  if (!u?.isSignedIn) {
    return undefined;
  }
  return {
    name: u.name,
    login: u.login,
    email: u.email,
  };
}
