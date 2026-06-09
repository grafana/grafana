import { type LogContext } from '@grafana/faro-web-sdk';

import { getLogger } from '../logging/registry';

export function logPluginMetaWarning(message: string, context: LogContext): void {
  getLogger('grafana/runtime.plugins.meta').logWarning(message, context);
}

export function logPluginMetaError(message: string, error: unknown, context?: LogContext): void {
  getLogger('grafana/runtime.plugins.meta').logError(new Error(message, { cause: error }), context);
}
