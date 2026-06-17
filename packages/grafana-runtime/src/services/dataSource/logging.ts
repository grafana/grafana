import { type LogContext } from '@grafana/faro-web-sdk';

import { getLogger } from '../logging/registry';

export function logDataSourceInstanceError(message: string, error: unknown, context?: LogContext): void {
  getLogger('grafana/runtime.plugins.datasource').logError(new Error(message, { cause: error }), context);
}
