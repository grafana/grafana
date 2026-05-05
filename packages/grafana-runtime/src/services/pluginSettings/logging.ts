import { getLogger } from '../logging/registry';

export function logPluginSettingsWarning(message: string, pluginId: string): void {
  getLogger('grafana/runtime.plugins.settings').logWarning(message, { pluginId });
}

export function logPluginSettingsError(message: string, error: unknown): void {
  getLogger('grafana/runtime.plugins.settings').logError(new Error(message, { cause: error }));
}
