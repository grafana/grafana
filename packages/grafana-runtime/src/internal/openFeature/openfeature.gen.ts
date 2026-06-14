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
  /** Automatically syncs external Alertmanager datasource configuration as ExtraConfiguration in Grafana */
  AlertingSyncExternalAlertmanager: "alerting.syncExternalAlertmanager",
  /** Enables new analytics framework */
  AnalyticsFramework: "analyticsFramework",
  /** Enables the template dashboard assistant */
  AssistantFrontendToolsDashboardTemplates: "assistant.frontend.tools.dashboardTemplates",
  /** Enables the created by me search filter on the browse dashboards page */
  CreatedByMeSearchFilter: "createdByMeSearchFilter",
  /** Enables support for section level variables (rows and tabs) */
  DashboardSectionVariables: "dashboardSectionVariables",
  /** Enables the Assistant button in the dashboard templates card */
  DashboardTemplatesAssistantButton: "dashboardTemplatesAssistantButton",
  /** Use the new datasource API groups for datasource resource requests, frontend flag */
  DatasourcesApiserverUseNewAPIsForDatasourceResources: "datasources.apiserver.useNewAPIsForDatasourceResources",
  /** Use the new datasource API groups for datasource CRUD requests, frontend flag */
  DatasourcesConfigUiUseNewDatasourceCRUDAPIs: "datasources.config.ui.useNewDatasourceCRUDAPIs",
  /** Send Datsource health requests to /apis/ API routes instead of the legacy /api/datasources/uid/{uid}/health route. */
  DatasourcesApiServerEnableHealthEndpointFrontend: "datasourcesApiServerEnableHealthEndpointFrontend",
  /** A/A test for recently viewed dashboards feature */
  ExperimentRecentlyViewedDashboards: "experimentRecentlyViewedDashboards",
  /** Enable Faro session replay for Grafana */
  FaroSessionReplay: "faroSessionReplay",
  /** Enables the new Flame Graph UI containing the Call Tree view */
  FlameGraphWithCallTree: "flameGraphWithCallTree",
  /** Enables global and folder-scoped dashboard variables via dashboard.grafana.app */
  GlobalDashboardVariables: "globalDashboardVariables",
  /** Enables UI changes for integrations that require a scope to always be selected (for example, hides the scope selector's Remove all button) */
  GrafanaEnableScopesFirstMode: "grafana.enableScopesFirstMode",
  /** Enables usage of the new annotations API client */
  GrafanaKubernetesAnnotationsClient: "grafana.kubernetesAnnotationsClient",
  /** Enables log level inference from log line contents when level is not defined as a field or a label */
  GrafanaLogLevelInference: "grafana.logLevelInference",
  /** Whether to use the new SharedPreferences functional component */
  GrafanaNewPreferencesPage: "grafana.newPreferencesPage",
  /** Enables org-defined dashboard templates for enterprise */
  GrafanaOrgDashboardTemplates: "grafana.orgDashboardTemplates",
  /** Enables firing an event for PanelEditNext feedback that triggers an in-house survey */
  GrafanaPanelEditNextFeedbackEvent: "grafana.panelEditNextFeedbackEvent",
  /** Prevents flickering in dashboards */
  GrafanaScenesFlickeringFix: "grafana.scenesFlickeringFix",
  /** Replaces the bundled home dashboard with the unified homepage React page */
  GrafanaUnifiedHomepage: "grafana.unifiedHomepage",
  /** Enables the new visual design refresh for the Grafana UI */
  GrafanaVisualDesignRefresh: "grafana.visualDesignRefresh",
  /** Enables an inline version of Log Details that creates no new scrolls */
  InlineLogDetailsNoScrolls: "inlineLogDetailsNoScrolls",
  /** Use stream shards to split queries into smaller subqueries */
  LokiShardSplitting: "lokiShardSplitting",
  /** Enables managed plugins v2 (expanded rollout, community plugin coverage) */
  ManagedPluginsV2: "managedPluginsV2",
  /** New Log Context component */
  NewLogContext: "newLogContext",
  /** Enables the new logs panel */
  NewLogsPanel: "newLogsPanel",
  /** Enables the new Saved queries (query library) modal experience */
  NewSavedQueriesExperience: "newSavedQueriesExperience",
  /** Applies OTel formatting templates to displayed logs */
  OtelLogsFormatting: "otelLogsFormatting",
  /** Initializes data source instance settings asynchronously from the API instead of synchronously from boot data */
  PluginsInitDataSourcesAsync: "plugins.initDataSourcesAsync",
  /** Enables plugins setting from new apis */
  PluginsUseMTPluginSettings: "plugins.useMTPluginSettings",
  /** Enables plugins decoupling from bootdata */
  PluginsUseMTPlugins: "plugins.useMTPlugins",
  /** Enable configurable commit message, branch name, and pull request title conventions for Git Sync */
  ProvisioningGitConventions: "provisioning.gitConventions",
  /** Render the README.md of a Git Sync provisioned folder inline below its dashboards list */
  ProvisioningReadmes: "provisioning.readmes",
  /** Allow setting folder metadata for provisioned folders */
  ProvisioningFolderMetadata: "provisioningFolderMetadata",
  /** Enables next generation query editor experience */
  QueryEditorNext: "queryEditorNext",
  /** Store query history in browser IndexedDB instead of server-side */
  QueryHistoryLocalOnly: "queryHistory.localOnly",
  /** Replace the Query History drawer with a new Recent Queries modal UI */
  QueryHistoryRecentQueriesUI: "queryHistory.recentQueriesUI",
  /** Enables recently viewed dashboards section in the browsing dashboard page */
  RecentlyViewedDashboards: "recentlyViewedDashboards",
  /** Enables reporting for any page in Grafana */
  ReportingAnyPageReporting: "reporting.anyPageReporting",
  /** Enables the splash screen modal for introducing new Grafana features on first session */
  SplashScreen: "splashScreen",
  /** Enables CodeMirror editor for SQL Expressions */
  SqlExpressionsCodeMirror: "sqlExpressionsCodeMirror",
  /** Enables option to position series names above bars in the state timeline panel */
  StateTimelineNameAboveBars: "stateTimeline.nameAboveBars",
  /** Enables the 'Customize with Assistant' button on suggested dashboard cards */
  SuggestedDashboardsAssistantButton: "suggestedDashboardsAssistantButton",
} as const;

