import { config } from '../config';

import { resolveAPIVersion } from './apiDiscovery/resolve';

export const SUPPORTED_APP_PLUGIN_API_VERSIONS: readonly string[] = ['v0alpha1'];

export async function getApiVersion(): Promise<string> {
  return 'v0alpha1';
}

const apiGroupLabelPattern = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

/**
 * Resolves the version of an app plugin's API, whose group is the plugin ID. `undefined` means the
 * group is not served or discovery could not answer, so the caller uses the legacy endpoint.
 */
export async function resolveAppPluginAPIVersion(pluginId: string): Promise<string | undefined> {
  // Plugin IDs may hold uppercase letters and underscores, which no API group can, so such a plugin is
  // never served and asking discovery would only log a warning on every call.
  if (!apiGroupLabelPattern.test(pluginId)) {
    return undefined;
  }
  return resolveAPIVersion(pluginId, SUPPORTED_APP_PLUGIN_API_VERSIONS);
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

export function getLegacyCacheKey(pluginId: string, _showErrorAlert = false) {
  return `getLegacySettings-${pluginId}`;
}

// Keyed by version, so settings fetched in one version are never served after discovery resolves another.
export function getCacheKey(pluginId: string, apiVersion: string) {
  return `getAppPluginSettings-${pluginId}-${apiVersion}`;
}

const pluginIdFormatPattern = /^[a-zA-Z0-9_-]+$/;
export function assertPluginIdFormat(pluginId = ''): void {
  if (typeof pluginId !== 'string' || !pluginIdFormatPattern.test(pluginId)) {
    throw new Error(`Invalid plugin ID "${pluginId}"`);
  }
}

// A Kubernetes API version, such as v1, v2beta1 or v0alpha1. Captures the major version, the level and its number.
export const API_VERSION_PATTERN = /^v(\d+)(?:(alpha|beta)(\d+))?$/;
export function assertApiVersion(apiVersion = ''): void {
  if (typeof apiVersion !== 'string' || !API_VERSION_PATTERN.test(apiVersion)) {
    throw new Error(`Invalid API version "${apiVersion}"`);
  }
}
const uidPattern = /^[a-zA-Z0-9_-]{1,40}$/;
export function assertUIDFormat(uid = ''): void {
  if (typeof uid !== 'string' || !uidPattern.test(uid)) {
    throw new Error(`Invalid UID "${uid}"`);
  }
}
