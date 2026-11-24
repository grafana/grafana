import { type LogContext } from '@grafana/faro-web-sdk';

import { TracedError } from '../../utils/TracedError';
import { getLogger } from '../logging/registry';

export function logApiDiscoveryError(message: string, error: unknown, context?: LogContext): void {
  getLogger('grafana/runtime.apis.discovery').logError(new TracedError(message, error), context);
}
