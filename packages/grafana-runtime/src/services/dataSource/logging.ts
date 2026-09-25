import { type DataSourceRef } from '@grafana/data';
import { type LogContext } from '@grafana/faro-web-sdk';

import { TracedError } from '../../utils/TracedError';
import { getLogger } from '../logging/registry';

export function logDataSourceInstanceError(message: string, error: unknown, context?: LogContext): void {
  getLogger('grafana/runtime.plugins.datasource').logError(new TracedError(message, error), context);
}

export function logDataSourceWarning(message: string, context?: LogContext): void {
  getLogger('grafana/runtime.plugins.datasource').logWarning(message, context);
}

export function describeRef(ref: DataSourceRef | string | null | undefined): string {
  if (ref == null) {
    return 'default';
  }
  if (typeof ref === 'string') {
    // Faro drops empty attribute values, so give '' a visible label. The synthetic
    // <empty> marker cannot collide with a real uid/name, unlike a bare word.
    return ref === '' ? '<empty>' : ref;
  }
  // An empty uid falls through to the type so the log still identifies the ref.
  return ref.uid || ref.type || 'unknown';
}
