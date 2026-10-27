/**
 * NOTE: This file was auto generated.  DO NOT EDIT DIRECTLY!
 * To change feature flags, edit:
 *  pkg/services/featuremgmt/registry.go
 * Then run:
 *  make gen-feature-toggles
 */

import {
  type JsonValue,
  type ReactFlagEvaluationOptions,
  useFlag,
} from "@openfeature/react-sdk";

// Flag key constants for programmatic access
export const FlagKeys = {
  /** Enable configuration of alert enrichments in Grafana Cloud. */
  AlertEnrichment: "alertEnrichment",
  /** Enables the alert rule restore feature */
  AlertRuleRestore: "alertRuleRestore",
  /** Hand data source managed alerting URLs over to the grafana-prometheusalerting-app plugin */
  AlertingDataSourceManagedRouteProxy: "alerting.dataSourceManagedRouteProxy",
  /** Enables the separate Grafana-managed Alert rules and Recording rules list pages, replacing the combined rule list */
  AlertingGmaOnlyListView: "alerting.gmaOnlyListView",
  /** Enable manually starting an Assistant investigation from the alert instance drawer. */
  AlertingManualAssistantInvestigation: "alerting.manualAssistantInvestigation",
  /** Enable the alert quality tab, which surfaces the health of your alert rules and recommends actions to improve them. */
  AlertingRuleQuality: "alerting.ruleQuality",
  /** Enable fixing alert rule quality issues with Grafana Assistant on the alert quality page. */
  AlertingRuleQualityFix: "alerting.ruleQualityFix",
  /** Enable assistant reviews on the alert quality page. */
  AlertingRuleReviews: "alerting.ruleReviews",
  /** Automatically keeps imported notification configuration up to date with a Mimir or Cortex Alertmanager data source */
  AlertingSyncExternalAlertmanager: "alerting.syncExternalAlertmanager",
  /** Enables enhanced stat mode for the Alert List panel with thresholds, value mappings, and linking */
  AlertingAlertListPanelEnhancements: "alertingAlertListPanelEnhancements",
  /** Rule backtesting API for alerting */
  AlertingBacktesting: "alertingBacktesting",
  /** Disables the ability to send alerts to an external Alertmanager datasource. */
  AlertingDisableSendAlertsExternal: "alertingDisableSendAlertsExternal",
  /** Enable Assistant Investigations enrichment type. */
  AlertingEnrichmentAssistantInvestigations: "alertingEnrichmentAssistantInvestigations",
  /** Enable enrichment per rule in the alerting UI. */
  AlertingEnrichmentPerRule: "alertingEnrichmentPerRule",
  /** Enables the new Jira integration for contact points in cloud alert managers. */
  AlertingJiraIntegration: "alertingJiraIntegration",
  /** Enables the new alert list view design */
  AlertingListViewV2: "alertingListViewV2",
  /** Enables the alerting list view v2 preview toggle */
  AlertingListViewV2PreviewToggle: "alertingListViewV2PreviewToggle",
  /** Enables the migration wizard UI to migrate alert rules and notification resources from external sources to Grafana Alerting */
  AlertingMigrationWizardUI: "alertingMigrationWizardUI",
  /** Enables the new Alerting navigation structure with improved menu grouping */
  AlertingNavigationV2: "alertingNavigationV2",
  /** Uses Prometheus rules as the primary source of truth for ruler-enabled data sources */
  AlertingPrometheusRulesPrimary: "alertingPrometheusRulesPrimary",
  /** Enables the UI functionality to recover and view deleted alert rules */
  AlertingRuleRecoverDeleted: "alertingRuleRecoverDeleted",
  /** Use the new k8s API for fetching integration type schemas */
  AlertingSyncNotifiersApiMigration: "alertingSyncNotifiersApiMigration",
  /** Deprecated. The alert activity page is shown when alert state history is written to Prometheus. Set to false to hide it. */
  AlertingTriage: "alertingTriage",
  /** Enables the UI to use certain backend-side filters */
  AlertingUIUseBackendFilters: "alertingUIUseBackendFilters",
  /** Enables the UI to use rules backend-side filters 100% compatible with the frontend filters */
  AlertingUIUseFullyCompatBackendFilters: "alertingUIUseFullyCompatBackendFilters",
  /** Enables new analytics framework */
  AnalyticsFramework: "analyticsFramework",
  /** Previews the dashboard changes a plugin such as Grafana Assistant proposes, and lets plugins reload and embed dashboards with them */
  AssistantDashboardArtifacts: "assistant.dashboard.artifacts",
  /** Shows a loading screen on the dashboard while the assistant prepares to build an approved dashboard plan */
  AssistantDashboardPlanBuildingScreen: "assistant.dashboardPlanBuildingScreen",
  /** Enables the assistant-powered Generate dashboard prompt and the plan card that approves the dashboard before it is built */
  AssistantDashboardPlanning: "assistant.dashboardPlanning",
  /** Enables the template dashboard assistant */
  AssistantFrontendToolsDashboardTemplates: "assistant.frontend.tools.dashboardTemplates",
  /** Enables the global fullscreen Workspace (Grafana Assistant workspace shell) in the top bar */
  AssistantFullscreenWorkspace: "assistant.fullscreenWorkspace",
  /** Generate a per-datasource external ID for Grafana Assume Role (jsonData.grafanaExternalId). When disabled, new datasources keep using the stack-level external ID. */
  AwsAssumeRolePerDatasourceExternalId: "awsAssumeRolePerDatasourceExternalId",
  /** Enables user auth for Azure Monitor datasource only */
  AzureMonitorEnableUserAuth: "azureMonitorEnableUserAuth",
  /** Enables the logs builder mode for the Azure Monitor data source */
  AzureMonitorLogsBuilderEditor: "azureMonitorLogsBuilderEditor",
  /** Enables the updated Azure Monitor resource picker */
  AzureResourcePickerUpdates: "azureResourcePickerUpdates",
  /** Allow elements nesting */
  CanvasPanelNesting: "canvasPanelNesting",
  /** Allow pan and zoom in canvas panel */
  CanvasPanelPanZoom: "canvasPanelPanZoom",
  /** Enables cross-account querying in CloudWatch datasources */
  CloudWatchCrossAccountQuerying: "cloudWatchCrossAccountQuerying",
  /** Enables the new sidebar filter panel in the Add new connection page */
  ConnectionsFilterSidebar: "connectionsFilterSidebar",
  /** Enables browser crash detection reporting to Faro. */
  CrashDetection: "crashDetection",
  /** Enables creating alert rules from a panel using a drawer UI */
  CreateAlertRuleFromPanel: "createAlertRuleFromPanel",
  /** Enables Critical User Journey (CUJ) tracking */
  CujTracking: "cujTracking",
  /** Enable notebooks, a resource in the dashboard API group for mixing text cells, code cells, and visualization panels */
  DashboardNotebooks: "dashboard.notebooks",
  /** Exposes the semantic (vector) search endpoint for dashboards under the dashboard API */
  DashboardVectorSearch: "dashboard.vectorSearch",
  /** Supports __from and __to macros that always use the dashboard level time range */
  DashboardLevelTimeMacros: "dashboardLevelTimeMacros",
  /** Displays datasource provisioned dashboards in dashboard empty page, only when coming from datasource configuration page */
  DashboardLibrary: "dashboardLibrary",
  /** Enables new dashboard layouts */
  DashboardNewLayouts: "dashboardNewLayouts",
  /** Enables a flow to get started with a new dashboard from a template */
  DashboardTemplates: "dashboardTemplates",
  /** Enables the Assistant button in the dashboard templates card */
  DashboardTemplatesAssistantButton: "dashboardTemplatesAssistantButton",
  /** Enables undo/redo in dynamic dashboards */
  DashboardUndoRedo: "dashboardUndoRedo",
  /** Enables dashboard validator app to run compatibility checks between a dashboard and data source */
  DashboardValidatorApp: "dashboardValidatorApp",
  /** Disables public dashboards for the stack */
  DashboardsDisablePublicDashboards: "dashboards.disablePublicDashboards",
  /** Expands a horizontal repeat copied from a library panel definition to the full grid width, matching how horizontal repeats on dashboard panels are laid out */
  DashboardsLibraryPanelHorizontalRepeatFullWidth: "dashboards.libraryPanelHorizontalRepeatFullWidth",
  /** Migrates a library panel repeat on the frontend only when the server did not already resolve it, instead of deciding from dashboard sharing state */
  DashboardsLibraryPanelRepeatFromServerResolution: "dashboards.libraryPanelRepeatFromServerResolution",
  /** Resolves the dashboard toolbar public-share badge from the public dashboards API instead of the access.isPublic field on /dto */
  DashboardsPublicDashboardBadgeFromApi: "dashboards.publicDashboardBadgeFromApi",
  /** Shows defined connections for a data source in the plugins detail page */
  DatasourceConnectionsTab: "datasourceConnectionsTab",
  /** Enables the Metrics Batch API for the Azure Monitor data source, allowing up to 50 resources to be queried in a single request */
  DatasourcesAzureMonitorBatchAPI: "datasources.azureMonitorBatchAPI",
  /** Use the new datasource API groups for datasource CRUD requests, frontend flag */
  DatasourcesConfigUiUseNewDatasourceCRUDAPIs: "datasources.config.ui.useNewDatasourceCRUDAPIs",
  /** Enable support for the query gateway audit policies */
  DatasourcesGatewayAuditPolicy: "datasources.gatewayAuditPolicy",
  /** Data source query gateway guardrails */
  DatasourcesGatewayGuardrails: "datasources.gatewayGuardrails",
  /** Data source query service, use the new name */
  DatasourcesQuerierNewName: "datasources.querier.newName",
  /** Data source query gateway */
  DatasourcesQueryGateway: "datasources.queryGateway",
  /** Enables additional experimental color schemes for visualizations. */
  DatavizExperimentalColorSchemes: "dataviz.experimentalColorSchemes",
  /** Enables tabular numerals for visualization legend values */
  DatavizTabularNums: "dataviz.tabularNums",
  /** Disables legacy scripted dashboards, which are deprecated and will be removed in Grafana 14. Set to false to temporarily restore them. */
  DisableScriptedDashboards: "disableScriptedDashboards",
  /** Enables new colorblind safe palette and line fill patterns for panels */
  EnableColorblindSafePanelOptions: "enableColorblindSafePanelOptions",
  /** Enables the extension admin page regardless of development mode */
  EnableExtensionsAdminPage: "enableExtensionsAdminPage",
  /** Automatic service account and token setup for plugins */
  ExternalServiceAccounts: "externalServiceAccounts",
  /** Enable Faro session replay for Grafana */
  FaroSessionReplay: "faroSessionReplay",
  /** Enable favorite datasources */
  FavoriteDatasources: "favoriteDatasources",
  /** Enables the feedback button in the dashboard edit sidebar */
  FeedbackButton: "feedbackButton",
  /** Renders the flame graph's top table using TableNG instead of the legacy Table */
  FlameGraphTableNg: "flameGraph.tableNg",
  /** Enables use of app platform API for folders */
  FoldersAppPlatformAPI: "foldersAppPlatformAPI",
  /** Enables global and folder-scoped dashboard variables via dashboard.grafana.app */
  GlobalDashboardVariables: "globalDashboardVariables",
  /** Allow admins to make announcement banners dismissible by users */
  GrafanaAnnouncementBannerDismissible: "grafana.announcementBannerDismissible",
  /** Uses the hybrid (lexical + semantic) search endpoint as the dashboard search backend in the command palette */
  GrafanaCmdkHybridSearch: "grafana.cmdkHybridSearch",
  /** Enables custom dashboard templates for enterprise */
  GrafanaCustomDashboardTemplates: "grafana.customDashboardTemplates",
  /** Allows users to customise the mega menu by hiding top-level navigation items they are not interested in */
  GrafanaCustomizableMegaMenu: "grafana.customizableMegaMenu",
  /** Uses auto grid as the default layout for new dashboards */
  GrafanaDashboardAutoGridDefault: "grafana.dashboardAutoGridDefault",
  /** Enables Composer mode for editing dashboards with Grafana Assistant */
  GrafanaDashboardComposer: "grafana.dashboardComposer",
  /** Enables global and folder-scoped dashboard variables via dashboard.grafana.app */
  GrafanaDashboardGlobalVariables: "grafana.dashboardGlobalVariables",
  /** Enables Viewing and Editing modes for dynamic dashboards */
  GrafanaDashboardPreviewMode: "grafana.dashboardPreviewMode",
  /** Redesigns dashboard settings page into Advanced Settings in a modal window */
  GrafanaDashboardSettingsRedesign: "grafana.dashboardSettingsRedesign",
  /** Enables the tool that finds identical local variables across dashboards and promotes them to shared variables. Requires grafana.dashboardGlobalVariables */
  GrafanaDashboardVariablesMigration: "grafana.dashboardVariablesMigration",
  /** Enables the auto-height feature for dashboard panels */
  GrafanaDashboardsAutoHeightPanels: "grafana.dashboardsAutoHeightPanels",
  /** Check for the existence of logs when linking from the Trace View */
  GrafanaDynamicTraceToLogs: "grafana.dynamicTraceToLogs",
  /** Enables UI changes for integrations that require a scope to always be selected (for example, hides the scope selector's Remove all button) */
  GrafanaEnableScopesFirstMode: "grafana.enableScopesFirstMode",
  /** Enables the sidebar in Explore metrics (Metrics Drilldown) */
  GrafanaExploreMetricsSidebar: "grafana.exploreMetricsSidebar",
  /** Lets Grafana Assistant float the extension sidebar over the page instead of docking it */
  GrafanaExtensionSidebarFloating: "grafana.extensionSidebarFloating",
  /** Enables interactive grouped-label filtering through the tooltip in state timeline, status history and histogram panels */
  GrafanaFilterablePanels: "grafana.filterablePanels",
  /** Adds an experimental Protomaps vector basemap to the geomap panel */
  GrafanaGeomapProtomapsBasemap: "grafana.geomapProtomapsBasemap",
  /** Offers the reserved Grafana home option in the home dashboard preference */
  GrafanaGlobalHomePreference: "grafana.globalHomePreference",
  /** Enables PLG-focused growth redesign of the unified homepage */
  GrafanaGrowthHomepage: "grafana.growthHomepage",
  /** Enables usage of the new annotations API client */
  GrafanaKubernetesAnnotationsClient: "grafana.kubernetesAnnotationsClient",
  /** Deprecated: Toggle displayed fields from Log Details */
  GrafanaLogDetailsDisplayedFieldControls: "grafana.logDetailsDisplayedFieldControls",
  /** Enables log level inference from log line contents when level is not defined as a field or a label */
  GrafanaLogLevelInference: "grafana.logLevelInference",
  /** Disables dashboard edit mode (manual and assistant-driven) on mobile/small-screen viewports */
  GrafanaMobileEditDeprecation: "grafana.mobileEditDeprecation",
  /** Enables multi-tenant fallback behavior */
  GrafanaMtFallback: "grafana.mtFallback",
  /** Builds the navigation tree client-side instead of reading it from /bootdata */
  GrafanaMultiTenantNavTree: "grafana.multiTenantNavTree",
  /** Read the current user's permissions from the IAM app platform API instead of /api/access-control/user/actions */
  GrafanaMultiTenantUserPermissions: "grafana.multiTenantUserPermissions",
  /** Enables the refreshed information architecture for Grafana's navigation */
  GrafanaNavigationInfoArchRefresh: "grafana.navigationInfoArchRefresh",
  /** Enables a new UI for query errors and notices */
  GrafanaNewPanelQueryErrorsUI: "grafana.newPanelQueryErrorsUI",
  /** Enables the new text panel */
  GrafanaNewTextPanel: "grafana.newTextPanel",
  /** Adds a 'Download diagnostics' action that bundles diagnostic artifacts such as HTTP traffic (HAR), server log, dashboard and panel JSONs, and more */
  GrafanaOnDemandDiagnostics: "grafana.onDemandDiagnostics",
  /** Enables a new version of log details optimized for displaying OTel logs */
  GrafanaOtelLogDetails: "grafana.otelLogDetails",
  /** Enables firing an event for PanelEditNext feedback that triggers an in-house survey */
  GrafanaPanelEditNextFeedbackEvent: "grafana.panelEditNextFeedbackEvent",
  /** Let panel plugins register system transformations */
  GrafanaPanelPluginTransformations: "grafana.panelPluginTransformations",
  /** Pass React elements in plugin extension props by reference */
  GrafanaPluginExtensionReactElementProps: "grafana.pluginExtensionReactElementProps",
  /** Nest app plugin navigation items in the mega menu based on their URL path hierarchy */
  GrafanaPluginPathNesting: "grafana.pluginPathNesting",
  /** Preserves the navigation section label in the browser tab title after session expiry */
  GrafanaPreserveLoginTabTitle: "grafana.preserveLoginTabTitle",
  /** Enables a redesigned query variable editor with split-pane preview and a spreadsheet for managing static options */
  GrafanaQueryVarEditorRedesign: "grafana.queryVarEditorRedesign",
  /** Disables creating new recorded queries while preserving access to existing queries */
  GrafanaRecordedQueriesDisableCreate: "grafana.recordedQueriesDisableCreate",
  /** Enables Saved Dashboard Views: per-dashboard saved variable, filter and time range state */
  GrafanaSavedDashboardViews: "grafana.savedDashboardViews",
  /** Enables the dedicated Saved queries page and its navigation entry */
  GrafanaSavedQueriesPage: "grafana.savedQueriesPage",
  /** Prevents flickering in dashboards */
  GrafanaScenesFlickeringFix: "grafana.scenesFlickeringFix",
  /** Renders the scopes-suggested dashboards tree inside the navigation mega menu instead of the standalone docked drawer */
  GrafanaScopesDashboardsMegaMenu: "grafana.scopesDashboardsMegaMenu",
  /** Enable referencing an existing secret in an active keeper when creating a secure value */
  GrafanaSecretsReferenceValueUI: "grafana.secretsReferenceValueUI",
  /** Enables the SMTP settings admin page, which edits a stack's SMTP config through the settings service */
  GrafanaSmtpSettingsPage: "grafana.smtpSettingsPage",
  /** Enables starring folders and a virtual Starred folders folder in the dashboards list and folder picker */
  GrafanaStarredFolders: "grafana.starredFolders",
  /** Enables using dashboard variables in panel threshold values */
  GrafanaThresholdsInterpolation: "grafana.thresholdsInterpolation",
  /** Use the find default scope endpoint to seed the initial scope selection when none is set. */
  GrafanaUseDefaultScopesEndpoint: "grafana.useDefaultScopesEndpoint",
  /** Enables semantic (vector) dashboard search in the command palette */
  GrafanaVectorSearchCmdk: "grafana.vectorSearchCmdk",
  /** Enables the sidebar pane with new toggles and options in panel view mode */
  GrafanaViewPanelPane: "grafana.viewPanelPane",
  /** Enables the new visual design refresh for the Grafana UI */
  GrafanaVisualDesignRefresh: "grafana.visualDesignRefresh",
  /** Register experimental APIs with the k8s API server, including all datasources */
  GrafanaAPIServerWithExperimentalAPIs: "grafanaAPIServerWithExperimentalAPIs",
  /** Enables the Graphite data source full backend mode */
  GraphiteBackendMode: "graphiteBackendMode",
  /** Enables an inline version of Log Details that creates no new scrolls */
  InlineLogDetailsNoScrolls: "inlineLogDetailsNoScrolls",
  /** Adds support for Kubernetes correlations */
  KubernetesCorrelations: "kubernetesCorrelations",
  /** Enables team APIs in the app platform */
  KubernetesTeamsApi: "kubernetesTeamsApi",
  /** Routes library panel requests from /api to the /apis endpoint */
  LibraryelementsKubernetesLibraryPanels: "libraryelements.kubernetesLibraryPanels",
  /** Enables the logs tableNG panel to replace existing tableRT */
  LogsTablePanelNG: "logsTablePanelNG",
  /** Changes logs responses from Loki to be compliant with the dataplane specification. */
  LokiLogsDataplane: "lokiLogsDataplane",
  /** Use stream shards to split queries into smaller subqueries */
  LokiShardSplitting: "lokiShardSplitting",
  /** Enables managed plugins v2 (expanded rollout, community plugin coverage) */
  ManagedPluginsV2: "managedPluginsV2",
  /** Enables filters and group by variables on all new dashboards. Variables are added only if default data source supports filtering. */
  NewDashboardWithFiltersAndGroupBy: "newDashboardWithFiltersAndGroupBy",
  /** Enables the new Saved queries (query library) modal experience */
  NewSavedQueriesExperience: "newSavedQueriesExperience",
  /** Applies OTel formatting templates to displayed logs */
  OtelLogsFormatting: "otelLogsFormatting",
  /** Enables a new panel time settings drawer */
  PanelTimeSettings: "panelTimeSettings",
  /** Search for dashboards using panel title */
  PanelTitleSearch: "panelTitleSearch",
  /** Shows text labels on the add and stacked view buttons in PanelEditNext */
  PaneleditButtonLabels: "paneledit.buttonLabels",
  /** Enables viewing non-applicable drilldowns on a panel level */
  PerPanelNonApplicableDrilldowns: "perPanelNonApplicableDrilldowns",
  /** Enable gradient color scheme option for the pie chart panel */
  PieChartGradientColorScheme: "pieChartGradientColorScheme",
  /** Enables RBAC for playlists */
  PlaylistsRBAC: "playlistsRBAC",
  /** Show insights for plugins in the plugin details page */
  PluginInsights: "pluginInsights",
  /** Initializes data source instance settings asynchronously from the API instead of synchronously from boot data */
  PluginsInitDataSourcesAsync: "plugins.initDataSourcesAsync",
  /** Enables plugins setting from new apis */
  PluginsUseMTPluginSettings: "plugins.useMTPluginSettings",
  /** Enables plugins decoupling from bootdata */
  PluginsUseMTPlugins: "plugins.useMTPlugins",
  /** Prefer library panel title over viz panel title. */
  PreferLibraryPanelTitle: "preferLibraryPanelTitle",
  /** Enables possibility to preserve dashboard variables and time range when navigating between dashboards */
  PreserveDashboardStateWhenNavigating: "preserveDashboardStateWhenNavigating",
  /** Enable export functionality for provisioned resources */
  ProvisioningExport: "provisioningExport",
  /** Allow setting folder metadata for provisioned folders */
  ProvisioningFolderMetadata: "provisioningFolderMetadata",
  /** Enables public dashboard sharing to be restricted to only allowed emails */
  PublicDashboardsEmailSharing: "publicDashboardsEmailSharing",
  /** Enables next generation query editor experience */
  QueryEditorNext: "queryEditorNext",
  /** Store query history in browser IndexedDB instead of server-side */
  QueryHistoryLocalOnly: "queryHistory.localOnly",
  /** Replace the Query History drawer with a new Recent Queries modal UI */
  QueryHistoryRecentQueriesUI: "queryHistory.recentQueriesUI",
  /** Register /apis/query.grafana.app/ -- will eventually replace /api/ds/query */
  QueryService: "queryService",
  /** Adds datasource connections to the query service */
  QueryServiceWithConnections: "queryServiceWithConnections",
  /** Enables the Query with Assistant button in the query editor */
  QueryWithAssistant: "queryWithAssistant",
  /** Enables AI-assisted coauthoring in code query editors */
  QueryeditorCoauthoringUi: "queryeditor.coauthoringUi",
  /** Renders the raw Prometheus query results table using TableNG instead of the legacy Table */
  RawPrometheusTableNg: "rawPrometheus.tableNg",
  /** Enables recently viewed dashboards section in the browsing dashboard page */
  RecentlyViewedDashboards: "recentlyViewedDashboards",
  /** Enables reload of dashboards on scopes, time range and variables changes */
  ReloadDashboardsOnParamsChange: "reloadDashboardsOnParamsChange",
  /** Enables reporting for any page in Grafana */
  ReportingAnyPageReporting: "reporting.anyPageReporting",
  /** Removes the URL option for report and email logo fields in reporting settings, leaving image upload as the only option */
  ReportingRemoveLogoUrlField: "reporting.removeLogoUrlField",
  /** Enables the configurable footer settings for PDF reports */
  ReportingFooterSettings: "reportingFooterSettings",
  /** Enables configuration of PDF report settings */
  ReportingHeaderSettings: "reportingHeaderSettings",
  /** Enables the new role picker drawer design */
  RolePickerDrawer: "rolePickerDrawer",
  /** Enables Saved queries (query library) RBAC permissions */
  SavedQueriesRBAC: "savedQueriesRBAC",
  /** Enables the use of scope filters in Grafana */
  ScopeFilters: "scopeFilters",
  /** Enable scope search to include all levels of the scope node tree */
  ScopeSearchAllLevels: "scopeSearchAllLevels",
  /** Enable the secrets management app platform UI */
  SecretsManagementAppPlatformUI: "secretsManagementAppPlatformUI",
  /** Enables the ASAP smoothing transformation for time series data */
  SmoothingTransformation: "smoothingTransformation",
  /** Routes snapshot requests from /api to the /apis endpoint */
  SnapshotsKubernetesSnapshots: "snapshots.kubernetesSnapshots",
  /** Enables the splash screen modal for introducing new Grafana features on first session */
  SplashScreen: "splashScreen",
  /** Enables CodeMirror editor for SQL Expressions */
  SqlExpressionsCodeMirror: "sqlExpressionsCodeMirror",
  /** Enables column autocomplete for SQL Expressions */
  SqlExpressionsColumnAutoComplete: "sqlExpressionsColumnAutoComplete",
  /** Enables option to position series names above bars in the state timeline panel */
  StateTimelineNameAboveBars: "stateTimeline.nameAboveBars",
  /** Displays datasource provisioned and community dashboards in dashboard empty page, only when coming from datasource configuration page */
  SuggestedDashboards: "suggestedDashboards",
  /** Enables the 'Customize with Assistant' button on suggested dashboard cards */
  SuggestedDashboardsAssistantButton: "suggestedDashboardsAssistantButton",
  /** Sizes TableNG auto-width columns to fit their content instead of distributing evenly */
  TableAutoColumnWidths: "table.autoColumnWidths",
  /** Enables TableNG in the panel inspector's Data tab, replacing the legacy Table (TableRT) */
  TableInspectDataTableNG: "table.inspectDataTableNG",
  /** Enables configuring a fixed page size for paginated tables instead of deriving it from the panel height */
  TablePaginationPageSize: "table.paginationPageSize",
  /** Enables the refreshed table experience: reworked column headers and ad hoc column interactions */
  TableRefresh: "table.refresh",
  /** Catch-all toggle for new features developed as part of the Q3 table panel refresh */
  TableRefreshNewFeatures: "table.refreshNewFeatures",
  /** Enables shared crosshair in table panel */
  TableSharedCrosshair: "tableSharedCrosshair",
  /** Enables the new features in text panel */
  TextNewFeatures: "text.newFeatures",
  /** Enables time comparison option in supported panels */
  TimeComparison: "timeComparison",
  /** Show transformation quick-start cards in empty transformations state */
  TransformationsEmptyPlaceholder: "transformationsEmptyPlaceholder",
  /** Enables unified navbars */
  UnifiedNavbars: "unifiedNavbars",
  /** Routes short URL requests from /api to the /apis endpoint in the frontend. Depends on kubernetesShortURLs */
  UseKubernetesShortURLsAPI: "useKubernetesShortURLsAPI",
  /** Use the scopes navigation endpoint instead of the dashboardbindings endpoint */
  UseScopesNavigationEndpoint: "useScopesNavigationEndpoint",
  /** Allows authenticated API calls in actions */
  VizActionsAuth: "vizActionsAuth",
} as const;

