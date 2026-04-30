import { type PluginType } from '@grafana/data';

import { getLogger } from '../logging/registry';

export function logPluginMetaWarning(message: string, type: PluginType): void {
  getLogger('grafana/runtime.plugins.meta').logWarning(message, { type });
}

export function logPluginMetaError(message: string, error: unknown): void {
  getLogger('grafana/runtime.plugins.meta').logError(new Error(message, { cause: error }));
}
