import { config } from '../config';

export async function getApiVersion(): Promise<string> {
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

export function getLegacyCacheKey(pluginId: string, _showErrorAlert = false) {
  return `getLegacySettings-${pluginId}`;
}

export function getCacheKey(pluginId: string, _showErrorAlert = false) {
  return `getAppPluginSettings-${pluginId}`;
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