/**
 * Enable configuration of alert enrichments in Grafana Cloud.
 *
 * **Details:**
 * - flag key: `alertEnrichment`
 * - default value: `false`
 */
export const useFlagAlertEnrichment = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("alertEnrichment", false, options).value;
};

/**
 * Enables the alert rule restore feature
 *
 * **Details:**
 * - flag key: `alertRuleRestore`
 * - default value: `true`
 */
export const useFlagAlertRuleRestore = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("alertRuleRestore", true, options).value;
};

/**
 * Hand data source managed alerting URLs over to the grafana-prometheusalerting-app plugin
 *
 * **Details:**
 * - flag key: `alerting.dataSourceManagedRouteProxy`
 * - default value: `false`
 */
export const useFlagAlertingDataSourceManagedRouteProxy = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("alerting.dataSourceManagedRouteProxy", false, options).value;
};

/**
 * Enables the separate Grafana-managed Alert rules and Recording rules list pages, replacing the combined rule list
 *
 * **Details:**
 * - flag key: `alerting.gmaOnlyListView`
 * - default value: `false`
 */
export const useFlagAlertingGmaOnlyListView = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("alerting.gmaOnlyListView", false, options).value;
};

/**
 * Enable manually starting an Assistant investigation from the alert instance drawer.
 *
 * **Details:**
 * - flag key: `alerting.manualAssistantInvestigation`
 * - default value: `false`
 */
