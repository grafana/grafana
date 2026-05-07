import { type LogContext } from '@grafana/faro-web-sdk';

import { getLogger } from '../logging/registry';

export function logPluginSettingsWarning(message: string, context: LogContext): void {
  getLogger('grafana/runtime.plugins.settings').logWarning(message, context);
}

export function logPluginSettingsError(message: string, error: unknown, context?: LogContext): void {
  getLogger('grafana/runtime.plugins.settings').logError(new Error(message, { cause: error }), context);
}
