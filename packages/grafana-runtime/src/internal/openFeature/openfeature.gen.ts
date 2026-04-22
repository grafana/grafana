/**
 * NOTE: This file was auto generated.  DO NOT EDIT DIRECTLY!
 * To change feature flags, edit:
 *  pkg/services/featuremgmt/registry.go
 * Then run:
 *  make gen-feature-toggles
 */

import {
  type ReactFlagEvaluationOptions,
  useFlag,
} from "@openfeature/react-sdk";

// Flag key constants for programmatic access
export const FlagKeys = {
  /** Enables new analytics framework */
  AnalyticsFramework: "analyticsFramework",
  /** Enables the created by me search filter on the browse dashboards page */
  CreatedByMeSearchFilter: "createdByMeSearchFilter",
  /** Enables support for section level variables (rows and tabs) */
  DashboardSectionVariables: "dashboardSectionVariables",
  /** Enables the Assistant button in the dashboard templates card */
  DashboardTemplatesAssistantButton: "dashboardTemplatesAssistantButton",
  /** Enables the new Flame Graph UI containing the Call Tree view */
  FlameGraphWithCallTree: "flameGraphWithCallTree",
  /** Whether to use the new SharedPreferences functional component */
  GrafanaNewPreferencesPage: "grafana.newPreferencesPage",
  /** Enables an inline version of Log Details that creates no new scrolls */
  InlineLogDetailsNoScrolls: "inlineLogDetailsNoScrolls",
  /** Use stream shards to split queries into smaller subqueries */
  LokiShardSplitting: "lokiShardSplitting",
  /** New Log Context component */
  NewLogContext: "newLogContext",
  /** Enables the new logs panel */
  NewLogsPanel: "newLogsPanel",
  /** Applies OTel formatting templates to displayed logs */
  OtelLogsFormatting: "otelLogsFormatting",
  /** Allow setting folder metadata for provisioned folders */
  ProvisioningFolderMetadata: "provisioningFolderMetadata",
  /** Enables next generation query editor experience */
  QueryEditorNext: "queryEditorNext",
  /** Enables recently viewed dashboards section in the browsing dashboard page */
  RecentlyViewedDashboards: "recentlyViewedDashboards",
  /** Enables reporting for any page in Grafana */
  ReportingAnyPageReporting: "reporting.anyPageReporting",
  /** Enables the splash screen modal for introducing new Grafana features on first session */
  SplashScreen: "splashScreen",
  /** Enables the 'Customize with Assistant' button on suggested dashboard cards */
  SuggestedDashboardsAssistantButton: "suggestedDashboardsAssistantButton",
} as const;

/**
 * Enables new analytics framework
 *
 * **Details:**
 * - flag key: `analyticsFramework`
 * - default value: `false`
 */
export const useFlagAnalyticsFramework = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("analyticsFramework", false, options).value;
};

/**
 * Enables the created by me search filter on the browse dashboards page
 *
 * **Details:**
 * - flag key: `createdByMeSearchFilter`
 * - default value: `false`
 */
export const useFlagCreatedByMeSearchFilter = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("createdByMeSearchFilter", false, options).value;
};

/**
 * Enables support for section level variables (rows and tabs)
 *
 * **Details:**
 * - flag key: `dashboardSectionVariables`
 * - default value: `false`
 */
export const useFlagDashboardSectionVariables = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("dashboardSectionVariables", false, options).value;
};

/**
 * Enables the Assistant button in the dashboard templates card
 *
 * **Details:**
 * - flag key: `dashboardTemplatesAssistantButton`
 * - default value: `false`
 */
export const useFlagDashboardTemplatesAssistantButton = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("dashboardTemplatesAssistantButton", false, options).value;
};

/**
 * Enables the new Flame Graph UI containing the Call Tree view
 *
 * **Details:**
 * - flag key: `flameGraphWithCallTree`
 * - default value: `false`
 */
export const useFlagFlameGraphWithCallTree = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("flameGraphWithCallTree", false, options).value;
};

/**
 * Whether to use the new SharedPreferences functional component
 *
 * **Details:**
 * - flag key: `grafana.newPreferencesPage`
 * - default value: `false`
 */
export const useFlagGrafanaNewPreferencesPage = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.newPreferencesPage", false, options).value;
};

/**
 * Enables an inline version of Log Details that creates no new scrolls
 *
 * **Details:**
 * - flag key: `inlineLogDetailsNoScrolls`
 * - default value: `false`
 */
export const useFlagInlineLogDetailsNoScrolls = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("inlineLogDetailsNoScrolls", false, options).value;
};

/**
 * Use stream shards to split queries into smaller subqueries
 *
 * **Details:**
 * - flag key: `lokiShardSplitting`
 * - default value: `false`
 */
export const useFlagLokiShardSplitting = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("lokiShardSplitting", false, options).value;
};

/**
 * New Log Context component
 *
 * **Details:**
 * - flag key: `newLogContext`
 * - default value: `false`
 */
export const useFlagNewLogContext = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("newLogContext", false, options).value;
};

/**
 * Enables the new logs panel
 *
 * **Details:**
 * - flag key: `newLogsPanel`
 * - default value: `true`
 */
export const useFlagNewLogsPanel = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("newLogsPanel", true, options).value;
};

/**
 * Applies OTel formatting templates to displayed logs
 *
 * **Details:**
 * - flag key: `otelLogsFormatting`
 * - default value: `false`
 */
export const useFlagOtelLogsFormatting = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("otelLogsFormatting", false, options).value;
};

/**
 * Allow setting folder metadata for provisioned folders
 *
 * **Details:**
 * - flag key: `provisioningFolderMetadata`
 * - default value: `true`
 */
export const useFlagProvisioningFolderMetadata = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("provisioningFolderMetadata", true, options).value;
};

/**
 * Enables next generation query editor experience
 *
 * **Details:**
 * - flag key: `queryEditorNext`
 * - default value: `false`
 */
export const useFlagQueryEditorNext = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("queryEditorNext", false, options).value;
};

/**
 * Enables recently viewed dashboards section in the browsing dashboard page
 *
 * **Details:**
 * - flag key: `recentlyViewedDashboards`
 * - default value: `false`
 */
export const useFlagRecentlyViewedDashboards = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("recentlyViewedDashboards", false, options).value;
};

/**
 * Enables reporting for any page in Grafana
 *
 * **Details:**
 * - flag key: `reporting.anyPageReporting`
 * - default value: `false`
 */
export const useFlagReportingAnyPageReporting = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("reporting.anyPageReporting", false, options).value;
};

/**
 * Enables the splash screen modal for introducing new Grafana features on first session
 *
 * **Details:**
 * - flag key: `splashScreen`
 * - default value: `true`
 */
export const useFlagSplashScreen = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("splashScreen", true, options).value;
};

/**
 * Enables the 'Customize with Assistant' button on suggested dashboard cards
 *
 * **Details:**
 * - flag key: `suggestedDashboardsAssistantButton`
 * - default value: `false`
 */
export const useFlagSuggestedDashboardsAssistantButton = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("suggestedDashboardsAssistantButton", false, options).value;
};

