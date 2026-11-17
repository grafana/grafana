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

const apiVersionPattern = /^v[0-9]+(?:(?:alpha|beta)[0-9]+)?$/;
export function assertApiVersion(apiVersion = ''): void {
  if (typeof apiVersion !== 'string' || !apiVersionPattern.test(apiVersion)) {
    throw new Error(`Invalid API version "${apiVersion}"`);
  }
}
