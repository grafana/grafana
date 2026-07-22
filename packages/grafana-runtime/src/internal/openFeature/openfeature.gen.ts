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
  /** Enable the alert quality tab, which surfaces the health of your alert rules and recommends actions to improve them. */
  AlertingRuleQuality: "alerting.ruleQuality",
  /** Automatically syncs external Alertmanager datasource configuration as ExtraConfiguration in Grafana */
  AlertingSyncExternalAlertmanager: "alerting.syncExternalAlertmanager",
  /** Enables new analytics framework */
  AnalyticsFramework: "analyticsFramework",
  /** Enables the template dashboard assistant */
  AssistantFrontendToolsDashboardTemplates: "assistant.frontend.tools.dashboardTemplates",
  /** Enables the global fullscreen Workspace (Grafana Assistant workspace shell) in the top bar */
  AssistantFullscreenWorkspace: "assistant.fullscreenWorkspace",
  /** Generate a per-datasource external ID for Grafana Assume Role (jsonData.grafanaExternalId). When disabled, new datasources keep using the stack-level external ID. */
  AwsAssumeRolePerDatasourceExternalId: "awsAssumeRolePerDatasourceExternalId",
  /** Enable notebooks, a resource in the dashboard API group for mixing text cells, code cells, and visualization panels */
  DashboardNotebooks: "dashboard.notebooks",
  /** Exposes the semantic (vector) search endpoint for dashboards under the dashboard API */
  DashboardVectorSearch: "dashboard.vectorSearch",
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
  /** Enables additional experimental color schemes for visualizations. */
  DatavizExperimentalColorSchemes: "dataviz.experimentalColorSchemes",
  /** A/A test for recently viewed dashboards feature */
  ExperimentRecentlyViewedDashboards: "experimentRecentlyViewedDashboards",
  /** Enable Faro session replay for Grafana */
  FaroSessionReplay: "faroSessionReplay",
  /** Enables the new Flame Graph UI containing the Call Tree view */
  FlameGraphWithCallTree: "flameGraphWithCallTree",
  /** Enables global and folder-scoped dashboard variables via dashboard.grafana.app */
  GlobalDashboardVariables: "globalDashboardVariables",
  /** Enables custom dashboard templates for enterprise */
  GrafanaCustomDashboardTemplates: "grafana.customDashboardTemplates",
  /** Allows users to customise the mega menu by hiding top-level navigation items they are not interested in */
  GrafanaCustomizableMegaMenu: "grafana.customizableMegaMenu",
  /** Redesigns dashboard settings page into Advanced Settings in a modal window */
  GrafanaDashboardSettingsRedesign: "grafana.dashboardSettingsRedesign",
  /** Check for the existence of logs when linking from the Trace View */
  GrafanaDynamicTraceToLogs: "grafana.dynamicTraceToLogs",
  /** Enables UI changes for integrations that require a scope to always be selected (for example, hides the scope selector's Remove all button) */
  GrafanaEnableScopesFirstMode: "grafana.enableScopesFirstMode",
  /** Enables the sidebar in Explore metrics (Metrics Drilldown) */
  GrafanaExploreMetricsSidebar: "grafana.exploreMetricsSidebar",
  /** Enables interactive grouped-label filtering through the tooltip in state timeline, status history and histogram panels */
  GrafanaFilterablePanels: "grafana.filterablePanels",
  /** Enables PLG-focused growth redesign of the unified homepage */
  GrafanaGrowthHomepage: "grafana.growthHomepage",
  /** Enables usage of the new annotations API client */
  GrafanaKubernetesAnnotationsClient: "grafana.kubernetesAnnotationsClient",
  /** Enables log level inference from log line contents when level is not defined as a field or a label */
  GrafanaLogLevelInference: "grafana.logLevelInference",
  /** Builds the navigation tree client-side instead of reading it from /bootdata */
  GrafanaMultiTenantNavTree: "grafana.multiTenantNavTree",
  /** Enables a new UI for query errors and notices */
  GrafanaNewPanelQueryErrorsUI: "grafana.newPanelQueryErrorsUI",
  /** Whether to use the new SharedPreferences functional component */
  GrafanaNewPreferencesPage: "grafana.newPreferencesPage",
  /** Enables the new text panel */
  GrafanaNewTextPanel: "grafana.newTextPanel",
  /** Adds a 'Download diagnostics' action that bundles diagnostic artifacts such as HTTP traffic (HAR), server log, dashboard and panel JSONs, and more */
  GrafanaOnDemandDiagnostics: "grafana.onDemandDiagnostics",
  /** Enables firing an event for PanelEditNext feedback that triggers an in-house survey */
  GrafanaPanelEditNextFeedbackEvent: "grafana.panelEditNextFeedbackEvent",
  /** Enables a redesigned query variable editor with split-pane preview and a spreadsheet for managing static options */
  GrafanaQueryVarEditorRedesign: "grafana.queryVarEditorRedesign",
  /** Enables the dedicated Saved queries page and its navigation entry */
  GrafanaSavedQueriesPage: "grafana.savedQueriesPage",
  /** Prevents flickering in dashboards */
  GrafanaScenesFlickeringFix: "grafana.scenesFlickeringFix",
  /** Enable referencing an existing secret in an active keeper when creating a secure value */
  GrafanaSecretsReferenceValueUI: "grafana.secretsReferenceValueUI",
  /** Enables starring folders and a virtual Starred folders folder in the dashboards list and folder picker */
  GrafanaStarredFolders: "grafana.starredFolders",
  /** Replaces the bundled home dashboard with the unified homepage React page */
  GrafanaUnifiedHomepage: "grafana.unifiedHomepage",
  /** Use the find default scope endpoint to seed the initial scope selection when none is set. */
  GrafanaUseDefaultScopesEndpoint: "grafana.useDefaultScopesEndpoint",
  /** Enables semantic (vector) dashboard search in the command palette */
  GrafanaVectorSearchCmdk: "grafana.vectorSearchCmdk",
  /** Enables the sidebar pane with new toggles and options in panel view mode */
  GrafanaViewPanelPane: "grafana.viewPanelPane",
  /** Enables the new visual design refresh for the Grafana UI */
  GrafanaVisualDesignRefresh: "grafana.visualDesignRefresh",
  /** Enables an inline version of Log Details that creates no new scrolls */
  InlineLogDetailsNoScrolls: "inlineLogDetailsNoScrolls",
  /** Enables the logs tableNG panel to replace existing tableRT */
  LogsTablePanelNG: "logsTablePanelNG",
  /** Use stream shards to split queries into smaller subqueries */
  LokiShardSplitting: "lokiShardSplitting",
  /** Enables managed plugins v2 (expanded rollout, community plugin coverage) */
  ManagedPluginsV2: "managedPluginsV2",
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
  /** Author Git Sync commits as the acting Grafana user */
  ProvisioningUserAttribution: "provisioning.userAttribution",
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
  /** Enables column autocomplete for SQL Expressions */
  SqlExpressionsColumnAutoComplete: "sqlExpressionsColumnAutoComplete",
  /** Enables option to position series names above bars in the state timeline panel */
  StateTimelineNameAboveBars: "stateTimeline.nameAboveBars",
  /** Enables the 'Customize with Assistant' button on suggested dashboard cards */
  SuggestedDashboardsAssistantButton: "suggestedDashboardsAssistantButton",
  /** Enables a new internal parser for table panel which doesn't rely on constructing a dynamic function and works in more browser environments. */
  TableProtoRowParser: "table.protoRowParser",
  /** Enables the refactored TableNG nested-table implementation */
  TableRefactorNested: "table.refactorNested",
  /** Routes short URL requests from /api to the /apis endpoint in the frontend. Depends on kubernetesShortURLs */
  UseKubernetesShortURLsAPI: "useKubernetesShortURLsAPI",
} as const;

