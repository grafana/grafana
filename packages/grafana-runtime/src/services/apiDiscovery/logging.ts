import { type LogContext } from '@grafana/faro-web-sdk';

import { TracedError } from '../../utils/TracedError';
import { getLogger } from '../logging/registry';

export function logAPIDiscoveryWarning(message: string, context: LogContext): void {
  getLogger('grafana/runtime.apis.discovery').logWarning(message, context);
}

export function logAPIDiscoveryError(message: string, error: unknown, context?: LogContext): void {
  getLogger('grafana/runtime.apis.discovery').logError(new TracedError(message, error), context);
}
