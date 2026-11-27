import { type Folder } from '../../types/rule-form';

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

export interface ImportFormValues {
  // Step 1: Alertmanager resources
  step1Completed: boolean;
  step1Skipped: boolean;
  /**
   * Name of the imported policy tree (the config identifier for the imported Alertmanager config).
   * For now, this is free-form as we don't have an API to retrieve the list of available policy trees.
   */
  policyTreeName: string;
  notificationsSource: 'datasource' | 'yaml';
  notificationsDatasourceUID?: string;
  notificationsDatasourceName: string | null;
  notificationsYamlFile: File | null;
  notificationsTemplateFiles: File[];
  /** Checked in Step 1 when the source is a data source; enables continuous sync instead of staging. */
  autoSyncNotificationsEnabled?: boolean;

  // Step 2: Alert rules
  step2Completed: boolean;
  step2Skipped: boolean;
  selectedRoutingTree: string; // Routing tree name from the API or from Step 1
  rulesSource: 'datasource' | 'yaml';
  rulesDatasourceUID?: string;
  rulesDatasourceName: string | null;
  rulesYamlFile: File | null;
  // Filters
  namespace?: string;
  ruleGroup?: string;
  // Settings
  targetFolder?: Folder;
  pauseAlertingRules: boolean;
  pauseRecordingRules: boolean;
  targetDatasourceUID?: string;
  /** The data source the rules of an uploaded YAML file run against. Only used for the YAML source. */
  yamlImportTargetDatasourceUID?: string;
  yamlImportTargetDatasourceName?: string;
}

export type Step1Values = Pick<
  ImportFormValues,
  | 'policyTreeName'
  | 'notificationsSource'
  | 'notificationsDatasourceUID'
  | 'notificationsDatasourceName'
  | 'notificationsYamlFile'
  | 'notificationsTemplateFiles'
  | 'autoSyncNotificationsEnabled'
>;