export const useFlagAlertingManualAssistantInvestigation = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("alerting.manualAssistantInvestigation", false, options).value;
};

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
 * Enable fixing alert rule quality issues with Grafana Assistant on the alert quality page.
 *
 * **Details:**
 * - flag key: `alerting.ruleQualityFix`
 * - default value: `false`
 */
export const useFlagAlertingRuleQualityFix = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("alerting.ruleQualityFix", false, options).value;
};

/**
 * Enable assistant reviews on the alert quality page.
 *
 * **Details:**
 * - flag key: `alerting.ruleReviews`
 * - default value: `false`
 */
export const useFlagAlertingRuleReviews = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("alerting.ruleReviews", false, options).value;
};

/**
 * Automatically keeps imported notification configuration up to date with a Mimir or Cortex Alertmanager data source
 *
 * **Details:**
 * - flag key: `alerting.syncExternalAlertmanager`
 * - default value: `false`
 */
export const useFlagAlertingSyncExternalAlertmanager = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("alerting.syncExternalAlertmanager", false, options).value;
};

/**
 * Enables enhanced stat mode for the Alert List panel with thresholds, value mappings, and linking
 *
 * **Details:**
 * - flag key: `alertingAlertListPanelEnhancements`
 * - default value: `false`
 */
export const useFlagAlertingAlertListPanelEnhancements = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("alertingAlertListPanelEnhancements", false, options).value;
};