/**
 * Enable the alert quality tab, which surfaces the health of your alert rules and recommends actions to improve them.
 *
 * **Details:**
 * - flag key: `alerting.ruleQuality`
 * - default value: `false`
 */
export const useFlagAlertingRuleQuality = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("alerting.ruleQuality", false, options).value;
};

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
 * Enables the global fullscreen Workspace (Grafana Assistant workspace shell) in the top bar
 *
 * **Details:**
 * - flag key: `assistant.fullscreenWorkspace`
 * - default value: `false`
 */
export const useFlagAssistantFullscreenWorkspace = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("assistant.fullscreenWorkspace", false, options).value;
};

/**
 * Generate a per-datasource external ID for Grafana Assume Role (jsonData.grafanaExternalId). When disabled, new datasources keep using the stack-level external ID.
 *
 * **Details:**
 * - flag key: `awsAssumeRolePerDatasourceExternalId`
 * - default value: `false`
 */
export const useFlagAwsAssumeRolePerDatasourceExternalId = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("awsAssumeRolePerDatasourceExternalId", false, options).value;
};

/**
 * Enable notebooks, a resource in the dashboard API group for mixing text cells, code cells, and visualization panels
 *
 * **Details:**
 * - flag key: `dashboard.notebooks`
 * - default value: `false`
 */
