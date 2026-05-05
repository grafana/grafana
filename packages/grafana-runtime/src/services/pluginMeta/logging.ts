import { getLogger } from '../logging/registry';

export function logPluginMetaWarning(message: string, typeOrPluginId: string): void {
  getLogger('grafana/runtime.plugins.meta').logWarning(message, { typeOrPluginId });
}

export function logPluginMetaError(message: string, error: unknown): void {
  getLogger('grafana/runtime.plugins.meta').logError(new Error(message, { cause: error }));
}
