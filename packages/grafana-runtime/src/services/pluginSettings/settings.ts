import { PluginType } from '@grafana/data';

import { config } from '../../config';

import { getPluginSettings } from './getPluginSettings';
import { logPluginSettingsError, logPluginSettingsWarning } from './logging';

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

export async function getAppPluginEnabled(pluginId: string): Promise<boolean> {
  const app = await getPluginSettings(pluginId);
  if (!app) {
    return false;
  }

  return app.type === PluginType.app && Boolean(app.enabled);
}

/**
 * Check if an app plugin is installed and enabled.
 * @param pluginId - The id of the app plugin.
 * @returns True if the app plugin is installed and enabled, false otherwise.
 */
export async function isAppPluginEnabled(pluginId: string): Promise<boolean> {
  try {
    const enabled = await getAppPluginEnabled(pluginId);
    return enabled;
  } catch (error) {
    if (isAuthError(error)) {
      logPluginSettingsWarning(`isAppPluginEnabled: failed because auth denied`, pluginId);
    } else {
      logPluginSettingsError(`isAppPluginEnabled failed for plugin with id ${pluginId}`, error);
    }
  }
  return false;
}
