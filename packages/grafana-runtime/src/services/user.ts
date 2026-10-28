import { type CurrentUser } from '@grafana/data';

import { config } from '../config';

let singletonInstance: CurrentUser | null = null;

/**
 * Used during startup by Grafana to set the current user so it is available
 * for rbac checks.
 *
 * @internal
 */
export function setCurrentUser(instance: CurrentUser) {
  if (singletonInstance) {
    throw new Error('User should only be set once, when Grafana is starting.');
  }
  singletonInstance = instance;
}

/**
 * Used to retrieve the current user.
 *
 * @internal
 *
 */
export function getCurrentUser(): CurrentUser {
  if (!singletonInstance) {
    throw new Error('User can only be used after Grafana instance has started.');
  }
  return singletonInstance;
}

/**
 * Whether the user is signed in or uses anonymous access. Both have an org role, and both pass
 * the `/apis/*` sign-in check. A visitor without a session (e.g. on the login page) has none.
 *
 * Reads boot data rather than `getCurrentUser()`, so it also works before the user is set.
 *
 * @internal
 */
export function isSignedInOrAnonymous(): boolean {
  return Boolean(config.bootData.user?.orgRole);
}

/**
 * Whether the user is signed in, uses anonymous access, or views a public dashboard.
 *
 * @internal
 */
export function isSignedInAnonymousOrPublicAccess(): boolean {
  return isSignedInOrAnonymous() || Boolean(config.publicDashboardAccessToken);
}

/**
 * The request needs a user session, and there is none. Nothing was sent to the backend.
 *
 * `isHandled` marks the failure as expected, so `getCachedPromise` does not log it.
 *
 * @internal
 */
export class NoUserSessionError extends Error {
  readonly isHandled = true;

  constructor() {
    super('No user session: the request needs a signed-in or anonymous user');
    this.name = 'NoUserSessionError';
  }
}