/**
 * Automatically syncs external Alertmanager datasource configuration as ExtraConfiguration in Grafana
 *
 * **Details:**
 * - flag key: `alerting.syncExternalAlertmanager`
 * - default value: `false`
 */
export const useFlagAlertingSyncExternalAlertmanager = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("alerting.syncExternalAlertmanager", false, options).value;
};

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
 * Enables the template dashboard assistant
 *
 * **Details:**
 * - flag key: `assistant.frontend.tools.dashboardTemplates`
 * - default value: `false`
 */
export const useFlagAssistantFrontendToolsDashboardTemplates = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("assistant.frontend.tools.dashboardTemplates", false, options).value;
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
 * - default value: `true`
 */
export const useFlagDashboardSectionVariables = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("dashboardSectionVariables", true, options).value;
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
 * Use the new datasource API groups for datasource resource requests, frontend flag
 *
 * **Details:**
 * - flag key: `datasources.apiserver.useNewAPIsForDatasourceResources`
 * - default value: `false`
 */
export const useFlagDatasourcesApiserverUseNewAPIsForDatasourceResources = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("datasources.apiserver.useNewAPIsForDatasourceResources", false, options).value;
};

/**
 * Use the new datasource API groups for datasource CRUD requests, frontend flag
 *
 * **Details:**
 * - flag key: `datasources.config.ui.useNewDatasourceCRUDAPIs`
 * - default value: `false`
 */
export const useFlagDatasourcesConfigUiUseNewDatasourceCRUDAPIs = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("datasources.config.ui.useNewDatasourceCRUDAPIs", false, options).value;
};

/**
 * Send Datsource health requests to /apis/ API routes instead of the legacy /api/datasources/uid/{uid}/health route.
 *
 * **Details:**
 * - flag key: `datasourcesApiServerEnableHealthEndpointFrontend`
 * - default value: `false`
 */
export const useFlagDatasourcesApiServerEnableHealthEndpointFrontend = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("datasourcesApiServerEnableHealthEndpointFrontend", false, options).value;
};

/**
 * A/A test for recently viewed dashboards feature
 *
 * **Details:**
 * - flag key: `experimentRecentlyViewedDashboards`
 * - default value: `false`
 */
export const useFlagExperimentRecentlyViewedDashboards = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("experimentRecentlyViewedDashboards", false, options).value;
};

/**
 * Enable Faro session replay for Grafana
 *
 * **Details:**
 * - flag key: `faroSessionReplay`
 * - default value: `true`
 */
export const useFlagFaroSessionReplay = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("faroSessionReplay", true, options).value;
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
 * Enables global and folder-scoped dashboard variables via dashboard.grafana.app
 *
 * **Details:**
 * - flag key: `globalDashboardVariables`
 * - default value: `false`
 */
export const useFlagGlobalDashboardVariables = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("globalDashboardVariables", false, options).value;
};

/**
 * Enables UI changes for integrations that require a scope to always be selected (for example, hides the scope selector's Remove all button)
 *
 * **Details:**
 * - flag key: `grafana.enableScopesFirstMode`
 * - default value: `false`
 */
export const useFlagGrafanaEnableScopesFirstMode = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.enableScopesFirstMode", false, options).value;
};

/**
 * Enables usage of the new annotations API client
 *
 * **Details:**
 * - flag key: `grafana.kubernetesAnnotationsClient`
 * - default value: `false`
 */
export const useFlagGrafanaKubernetesAnnotationsClient = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.kubernetesAnnotationsClient", false, options).value;
};

