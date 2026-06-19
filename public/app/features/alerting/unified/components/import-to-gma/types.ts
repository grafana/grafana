/**
 * Types for the Import to Grafana Alerting feature
 */

/**
 * Describes which resources were renamed to avoid conflicts during import/dry-run.
 * Maps old resource names to new resource names.
 * Matches the backend type: definitions.RenameResources
 */
interface RenameResources {
  /** Receivers maps old receiver names to new receiver names */
  receivers?: Record<string, string>;
  /** TimeIntervals maps old time interval names to new time interval names */
  time_intervals?: Record<string, string>;
}

/**
 * Counts of resources merged into the live config during a promote.
 * Matches the backend type: definitions.MergeStats
 */
export interface MergeStats {
  /** Name of the route added to the main configuration, if any */
  added_route?: string;
  /** Names of receivers merged into the main configuration */
  added_receivers?: string[];
  /** Names of templates merged into the main configuration */
  added_templates?: string[];
  /** Names of time intervals merged into the main configuration */
  added_time_intervals?: string[];
  /** Names of inhibition rules merged into the main configuration */
  added_inhibition_rules?: string[];
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
  /** Counts of resources merged into the main config (present on promote) */
  stats?: MergeStats;
}

/**
 * Summary of how many resources of each type a promote merged into the live config.
 * Derived from {@link MergeStats} for display on the review screen.
 */
export interface PromoteStatsSummary {
  route: boolean;
  receivers: number;
  templates: number;
  timeIntervals: number;
  inhibitionRules: number;
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
  /** Counts of resources that would be merged (present on a promote dry-run) */
  stats?: PromoteStatsSummary;
}
