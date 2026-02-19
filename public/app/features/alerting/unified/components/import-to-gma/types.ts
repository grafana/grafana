/**
 * Types for the Import to Grafana Alerting feature
 */

/**
 * Describes which resources were renamed to avoid conflicts during import/dry-run.
 * Maps old resource names to new resource names.
 * Matches the backend type: definitions.RenameResources
 */
export interface RenameResources {
  /** Receivers maps old receiver names to new receiver names */
  receivers?: Record<string, string>;
  /** TimeIntervals maps old time interval names to new time interval names */
  time_intervals?: Record<string, string>;
}

/**
 * Response from the Alertmanager config import endpoint (POST /api/convert/api/v1/alerts).
 * Used for both real imports and dry-run validation (with X-Grafana-Alerting-Dry-Run header).
 * Matches the backend type: definitions.ConvertAlertmanagerResponse
 */
export interface ConvertAlertmanagerResponse {
  status: string;
  errorType?: string;
  error?: string;
  /** Contains information about renamed resources during configuration merge */
  rename_resources?: RenameResources;
}

/**
 * Parsed dry-run validation result for UI consumption.
 * Derived from ConvertAlertmanagerResponse.
 */
export interface DryRunValidationResult {
  /** Whether the validation passed (config is valid and can be merged) */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** Receivers that will be renamed: old name → new name */
  renamedReceivers: Array<{ originalName: string; newName: string }>;
  /** Time intervals that will be renamed: old name → new name */
  renamedTimeIntervals: Array<{ originalName: string; newName: string }>;
}
