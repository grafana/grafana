import { type LogContext } from '@grafana/faro-web-sdk';

import { TracedError } from '../../utils/TracedError';
import { getLogger } from '../logging/registry';

export function logDataSourceInstanceError(message: string, error: unknown, context?: LogContext): void {
  getLogger('grafana/runtime.plugins.datasource').logError(new TracedError(message, error), context);
}