/**
 * Rule backtesting API for alerting
 *
 * **Details:**
 * - flag key: `alertingBacktesting`
 * - default value: `false`
 */
export const useFlagAlertingBacktesting = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("alertingBacktesting", false, options).value;
};

/**
 * Disables the ability to send alerts to an external Alertmanager datasource.
 *
 * **Details:**
 * - flag key: `alertingDisableSendAlertsExternal`
 * - default value: `false`
 */
export const useFlagAlertingDisableSendAlertsExternal = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("alertingDisableSendAlertsExternal", false, options).value;
};

/**
 * Enable Assistant Investigations enrichment type.
 *
 * **Details:**
 * - flag key: `alertingEnrichmentAssistantInvestigations`
 * - default value: `false`
 */
export const useFlagAlertingEnrichmentAssistantInvestigations = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("alertingEnrichmentAssistantInvestigations", false, options).value;
};

/**
 * Enable enrichment per rule in the alerting UI.
 *
 * **Details:**
 * - flag key: `alertingEnrichmentPerRule`
 * - default value: `false`
 */
export const useFlagAlertingEnrichmentPerRule = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("alertingEnrichmentPerRule", false, options).value;
};

/**
 * Enables the new Jira integration for contact points in cloud alert managers.
 *
 * **Details:**
 * - flag key: `alertingJiraIntegration`
 * - default value: `false`
 */
export const useFlagAlertingJiraIntegration = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("alertingJiraIntegration", false, options).value;
};

/**
 * Enables the new alert list view design
 *
 * **Details:**
 * - flag key: `alertingListViewV2`
 * - default value: `true`
 */
export const useFlagAlertingListViewV2 = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("alertingListViewV2", true, options).value;
};

/**
 * Enables the alerting list view v2 preview toggle
 *
 * **Details:**
 * - flag key: `alertingListViewV2PreviewToggle`
 * - default value: `false`
 */
export const useFlagAlertingListViewV2PreviewToggle = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("alertingListViewV2PreviewToggle", false, options).value;
};

/**
 * Enables the migration wizard UI to migrate alert rules and notification resources from external sources to Grafana Alerting
 *
 * **Details:**
 * - flag key: `alertingMigrationWizardUI`
 * - default value: `false`
 */
export const useFlagAlertingMigrationWizardUI = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("alertingMigrationWizardUI", false, options).value;
};

/**
 * Enables the new Alerting navigation structure with improved menu grouping
 *
 * **Details:**
 * - flag key: `alertingNavigationV2`
 * - default value: `true`
 */
export const useFlagAlertingNavigationV2 = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("alertingNavigationV2", true, options).value;
};

/**
 * Uses Prometheus rules as the primary source of truth for ruler-enabled data sources
 *
 * **Details:**
 * - flag key: `alertingPrometheusRulesPrimary`
 * - default value: `false`
 */
export const useFlagAlertingPrometheusRulesPrimary = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("alertingPrometheusRulesPrimary", false, options).value;
};

/**
 * Enables the UI functionality to recover and view deleted alert rules
 *
 * **Details:**
 * - flag key: `alertingRuleRecoverDeleted`
 * - default value: `true`
 */
export const useFlagAlertingRuleRecoverDeleted = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("alertingRuleRecoverDeleted", true, options).value;
};

/**
 * Use the new k8s API for fetching integration type schemas
 *
 * **Details:**
 * - flag key: `alertingSyncNotifiersApiMigration`
 * - default value: `false`
 */
export const useFlagAlertingSyncNotifiersApiMigration = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("alertingSyncNotifiersApiMigration", false, options).value;
};

/**
 * Deprecated. The alert activity page is shown when alert state history is written to Prometheus. Set to false to hide it.
 *
 * **Details:**
 * - flag key: `alertingTriage`
 * - default value: `true`
 */