/**
 * Enables log level inference from log line contents when level is not defined as a field or a label
 *
 * **Details:**
 * - flag key: `grafana.logLevelInference`
 * - default value: `false`
 */
export const useFlagGrafanaLogLevelInference = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.logLevelInference", false, options).value;
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
 * Enables org-defined dashboard templates for enterprise
 *
 * **Details:**
 * - flag key: `grafana.orgDashboardTemplates`
 * - default value: `false`
 */
export const useFlagGrafanaOrgDashboardTemplates = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.orgDashboardTemplates", false, options).value;
};

/**
 * Enables firing an event for PanelEditNext feedback that triggers an in-house survey
 *
 * **Details:**
 * - flag key: `grafana.panelEditNextFeedbackEvent`
 * - default value: `false`
 */
export const useFlagGrafanaPanelEditNextFeedbackEvent = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.panelEditNextFeedbackEvent", false, options).value;
};

/**
 * Prevents flickering in dashboards
 *
 * **Details:**
 * - flag key: `grafana.scenesFlickeringFix`
 * - default value: `true`
 */
export const useFlagGrafanaScenesFlickeringFix = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.scenesFlickeringFix", true, options).value;
};

/**
 * Replaces the bundled home dashboard with the unified homepage React page
 *
 * **Details:**
 * - flag key: `grafana.unifiedHomepage`
 * - default value: `false`
 */
export const useFlagGrafanaUnifiedHomepage = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.unifiedHomepage", false, options).value;
};

/**
 * Enables the new visual design refresh for the Grafana UI
 *
 * **Details:**
 * - flag key: `grafana.visualDesignRefresh`
 * - default value: `false`
 */
export const useFlagGrafanaVisualDesignRefresh = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.visualDesignRefresh", false, options).value;
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
 * Enables managed plugins v2 (expanded rollout, community plugin coverage)
 *
 * **Details:**
 * - flag key: `managedPluginsV2`
 * - default value: `false`
 */
export const useFlagManagedPluginsV2 = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("managedPluginsV2", false, options).value;
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
 * Enables the new Saved queries (query library) modal experience
 *
 * **Details:**
 * - flag key: `newSavedQueriesExperience`
 * - default value: `false`
 */
export const useFlagNewSavedQueriesExperience = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("newSavedQueriesExperience", false, options).value;
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
 * Initializes data source instance settings asynchronously from the API instead of synchronously from boot data
 *
 * **Details:**
 * - flag key: `plugins.initDataSourcesAsync`
 * - default value: `false`
 */
export const useFlagPluginsInitDataSourcesAsync = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("plugins.initDataSourcesAsync", false, options).value;
};

/**
 * Enables plugins setting from new apis
 *
 * **Details:**
 * - flag key: `plugins.useMTPluginSettings`
 * - default value: `false`
 */
export const useFlagPluginsUseMTPluginSettings = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("plugins.useMTPluginSettings", false, options).value;
};

/**
 * Enables plugins decoupling from bootdata
 *
 * **Details:**
 * - flag key: `plugins.useMTPlugins`
 * - default value: `false`
 */
export const useFlagPluginsUseMTPlugins = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("plugins.useMTPlugins", false, options).value;
};

/**
 * Enable configurable commit message, branch name, and pull request title conventions for Git Sync
 *
 * **Details:**
 * - flag key: `provisioning.gitConventions`
 * - default value: `false`
 */
export const useFlagProvisioningGitConventions = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("provisioning.gitConventions", false, options).value;
};

/**
 * Render the README.md of a Git Sync provisioned folder inline below its dashboards list
 *
 * **Details:**
 * - flag key: `provisioning.readmes`
 * - default value: `true`
 */
export const useFlagProvisioningReadmes = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("provisioning.readmes", true, options).value;
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
 * Store query history in browser IndexedDB instead of server-side
 *
 * **Details:**
 * - flag key: `queryHistory.localOnly`
 * - default value: `false`
 */
export const useFlagQueryHistoryLocalOnly = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("queryHistory.localOnly", false, options).value;
};

/**
 * Replace the Query History drawer with a new Recent Queries modal UI
 *
 * **Details:**
 * - flag key: `queryHistory.recentQueriesUI`
 * - default value: `false`
 */
export const useFlagQueryHistoryRecentQueriesUI = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("queryHistory.recentQueriesUI", false, options).value;
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
 * - default value: `false`
 */
export const useFlagSplashScreen = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("splashScreen", false, options).value;
};

/**
 * Enables CodeMirror editor for SQL Expressions
 *
 * **Details:**
 * - flag key: `sqlExpressionsCodeMirror`
 * - default value: `false`
 */
export const useFlagSqlExpressionsCodeMirror = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("sqlExpressionsCodeMirror", false, options).value;
};

/**
 * Enables option to position series names above bars in the state timeline panel
 *
 * **Details:**
 * - flag key: `stateTimeline.nameAboveBars`
 * - default value: `false`
 */
export const useFlagStateTimelineNameAboveBars = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("stateTimeline.nameAboveBars", false, options).value;
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

