import { config } from '../config';

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

export function getLegacyCacheKey(pluginId: string, _showErrorAlert = false) {
  return `getLegacySettings-${pluginId}`;
}

export function getCacheKey(pluginId: string, _showErrorAlert = false) {
  return `getAppPluginSettings-${pluginId}`;
}

const pluginIdPattern = /^[0-9a-z]+\-([0-9a-z]+\-)?(app|panel|datasource)$/;

export function validatePluginId(pluginId: string): boolean {
  if (!pluginId) {
    return false;
  }

  return pluginIdPattern.test(pluginId);
}

const apiVersionPattern = /^v[0-9]+(?:(?:alpha|beta)[0-9]+)?$/;

export function isValidApiVersion(apiVersion?: string): boolean {
  if (!apiVersion) {
    return false;
  }

  return apiVersionPattern.test(apiVersion);
}