export const useFlagAlertingTriage = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("alertingTriage", true, options).value;
};

/**
 * Enables the UI to use certain backend-side filters
 *
 * **Details:**
 * - flag key: `alertingUIUseBackendFilters`
 * - default value: `true`
 */
export const useFlagAlertingUIUseBackendFilters = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("alertingUIUseBackendFilters", true, options).value;
};

/**
 * Enables the UI to use rules backend-side filters 100% compatible with the frontend filters
 *
 * **Details:**
 * - flag key: `alertingUIUseFullyCompatBackendFilters`
 * - default value: `true`
 */
export const useFlagAlertingUIUseFullyCompatBackendFilters = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("alertingUIUseFullyCompatBackendFilters", true, options).value;
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
 * Previews the dashboard changes a plugin such as Grafana Assistant proposes, and lets plugins reload and embed dashboards with them
 *
 * **Details:**
 * - flag key: `assistant.dashboard.artifacts`
 * - default value: `false`
 */
export const useFlagAssistantDashboardArtifacts = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("assistant.dashboard.artifacts", false, options).value;
};

/**
 * Shows a loading screen on the dashboard while the assistant prepares to build an approved dashboard plan
 *
 * **Details:**
 * - flag key: `assistant.dashboardPlanBuildingScreen`
 * - default value: `false`
 */
export const useFlagAssistantDashboardPlanBuildingScreen = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("assistant.dashboardPlanBuildingScreen", false, options).value;
};

/**
 * Enables the assistant-powered Generate dashboard prompt and the plan card that approves the dashboard before it is built
 *
 * **Details:**
 * - flag key: `assistant.dashboardPlanning`
 * - default value: `false`
 */
export const useFlagAssistantDashboardPlanning = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("assistant.dashboardPlanning", false, options).value;
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
 * Enables user auth for Azure Monitor datasource only
 *
 * **Details:**
 * - flag key: `azureMonitorEnableUserAuth`
 * - default value: `true`
 */
export const useFlagAzureMonitorEnableUserAuth = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("azureMonitorEnableUserAuth", true, options).value;
};

/**
 * Enables the logs builder mode for the Azure Monitor data source
 *
 * **Details:**
 * - flag key: `azureMonitorLogsBuilderEditor`
 * - default value: `false`
 */
export const useFlagAzureMonitorLogsBuilderEditor = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("azureMonitorLogsBuilderEditor", false, options).value;
};

/**
 * Enables the updated Azure Monitor resource picker
 *
 * **Details:**
 * - flag key: `azureResourcePickerUpdates`
 * - default value: `true`
 */
export const useFlagAzureResourcePickerUpdates = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("azureResourcePickerUpdates", true, options).value;
};

/**
 * Allow elements nesting
 *
 * **Details:**
 * - flag key: `canvasPanelNesting`
 * - default value: `false`
 */
export const useFlagCanvasPanelNesting = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("canvasPanelNesting", false, options).value;
};

/**
 * Allow pan and zoom in canvas panel
 *
 * **Details:**
 * - flag key: `canvasPanelPanZoom`
 * - default value: `false`
 */
export const useFlagCanvasPanelPanZoom = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("canvasPanelPanZoom", false, options).value;
};

/**
 * Enables cross-account querying in CloudWatch datasources
 *
 * **Details:**
 * - flag key: `cloudWatchCrossAccountQuerying`
 * - default value: `true`
 */
export const useFlagCloudWatchCrossAccountQuerying = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("cloudWatchCrossAccountQuerying", true, options).value;
};

/**
 * Enables the new sidebar filter panel in the Add new connection page
 *
 * **Details:**
 * - flag key: `connectionsFilterSidebar`
 * - default value: `false`
 */
export const useFlagConnectionsFilterSidebar = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("connectionsFilterSidebar", false, options).value;
};

/**
 * Enables browser crash detection reporting to Faro.
 *
 * **Details:**
 * - flag key: `crashDetection`
 * - default value: `false`
 */
export const useFlagCrashDetection = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("crashDetection", false, options).value;
};

/**
 * Enables creating alert rules from a panel using a drawer UI
 *
 * **Details:**
 * - flag key: `createAlertRuleFromPanel`
 * - default value: `false`
 */
export const useFlagCreateAlertRuleFromPanel = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("createAlertRuleFromPanel", false, options).value;
};

/**
 * Enables Critical User Journey (CUJ) tracking
 *
 * **Details:**
 * - flag key: `cujTracking`
 * - default value: `false`
 */
export const useFlagCujTracking = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("cujTracking", false, options).value;
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
 * Supports __from and __to macros that always use the dashboard level time range
 *
 * **Details:**
 * - flag key: `dashboardLevelTimeMacros`
 * - default value: `false`
 */
export const useFlagDashboardLevelTimeMacros = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("dashboardLevelTimeMacros", false, options).value;
};

/**
 * Displays datasource provisioned dashboards in dashboard empty page, only when coming from datasource configuration page
 *
 * **Details:**
 * - flag key: `dashboardLibrary`
 * - default value: `false`
 */
export const useFlagDashboardLibrary = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("dashboardLibrary", false, options).value;
};

/**
 * Enables new dashboard layouts
 *
 * **Details:**
 * - flag key: `dashboardNewLayouts`
 * - default value: `true`
 */
export const useFlagDashboardNewLayouts = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("dashboardNewLayouts", true, options).value;
};

/**
 * Enables a flow to get started with a new dashboard from a template
 *
 * **Details:**
 * - flag key: `dashboardTemplates`
 * - default value: `false`
 */
export const useFlagDashboardTemplates = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("dashboardTemplates", false, options).value;
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
 * Enables undo/redo in dynamic dashboards
 *
 * **Details:**
 * - flag key: `dashboardUndoRedo`
 * - default value: `false`
 */
export const useFlagDashboardUndoRedo = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("dashboardUndoRedo", false, options).value;
};

/**
 * Enables dashboard validator app to run compatibility checks between a dashboard and data source
 *
 * **Details:**
 * - flag key: `dashboardValidatorApp`
 * - default value: `false`
 */
export const useFlagDashboardValidatorApp = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("dashboardValidatorApp", false, options).value;
};

/**
 * Disables public dashboards for the stack
 *
 * **Details:**
 * - flag key: `dashboards.disablePublicDashboards`
 * - default value: `false`
 */
export const useFlagDashboardsDisablePublicDashboards = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("dashboards.disablePublicDashboards", false, options).value;
};

/**
 * Expands a horizontal repeat copied from a library panel definition to the full grid width, matching how horizontal repeats on dashboard panels are laid out
 *
 * **Details:**
 * - flag key: `dashboards.libraryPanelHorizontalRepeatFullWidth`
 * - default value: `false`
 */
export const useFlagDashboardsLibraryPanelHorizontalRepeatFullWidth = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("dashboards.libraryPanelHorizontalRepeatFullWidth", false, options).value;
};

/**
 * Migrates a library panel repeat on the frontend only when the server did not already resolve it, instead of deciding from dashboard sharing state
 *
 * **Details:**
 * - flag key: `dashboards.libraryPanelRepeatFromServerResolution`
 * - default value: `false`
 */
export const useFlagDashboardsLibraryPanelRepeatFromServerResolution = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("dashboards.libraryPanelRepeatFromServerResolution", false, options).value;
};

/**
 * Resolves the dashboard toolbar public-share badge from the public dashboards API instead of the access.isPublic field on /dto
 *
 * **Details:**
 * - flag key: `dashboards.publicDashboardBadgeFromApi`
 * - default value: `false`
 */
export const useFlagDashboardsPublicDashboardBadgeFromApi = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("dashboards.publicDashboardBadgeFromApi", false, options).value;
};

/**
 * Shows defined connections for a data source in the plugins detail page
 *
 * **Details:**
 * - flag key: `datasourceConnectionsTab`
 * - default value: `false`
 */
export const useFlagDatasourceConnectionsTab = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("datasourceConnectionsTab", false, options).value;
};

/**
 * Enables the Metrics Batch API for the Azure Monitor data source, allowing up to 50 resources to be queried in a single request
 *
 * **Details:**
 * - flag key: `datasources.azureMonitorBatchAPI`
 * - default value: `true`
 */
export const useFlagDatasourcesAzureMonitorBatchAPI = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("datasources.azureMonitorBatchAPI", true, options).value;
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
 * Enable support for the query gateway audit policies
 *
 * **Details:**
 * - flag key: `datasources.gatewayAuditPolicy`
 * - default value: `false`
 */
export const useFlagDatasourcesGatewayAuditPolicy = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("datasources.gatewayAuditPolicy", false, options).value;
};

