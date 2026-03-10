import { TraceProcess } from '../types/trace';

/**
 * Returns a display-friendly service identifier that includes the namespace when present.
 * Format: "namespace/serviceName" (when namespace exists) or "serviceName" (when it doesn't).
 *
 * This is used consistently across the trace view for:
 * - Span bar labels
 * - Hover tooltips
 * - Color key generation (so same-named services in different namespaces get distinct colors)
 * - Span detail overview
 * - Trace name generation
 */
export function getServiceDisplayName(process: TraceProcess): string {
  if (process.serviceNamespace) {
    return `${process.serviceNamespace}/${process.serviceName}`;
  }
  return process.serviceName;
}

/**
 * Returns a unique key for the service, incorporating namespace when present.
 * Used for color assignment and service deduplication.
 */
export function getServiceColorKey(process: TraceProcess): string {
  return getServiceDisplayName(process);
}