export const useFlagDashboardNotebooks = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("dashboard.notebooks", false, options).value;
};

/**
 * Exposes the semantic (vector) search endpoint for dashboards under the dashboard API
 *
 * **Details:**
 * - flag key: `dashboard.vectorSearch`
 * - default value: `false`
 */
export const useFlagDashboardVectorSearch = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("dashboard.vectorSearch", false, options).value;
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
 * Enables additional experimental color schemes for visualizations.
 *
 * **Details:**
 * - flag key: `dataviz.experimentalColorSchemes`
 * - default value: `false`
 */
export const useFlagDatavizExperimentalColorSchemes = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("dataviz.experimentalColorSchemes", false, options).value;
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
 * - default value: `false`
 */
export const useFlagFaroSessionReplay = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("faroSessionReplay", false, options).value;
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
 * Enables custom dashboard templates for enterprise
 *
 * **Details:**
 * - flag key: `grafana.customDashboardTemplates`
 * - default value: `false`
 */
export const useFlagGrafanaCustomDashboardTemplates = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.customDashboardTemplates", false, options).value;
};

/**
 * Allows users to customise the mega menu by hiding top-level navigation items they are not interested in
 *
 * **Details:**
 * - flag key: `grafana.customizableMegaMenu`
 * - default value: `false`
 */
export const useFlagGrafanaCustomizableMegaMenu = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.customizableMegaMenu", false, options).value;
};

/**
 * Redesigns dashboard settings page into Advanced Settings in a modal window
 *
 * **Details:**
 * - flag key: `grafana.dashboardSettingsRedesign`
 * - default value: `true`
 */
export const useFlagGrafanaDashboardSettingsRedesign = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.dashboardSettingsRedesign", true, options).value;
};

/**
 * Check for the existence of logs when linking from the Trace View
 *
 * **Details:**
 * - flag key: `grafana.dynamicTraceToLogs`
 * - default value: `false`
 */
export const useFlagGrafanaDynamicTraceToLogs = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.dynamicTraceToLogs", false, options).value;
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
 * Enables the sidebar in Explore metrics (Metrics Drilldown)
 *
 * **Details:**
 * - flag key: `grafana.exploreMetricsSidebar`
 * - default value: `false`
 */
export const useFlagGrafanaExploreMetricsSidebar = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.exploreMetricsSidebar", false, options).value;
};

/**
 * Enables interactive grouped-label filtering through the tooltip in state timeline, status history and histogram panels
 *
 * **Details:**
 * - flag key: `grafana.filterablePanels`
 * - default value: `false`
 */
export const useFlagGrafanaFilterablePanels = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.filterablePanels", false, options).value;
};

/**
 * Enables PLG-focused growth redesign of the unified homepage
 *
 * **Details:**
 * - flag key: `grafana.growthHomepage`
 * - default value: `false`
 */
export const useFlagGrafanaGrowthHomepage = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.growthHomepage", false, options).value;
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
 * Builds the navigation tree client-side instead of reading it from /bootdata
 *
 * **Details:**
 * - flag key: `grafana.multiTenantNavTree`
 * - default value: `false`
 */
export const useFlagGrafanaMultiTenantNavTree = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.multiTenantNavTree", false, options).value;
};

/**
 * Enables a new UI for query errors and notices
 *
 * **Details:**
 * - flag key: `grafana.newPanelQueryErrorsUI`
 * - default value: `false`
 */
export const useFlagGrafanaNewPanelQueryErrorsUI = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.newPanelQueryErrorsUI", false, options).value;
};

/**
 * Whether to use the new SharedPreferences functional component
 *
 * **Details:**
 * - flag key: `grafana.newPreferencesPage`
 * - default value: `true`
 */
export const useFlagGrafanaNewPreferencesPage = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.newPreferencesPage", true, options).value;
};

/**
 * Enables the new text panel
 *
 * **Details:**
 * - flag key: `grafana.newTextPanel`
 * - default value: `false`
 */