/**
 * Data source query gateway guardrails
 *
 * **Details:**
 * - flag key: `datasources.gatewayGuardrails`
 * - default value: `false`
 */
export const useFlagDatasourcesGatewayGuardrails = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("datasources.gatewayGuardrails", false, options).value;
};

/**
 * Data source query service, use the new name
 *
 * **Details:**
 * - flag key: `datasources.querier.newName`
 * - default value: `false`
 */
export const useFlagDatasourcesQuerierNewName = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("datasources.querier.newName", false, options).value;
};

/**
 * Data source query gateway
 *
 * **Details:**
 * - flag key: `datasources.queryGateway`
 * - default value: `false`
 */
export const useFlagDatasourcesQueryGateway = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("datasources.queryGateway", false, options).value;
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
 * Enables tabular numerals for visualization legend values
 *
 * **Details:**
 * - flag key: `dataviz.tabularNums`
 * - default value: `false`
 */
export const useFlagDatavizTabularNums = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("dataviz.tabularNums", false, options).value;
};

/**
 * Disables legacy scripted dashboards, which are deprecated and will be removed in Grafana 14. Set to false to temporarily restore them.
 *
 * **Details:**
 * - flag key: `disableScriptedDashboards`
 * - default value: `true`
 */
export const useFlagDisableScriptedDashboards = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("disableScriptedDashboards", true, options).value;
};

/**
 * Enables new colorblind safe palette and line fill patterns for panels
 *
 * **Details:**
 * - flag key: `enableColorblindSafePanelOptions`
 * - default value: `false`
 */
export const useFlagEnableColorblindSafePanelOptions = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("enableColorblindSafePanelOptions", false, options).value;
};

/**
 * Enables the extension admin page regardless of development mode
 *
 * **Details:**
 * - flag key: `enableExtensionsAdminPage`
 * - default value: `false`
 */
export const useFlagEnableExtensionsAdminPage = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("enableExtensionsAdminPage", false, options).value;
};

/**
 * Automatic service account and token setup for plugins
 *
 * **Details:**
 * - flag key: `externalServiceAccounts`
 * - default value: `false`
 */
export const useFlagExternalServiceAccounts = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("externalServiceAccounts", false, options).value;
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
 * Enable favorite datasources
 *
 * **Details:**
 * - flag key: `favoriteDatasources`
 * - default value: `false`
 */
export const useFlagFavoriteDatasources = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("favoriteDatasources", false, options).value;
};

/**
 * Enables the feedback button in the dashboard edit sidebar
 *
 * **Details:**
 * - flag key: `feedbackButton`
 * - default value: `true`
 */
export const useFlagFeedbackButton = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("feedbackButton", true, options).value;
};

/**
 * Renders the flame graph's top table using TableNG instead of the legacy Table
 *
 * **Details:**
 * - flag key: `flameGraph.tableNg`
 * - default value: `false`
 */
export const useFlagFlameGraphTableNg = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("flameGraph.tableNg", false, options).value;
};

/**
 * Enables use of app platform API for folders
 *
 * **Details:**
 * - flag key: `foldersAppPlatformAPI`
 * - default value: `true`
 */
export const useFlagFoldersAppPlatformAPI = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("foldersAppPlatformAPI", true, options).value;
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
 * Allow admins to make announcement banners dismissible by users
 *
 * **Details:**
 * - flag key: `grafana.announcementBannerDismissible`
 * - default value: `true`
 */
export const useFlagGrafanaAnnouncementBannerDismissible = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.announcementBannerDismissible", true, options).value;
};

/**
 * Uses the hybrid (lexical + semantic) search endpoint as the dashboard search backend in the command palette
 *
 * **Details:**
 * - flag key: `grafana.cmdkHybridSearch`
 * - default value: `false`
 */
export const useFlagGrafanaCmdkHybridSearch = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.cmdkHybridSearch", false, options).value;
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
 * Uses auto grid as the default layout for new dashboards
 *
 * **Details:**
 * - flag key: `grafana.dashboardAutoGridDefault`
 * - default value: `true`
 */
export const useFlagGrafanaDashboardAutoGridDefault = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.dashboardAutoGridDefault", true, options).value;
};

/**
 * Enables Composer mode for editing dashboards with Grafana Assistant
 *
 * **Details:**
 * - flag key: `grafana.dashboardComposer`
 * - default value: `false`
 */
export const useFlagGrafanaDashboardComposer = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.dashboardComposer", false, options).value;
};

/**
 * Enables global and folder-scoped dashboard variables via dashboard.grafana.app
 *
 * **Details:**
 * - flag key: `grafana.dashboardGlobalVariables`
 * - default value: `false`
 */
export const useFlagGrafanaDashboardGlobalVariables = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.dashboardGlobalVariables", false, options).value;
};

/**
 * Enables Viewing and Editing modes for dynamic dashboards
 *
 * **Details:**
 * - flag key: `grafana.dashboardPreviewMode`
 * - default value: `false`
 */
export const useFlagGrafanaDashboardPreviewMode = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.dashboardPreviewMode", false, options).value;
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
 * Enables the tool that finds identical local variables across dashboards and promotes them to shared variables. Requires grafana.dashboardGlobalVariables
 *
 * **Details:**
 * - flag key: `grafana.dashboardVariablesMigration`
 * - default value: `false`
 */
export const useFlagGrafanaDashboardVariablesMigration = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.dashboardVariablesMigration", false, options).value;
};

/**
 * Enables the auto-height feature for dashboard panels
 *
 * **Details:**
 * - flag key: `grafana.dashboardsAutoHeightPanels`
 * - default value: `false`
 */
export const useFlagGrafanaDashboardsAutoHeightPanels = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.dashboardsAutoHeightPanels", false, options).value;
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
 * Lets Grafana Assistant float the extension sidebar over the page instead of docking it
 *
 * **Details:**
 * - flag key: `grafana.extensionSidebarFloating`
 * - default value: `false`
 */
export const useFlagGrafanaExtensionSidebarFloating = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.extensionSidebarFloating", false, options).value;
};

/**
 * Enables interactive grouped-label filtering through the tooltip in state timeline, status history and histogram panels
 *
 * **Details:**
 * - flag key: `grafana.filterablePanels`
 * - default value: `true`
 */
export const useFlagGrafanaFilterablePanels = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.filterablePanels", true, options).value;
};

/**
 * Adds an experimental Protomaps vector basemap to the geomap panel
 *
 * **Details:**
 * - flag key: `grafana.geomapProtomapsBasemap`
 * - default value: `false`
 */
export const useFlagGrafanaGeomapProtomapsBasemap = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.geomapProtomapsBasemap", false, options).value;
};

/**
 * Offers the reserved Grafana home option in the home dashboard preference
 *
 * **Details:**
 * - flag key: `grafana.globalHomePreference`
 * - default value: `false`
 */
export const useFlagGrafanaGlobalHomePreference = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.globalHomePreference", false, options).value;
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
 * Deprecated: Toggle displayed fields from Log Details
 *
 * **Details:**
 * - flag key: `grafana.logDetailsDisplayedFieldControls`
 * - default value: `false`
 */
export const useFlagGrafanaLogDetailsDisplayedFieldControls = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.logDetailsDisplayedFieldControls", false, options).value;
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
 * Disables dashboard edit mode (manual and assistant-driven) on mobile/small-screen viewports
 *
 * **Details:**
 * - flag key: `grafana.mobileEditDeprecation`
 * - default value: `false`
 */
export const useFlagGrafanaMobileEditDeprecation = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.mobileEditDeprecation", false, options).value;
};

/**
 * Enables multi-tenant fallback behavior
 *
 * **Details:**
 * - flag key: `grafana.mtFallback`
 * - default value: `{}`
 */
export const useFlagGrafanaMtFallback = (options?: ReactFlagEvaluationOptions): JsonValue => {
  return useFlag("grafana.mtFallback", {}, options).value;
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
 * Read the current user's permissions from the IAM app platform API instead of /api/access-control/user/actions
 *
 * **Details:**
 * - flag key: `grafana.multiTenantUserPermissions`
 * - default value: `false`
 */
export const useFlagGrafanaMultiTenantUserPermissions = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.multiTenantUserPermissions", false, options).value;
};

/**
 * Enables the refreshed information architecture for Grafana's navigation
 *
 * **Details:**
 * - flag key: `grafana.navigationInfoArchRefresh`
 * - default value: `false`
 */
export const useFlagGrafanaNavigationInfoArchRefresh = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.navigationInfoArchRefresh", false, options).value;
};

/**
 * Enables a new UI for query errors and notices
 *
 * **Details:**
 * - flag key: `grafana.newPanelQueryErrorsUI`
 * - default value: `true`
 */
