import { CurrentUser } from '@grafana/data';

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
