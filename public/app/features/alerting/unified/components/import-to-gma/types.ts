/**
 * Types for the Import to Grafana Alerting feature
 */

/**
 * Summary of how many resources of each type a promote merged into the live config.
 * Derived from the convert API's `MergeStats` for display on the review screen.
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
 * Derived from the convert API's `ConvertAlertmanagerResponse`.
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

/** UI state for a dry-run validation, derived from the underlying mutation's async state. */
export type DryRunState = 'idle' | 'loading' | 'success' | 'warning' | 'error';
