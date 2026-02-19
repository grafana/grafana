/**
 * Types for the Import to Grafana Alerting feature
 */

/**
 * Represents a resource that was renamed during dry-run validation.
 * When importing Alertmanager config, receivers/time intervals with conflicting names
 * get renamed with a suffix (e.g., "my-receiver" → "my-receiver <imported>").
 */
export interface RenamedResource {
  originalName: string;
  newName: string;
}

/**
 * Response from the dry-run validation endpoint.
 * TODO: Update this interface once the backend API is implemented.
 * See: https://github.com/grafana/alerting-squad/issues/1378
 */
export interface DryRunValidationResult {
  /** Whether the validation passed (config is valid and can be merged) */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** Receivers that will be renamed due to conflicts with existing receivers */
  renamedReceivers: RenamedResource[];
  /** Time intervals that will be renamed due to conflicts with existing time intervals */
  renamedTimeIntervals: RenamedResource[];
}