export const useFlagGrafanaNewTextPanel = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.newTextPanel", false, options).value;
};

/**
 * Adds a 'Download diagnostics' action that bundles diagnostic artifacts such as HTTP traffic (HAR), server log, dashboard and panel JSONs, and more
 *
 * **Details:**
 * - flag key: `grafana.onDemandDiagnostics`
 * - default value: `false`
 */
export const useFlagGrafanaOnDemandDiagnostics = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.onDemandDiagnostics", false, options).value;
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
 * Enables a redesigned query variable editor with split-pane preview and a spreadsheet for managing static options
 *
 * **Details:**
 * - flag key: `grafana.queryVarEditorRedesign`
 * - default value: `true`
 */
export const useFlagGrafanaQueryVarEditorRedesign = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.queryVarEditorRedesign", true, options).value;
};

/**
 * Enables the dedicated Saved queries page and its navigation entry
 *
 * **Details:**
 * - flag key: `grafana.savedQueriesPage`
 * - default value: `false`
 */
export const useFlagGrafanaSavedQueriesPage = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.savedQueriesPage", false, options).value;
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
 * Enable referencing an existing secret in an active keeper when creating a secure value
 *
 * **Details:**
 * - flag key: `grafana.secretsReferenceValueUI`
 * - default value: `false`
 */
export const useFlagGrafanaSecretsReferenceValueUI = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.secretsReferenceValueUI", false, options).value;
};

/**
 * Enables starring folders and a virtual Starred folders folder in the dashboards list and folder picker
 *
 * **Details:**
 * - flag key: `grafana.starredFolders`
 * - default value: `false`
 */
export const useFlagGrafanaStarredFolders = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.starredFolders", false, options).value;
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
 * Use the find default scope endpoint to seed the initial scope selection when none is set.
 *
 * **Details:**
 * - flag key: `grafana.useDefaultScopesEndpoint`
 * - default value: `false`
 */
export const useFlagGrafanaUseDefaultScopesEndpoint = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.useDefaultScopesEndpoint", false, options).value;
};

/**
 * Enables semantic (vector) dashboard search in the command palette
 *
 * **Details:**
 * - flag key: `grafana.vectorSearchCmdk`
 * - default value: `false`
 */
export const useFlagGrafanaVectorSearchCmdk = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.vectorSearchCmdk", false, options).value;
};

/**
 * Enables the sidebar pane with new toggles and options in panel view mode
 *
 * **Details:**
 * - flag key: `grafana.viewPanelPane`
 * - default value: `false`
 */
export const useFlagGrafanaViewPanelPane = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.viewPanelPane", false, options).value;
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
 * Enables the logs tableNG panel to replace existing tableRT
 *
 * **Details:**
 * - flag key: `logsTablePanelNG`
 * - default value: `false`
 */
export const useFlagLogsTablePanelNG = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("logsTablePanelNG", false, options).value;
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
 * Author Git Sync commits as the acting Grafana user
 *
 * **Details:**
 * - flag key: `provisioning.userAttribution`
 * - default value: `false`
 */
export const useFlagProvisioningUserAttribution = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("provisioning.userAttribution", false, options).value;
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
 * Enables column autocomplete for SQL Expressions
 *
 * **Details:**
 * - flag key: `sqlExpressionsColumnAutoComplete`
 * - default value: `false`
 */
export const useFlagSqlExpressionsColumnAutoComplete = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("sqlExpressionsColumnAutoComplete", false, options).value;
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

/**
 * Enables a new internal parser for table panel which doesn't rely on constructing a dynamic function and works in more browser environments.
 *
 * **Details:**
 * - flag key: `table.protoRowParser`
 * - default value: `false`
 */
export const useFlagTableProtoRowParser = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("table.protoRowParser", false, options).value;
};

/**
 * Enables the refactored TableNG nested-table implementation
 *
 * **Details:**
 * - flag key: `table.refactorNested`
 * - default value: `false`
 */
export const useFlagTableRefactorNested = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("table.refactorNested", false, options).value;
};

/**
 * Routes short URL requests from /api to the /apis endpoint in the frontend. Depends on kubernetesShortURLs
 *
 * **Details:**
 * - flag key: `useKubernetesShortURLsAPI`
 * - default value: `true`
 */
export const useFlagUseKubernetesShortURLsAPI = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("useKubernetesShortURLsAPI", true, options).value;
};