export const useFlagGrafanaNewPanelQueryErrorsUI = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.newPanelQueryErrorsUI", true, options).value;
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
 * Enables a new version of log details optimized for displaying OTel logs
 *
 * **Details:**
 * - flag key: `grafana.otelLogDetails`
 * - default value: `false`
 */
export const useFlagGrafanaOtelLogDetails = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.otelLogDetails", false, options).value;
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
 * Let panel plugins register system transformations
 *
 * **Details:**
 * - flag key: `grafana.panelPluginTransformations`
 * - default value: `false`
 */
export const useFlagGrafanaPanelPluginTransformations = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.panelPluginTransformations", false, options).value;
};

/**
 * Pass React elements in plugin extension props by reference
 *
 * **Details:**
 * - flag key: `grafana.pluginExtensionReactElementProps`
 * - default value: `false`
 */
export const useFlagGrafanaPluginExtensionReactElementProps = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.pluginExtensionReactElementProps", false, options).value;
};

/**
 * Nest app plugin navigation items in the mega menu based on their URL path hierarchy
 *
 * **Details:**
 * - flag key: `grafana.pluginPathNesting`
 * - default value: `false`
 */
export const useFlagGrafanaPluginPathNesting = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.pluginPathNesting", false, options).value;
};

/**
 * Preserves the navigation section label in the browser tab title after session expiry
 *
 * **Details:**
 * - flag key: `grafana.preserveLoginTabTitle`
 * - default value: `false`
 */
export const useFlagGrafanaPreserveLoginTabTitle = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.preserveLoginTabTitle", false, options).value;
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
 * Disables creating new recorded queries while preserving access to existing queries
 *
 * **Details:**
 * - flag key: `grafana.recordedQueriesDisableCreate`
 * - default value: `true`
 */
export const useFlagGrafanaRecordedQueriesDisableCreate = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.recordedQueriesDisableCreate", true, options).value;
};

/**
 * Enables Saved Dashboard Views: per-dashboard saved variable, filter and time range state
 *
 * **Details:**
 * - flag key: `grafana.savedDashboardViews`
 * - default value: `false`
 */
export const useFlagGrafanaSavedDashboardViews = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.savedDashboardViews", false, options).value;
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
 * Renders the scopes-suggested dashboards tree inside the navigation mega menu instead of the standalone docked drawer
 *
 * **Details:**
 * - flag key: `grafana.scopesDashboardsMegaMenu`
 * - default value: `false`
 */
export const useFlagGrafanaScopesDashboardsMegaMenu = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.scopesDashboardsMegaMenu", false, options).value;
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
 * Enables the SMTP settings admin page, which edits a stack's SMTP config through the settings service
 *
 * **Details:**
 * - flag key: `grafana.smtpSettingsPage`
 * - default value: `false`
 */
export const useFlagGrafanaSmtpSettingsPage = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.smtpSettingsPage", false, options).value;
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
 * Enables using dashboard variables in panel threshold values
 *
 * **Details:**
 * - flag key: `grafana.thresholdsInterpolation`
 * - default value: `true`
 */
export const useFlagGrafanaThresholdsInterpolation = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.thresholdsInterpolation", true, options).value;
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
 * - default value: `true`
 */
export const useFlagGrafanaViewPanelPane = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafana.viewPanelPane", true, options).value;
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
 * Register experimental APIs with the k8s API server, including all datasources
 *
 * **Details:**
 * - flag key: `grafanaAPIServerWithExperimentalAPIs`
 * - default value: `false`
 */
export const useFlagGrafanaAPIServerWithExperimentalAPIs = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("grafanaAPIServerWithExperimentalAPIs", false, options).value;
};

/**
 * Enables the Graphite data source full backend mode
 *
 * **Details:**
 * - flag key: `graphiteBackendMode`
 * - default value: `false`
 */
export const useFlagGraphiteBackendMode = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("graphiteBackendMode", false, options).value;
};

/**
 * Enables an inline version of Log Details that creates no new scrolls
 *
 * **Details:**
 * - flag key: `inlineLogDetailsNoScrolls`
 * - default value: `true`
 */
export const useFlagInlineLogDetailsNoScrolls = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("inlineLogDetailsNoScrolls", true, options).value;
};

/**
 * Adds support for Kubernetes correlations
 *
 * **Details:**
 * - flag key: `kubernetesCorrelations`
 * - default value: `false`
 */
export const useFlagKubernetesCorrelations = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("kubernetesCorrelations", false, options).value;
};

/**
 * Enables team APIs in the app platform
 *
 * **Details:**
 * - flag key: `kubernetesTeamsApi`
 * - default value: `false`
 */
export const useFlagKubernetesTeamsApi = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("kubernetesTeamsApi", false, options).value;
};

/**
 * Routes library panel requests from /api to the /apis endpoint
 *
 * **Details:**
 * - flag key: `libraryelements.kubernetesLibraryPanels`
 * - default value: `false`
 */
export const useFlagLibraryelementsKubernetesLibraryPanels = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("libraryelements.kubernetesLibraryPanels", false, options).value;
};

/**
 * Enables the logs tableNG panel to replace existing tableRT
 *
 * **Details:**
 * - flag key: `logsTablePanelNG`
 * - default value: `true`
 */
export const useFlagLogsTablePanelNG = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("logsTablePanelNG", true, options).value;
};

/**
 * Changes logs responses from Loki to be compliant with the dataplane specification.
 *
 * **Details:**
 * - flag key: `lokiLogsDataplane`
 * - default value: `false`
 */
export const useFlagLokiLogsDataplane = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("lokiLogsDataplane", false, options).value;
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
 * Enables filters and group by variables on all new dashboards. Variables are added only if default data source supports filtering.
 *
 * **Details:**
 * - flag key: `newDashboardWithFiltersAndGroupBy`
 * - default value: `false`
 */
export const useFlagNewDashboardWithFiltersAndGroupBy = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("newDashboardWithFiltersAndGroupBy", false, options).value;
};

/**
 * Enables the new Saved queries (query library) modal experience
 *
 * **Details:**
 * - flag key: `newSavedQueriesExperience`
 * - default value: `true`
 */
export const useFlagNewSavedQueriesExperience = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("newSavedQueriesExperience", true, options).value;
};

/**
 * Applies OTel formatting templates to displayed logs
 *
 * **Details:**
 * - flag key: `otelLogsFormatting`
 * - default value: `true`
 */
export const useFlagOtelLogsFormatting = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("otelLogsFormatting", true, options).value;
};

/**
 * Enables a new panel time settings drawer
 *
 * **Details:**
 * - flag key: `panelTimeSettings`
 * - default value: `true`
 */
export const useFlagPanelTimeSettings = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("panelTimeSettings", true, options).value;
};

/**
 * Search for dashboards using panel title
 *
 * **Details:**
 * - flag key: `panelTitleSearch`
 * - default value: `false`
 */
export const useFlagPanelTitleSearch = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("panelTitleSearch", false, options).value;
};

/**
 * Shows text labels on the add and stacked view buttons in PanelEditNext
 *
 * **Details:**
 * - flag key: `paneledit.buttonLabels`
 * - default value: `false`
 */
export const useFlagPaneleditButtonLabels = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("paneledit.buttonLabels", false, options).value;
};

/**
 * Enables viewing non-applicable drilldowns on a panel level
 *
 * **Details:**
 * - flag key: `perPanelNonApplicableDrilldowns`
 * - default value: `false`
 */
export const useFlagPerPanelNonApplicableDrilldowns = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("perPanelNonApplicableDrilldowns", false, options).value;
};

/**
 * Enable gradient color scheme option for the pie chart panel
 *
 * **Details:**
 * - flag key: `pieChartGradientColorScheme`
 * - default value: `false`
 */
export const useFlagPieChartGradientColorScheme = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("pieChartGradientColorScheme", false, options).value;
};

/**
 * Enables RBAC for playlists
 *
 * **Details:**
 * - flag key: `playlistsRBAC`
 * - default value: `false`
 */
export const useFlagPlaylistsRBAC = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("playlistsRBAC", false, options).value;
};

/**
 * Show insights for plugins in the plugin details page
 *
 * **Details:**
 * - flag key: `pluginInsights`
 * - default value: `false`
 */
export const useFlagPluginInsights = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("pluginInsights", false, options).value;
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
 * Prefer library panel title over viz panel title.
 *
 * **Details:**
 * - flag key: `preferLibraryPanelTitle`
 * - default value: `false`
 */
export const useFlagPreferLibraryPanelTitle = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("preferLibraryPanelTitle", false, options).value;
};

/**
 * Enables possibility to preserve dashboard variables and time range when navigating between dashboards
 *
 * **Details:**
 * - flag key: `preserveDashboardStateWhenNavigating`
 * - default value: `false`
 */
