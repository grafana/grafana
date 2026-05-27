import { contextSrv } from 'app/core/services/context_srv';

import { type CommitTemplateVars } from './commitMessage';

/**
 * Snapshot of the currently signed-in Grafana user, shaped to spread into
 * `CommitTemplateVars` so it both populates `{{userName}}` / `{{userLogin}}` /
 * `{{userEmail}}` template placeholders and feeds the `Grafana-saved-by:`
 * trailer. Returns undefined when nobody is signed in, in which case spreading
 * is a no-op.
 */
export function getCurrentCommitUser():
  | Pick<CommitTemplateVars, 'userName' | 'userLogin' | 'userEmail'>
  | undefined {
  const u = contextSrv.user;
  if (!u?.isSignedIn) {
    return undefined;
  }
  return {
    userName: u.name,
    userLogin: u.login,
    userEmail: u.email,
  };
}
