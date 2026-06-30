import { config } from '../../config';
import { isFetchError } from '../backendSrv';

export function getApiVersion(): string {
  return 'v0alpha1';
}

export function getNamespace(): string {
  return config.namespace;
}

export function isAuthError(err: unknown): boolean {
  if (typeof err === 'object' && err !== null && 'status' in err && (err.status === 403 || err.status === 401)) {
    return true;
  }

  return false;
}

/**
 * Whether a plugin settings error means the plugin is simply not installed (a 404), as opposed to a
 * transient/indeterminate failure (auth / server / network). `getLegacySettings` / `getAppPluginSettings`
 * wrap the raw fetch error as the `cause`, so we unwrap one level before checking the status.
 */
export function isNotFoundError(err: unknown): boolean {
  const cause = err instanceof Error ? err.cause : err;
  return isFetchError(cause) && cause.status === 404;
}

export function getLegacyCacheKey(pluginId: string, _showErrorAlert = false) {
  return `getLegacySettings-${pluginId}`;
}

export function getCacheKey(pluginId: string, _showErrorAlert = false) {
  return `getAppPluginSettings-${pluginId}`;
}