export const useFlagPreserveDashboardStateWhenNavigating = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("preserveDashboardStateWhenNavigating", false, options).value;
};

/**
 * Enable export functionality for provisioned resources
 *
 * **Details:**
 * - flag key: `provisioningExport`
 * - default value: `false`
 */
export const useFlagProvisioningExport = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("provisioningExport", false, options).value;
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
 * Enables public dashboard sharing to be restricted to only allowed emails
 *
 * **Details:**
 * - flag key: `publicDashboardsEmailSharing`
 * - default value: `false`
 */
export const useFlagPublicDashboardsEmailSharing = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("publicDashboardsEmailSharing", false, options).value;
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
 * Register /apis/query.grafana.app/ -- will eventually replace /api/ds/query
 *
 * **Details:**
 * - flag key: `queryService`
 * - default value: `false`
 */
export const useFlagQueryService = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("queryService", false, options).value;
};

/**
 * Adds datasource connections to the query service
 *
 * **Details:**
 * - flag key: `queryServiceWithConnections`
 * - default value: `false`
 */
export const useFlagQueryServiceWithConnections = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("queryServiceWithConnections", false, options).value;
};

/**
 * Enables the Query with Assistant button in the query editor
 *
 * **Details:**
 * - flag key: `queryWithAssistant`
 * - default value: `false`
 */
export const useFlagQueryWithAssistant = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("queryWithAssistant", false, options).value;
};

/**
 * Enables AI-assisted coauthoring in code query editors
 *
 * **Details:**
 * - flag key: `queryeditor.coauthoringUi`
 * - default value: `false`
 */
export const useFlagQueryeditorCoauthoringUi = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("queryeditor.coauthoringUi", false, options).value;
};

/**
 * Renders the raw Prometheus query results table using TableNG instead of the legacy Table
 *
 * **Details:**
 * - flag key: `rawPrometheus.tableNg`
 * - default value: `false`
 */
export const useFlagRawPrometheusTableNg = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("rawPrometheus.tableNg", false, options).value;
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
 * Enables reload of dashboards on scopes, time range and variables changes
 *
 * **Details:**
 * - flag key: `reloadDashboardsOnParamsChange`
 * - default value: `false`
 */
export const useFlagReloadDashboardsOnParamsChange = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("reloadDashboardsOnParamsChange", false, options).value;
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
 * Removes the URL option for report and email logo fields in reporting settings, leaving image upload as the only option
 *
 * **Details:**
 * - flag key: `reporting.removeLogoUrlField`
 * - default value: `false`
 */
export const useFlagReportingRemoveLogoUrlField = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("reporting.removeLogoUrlField", false, options).value;
};

/**
 * Enables the configurable footer settings for PDF reports
 *
 * **Details:**
 * - flag key: `reportingFooterSettings`
 * - default value: `false`
 */
export const useFlagReportingFooterSettings = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("reportingFooterSettings", false, options).value;
};

/**
 * Enables configuration of PDF report settings
 *
 * **Details:**
 * - flag key: `reportingHeaderSettings`
 * - default value: `false`
 */
export const useFlagReportingHeaderSettings = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("reportingHeaderSettings", false, options).value;
};

/**
 * Enables the new role picker drawer design
 *
 * **Details:**
 * - flag key: `rolePickerDrawer`
 * - default value: `false`
 */
export const useFlagRolePickerDrawer = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("rolePickerDrawer", false, options).value;
};

/**
 * Enables Saved queries (query library) RBAC permissions
 *
 * **Details:**
 * - flag key: `savedQueriesRBAC`
 * - default value: `true`
 */
export const useFlagSavedQueriesRBAC = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("savedQueriesRBAC", true, options).value;
};

/**
 * Enables the use of scope filters in Grafana
 *
 * **Details:**
 * - flag key: `scopeFilters`
 * - default value: `false`
 */
export const useFlagScopeFilters = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("scopeFilters", false, options).value;
};

/**
 * Enable scope search to include all levels of the scope node tree
 *
 * **Details:**
 * - flag key: `scopeSearchAllLevels`
 * - default value: `false`
 */
export const useFlagScopeSearchAllLevels = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("scopeSearchAllLevels", false, options).value;
};

/**
 * Enable the secrets management app platform UI
 *
 * **Details:**
 * - flag key: `secretsManagementAppPlatformUI`
 * - default value: `false`
 */
export const useFlagSecretsManagementAppPlatformUI = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("secretsManagementAppPlatformUI", false, options).value;
};

/**
 * Enables the ASAP smoothing transformation for time series data
 *
 * **Details:**
 * - flag key: `smoothingTransformation`
 * - default value: `false`
 */
export const useFlagSmoothingTransformation = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("smoothingTransformation", false, options).value;
};

/**
 * Routes snapshot requests from /api to the /apis endpoint
 *
 * **Details:**
 * - flag key: `snapshots.kubernetesSnapshots`
 * - default value: `false`
 */
export const useFlagSnapshotsKubernetesSnapshots = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("snapshots.kubernetesSnapshots", false, options).value;
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
 * Displays datasource provisioned and community dashboards in dashboard empty page, only when coming from datasource configuration page
 *
 * **Details:**
 * - flag key: `suggestedDashboards`
 * - default value: `false`
 */
export const useFlagSuggestedDashboards = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("suggestedDashboards", false, options).value;
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
 * Sizes TableNG auto-width columns to fit their content instead of distributing evenly
 *
 * **Details:**
 * - flag key: `table.autoColumnWidths`
 * - default value: `false`
 */
export const useFlagTableAutoColumnWidths = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("table.autoColumnWidths", false, options).value;
};

/**
 * Enables TableNG in the panel inspector's Data tab, replacing the legacy Table (TableRT)
 *
 * **Details:**
 * - flag key: `table.inspectDataTableNG`
 * - default value: `false`
 */
export const useFlagTableInspectDataTableNG = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("table.inspectDataTableNG", false, options).value;
};

/**
 * Enables configuring a fixed page size for paginated tables instead of deriving it from the panel height
 *
 * **Details:**
 * - flag key: `table.paginationPageSize`
 * - default value: `false`
 */
export const useFlagTablePaginationPageSize = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("table.paginationPageSize", false, options).value;
};

/**
 * Enables the refreshed table experience: reworked column headers and ad hoc column interactions
 *
 * **Details:**
 * - flag key: `table.refresh`
 * - default value: `false`
 */
export const useFlagTableRefresh = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("table.refresh", false, options).value;
};

/**
 * Catch-all toggle for new features developed as part of the Q3 table panel refresh
 *
 * **Details:**
 * - flag key: `table.refreshNewFeatures`
 * - default value: `false`
 */
export const useFlagTableRefreshNewFeatures = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("table.refreshNewFeatures", false, options).value;
};

/**
 * Enables shared crosshair in table panel
 *
 * **Details:**
 * - flag key: `tableSharedCrosshair`
 * - default value: `false`
 */
export const useFlagTableSharedCrosshair = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("tableSharedCrosshair", false, options).value;
};

/**
 * Enables the new features in text panel
 *
 * **Details:**
 * - flag key: `text.newFeatures`
 * - default value: `false`
 */
export const useFlagTextNewFeatures = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("text.newFeatures", false, options).value;
};

/**
 * Enables time comparison option in supported panels
 *
 * **Details:**
 * - flag key: `timeComparison`
 * - default value: `true`
 */
export const useFlagTimeComparison = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("timeComparison", true, options).value;
};

/**
 * Show transformation quick-start cards in empty transformations state
 *
 * **Details:**
 * - flag key: `transformationsEmptyPlaceholder`
 * - default value: `false`
 */
export const useFlagTransformationsEmptyPlaceholder = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("transformationsEmptyPlaceholder", false, options).value;
};

/**
 * Enables unified navbars
 *
 * **Details:**
 * - flag key: `unifiedNavbars`
 * - default value: `false`
 */
export const useFlagUnifiedNavbars = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("unifiedNavbars", false, options).value;
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

/**
 * Use the scopes navigation endpoint instead of the dashboardbindings endpoint
 *
 * **Details:**
 * - flag key: `useScopesNavigationEndpoint`
 * - default value: `false`
 */
export const useFlagUseScopesNavigationEndpoint = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("useScopesNavigationEndpoint", false, options).value;
};

/**
 * Allows authenticated API calls in actions
 *
 * **Details:**
 * - flag key: `vizActionsAuth`
 * - default value: `false`
 */
export const useFlagVizActionsAuth = (options?: ReactFlagEvaluationOptions): boolean => {
  return useFlag("vizActionsAuth", false, options).value;
};

