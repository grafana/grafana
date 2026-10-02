/**
 * NOTE: This file was auto generated.  DO NOT EDIT DIRECTLY!
 * To change feature flags, edit:
 *  pkg/services/featuremgmt/registry.go
 * Then run:
 *  make gen-feature-toggles
 */

import "@openfeature/core";

declare module "@openfeature/core" {
  export type BooleanFlagKey =
    // alerting.*
    | "alerting.dataSourceManagedRouteProxy"
    | "alerting.manualAssistantInvestigation"
    | "alerting.ruleQuality"
    | "alerting.syncExternalAlertmanager"
    // assistant.*
    | "assistant.dashboardPlanning"
    | "assistant.frontend.tools.dashboardTemplates"
    | "assistant.fullscreenWorkspace"
    // dashboard.*
    | "dashboard.notebooks"
    | "dashboard.recentlyDeletedViaTrash"
    | "dashboard.vectorSearch"
    // datasources.*
    | "datasources.apiserver.useNewAPIsForDatasourceResources"
    | "datasources.azureMonitorBatchAPI"
    | "datasources.config.ui.useNewDatasourceCRUDAPIs"
    | "datasources.gatewayGuardrails"
    | "datasources.querier.newName"
    | "datasources.queryGateway"
    // dataviz.*
    | "dataviz.experimentalColorSchemes"
    // flameGraph.*
    | "flameGraph.tableNg"
    // grafana.*
    | "grafana.cmdkHybridSearch"
    | "grafana.customDashboardTemplates"
    | "grafana.customizableMegaMenu"
    | "grafana.dashboardAutoGridDefault"
    | "grafana.dashboardGlobalVariables"
    | "grafana.dashboardSettingsRedesign"
    | "grafana.dashboardsAutoHeightPanels"
    | "grafana.dynamicTraceToLogs"
    | "grafana.enableScopesFirstMode"
    | "grafana.exploreMetricsSidebar"
    | "grafana.filterablePanels"
    | "grafana.growthHomepage"
    | "grafana.kubernetesAnnotationsClient"
    | "grafana.logDetailsDisplayedFieldControls"
    | "grafana.logLevelInference"
    | "grafana.multiTenantNavTree"
    | "grafana.multiTenantUserPermissions"
    | "grafana.newPanelQueryErrorsUI"
    | "grafana.newTextPanel"
    | "grafana.onDemandDiagnostics"
    | "grafana.panelEditNextFeedbackEvent"
    | "grafana.panelPluginTransformations"
    | "grafana.pluginExtensionReactElementProps"
    | "grafana.pluginPathNesting"
    | "grafana.queryVarEditorRedesign"
    | "grafana.savedQueriesPage"
    | "grafana.scenesFlickeringFix"
    | "grafana.secretsReferenceValueUI"
    | "grafana.starredFolders"
    | "grafana.thresholdsInterpolation"
    | "grafana.unifiedDataSourcePicker"
    | "grafana.useDefaultScopesEndpoint"
    | "grafana.vectorSearchCmdk"
    | "grafana.viewPanelPane"
    | "grafana.visualDesignRefresh"
    // libraryelements.*
    | "libraryelements.kubernetesLibraryPanels"
    // paneledit.*
    | "paneledit.buttonLabels"
    // plugins.*
    | "plugins.initDataSourcesAsync"
    | "plugins.useMTPluginSettings"
    | "plugins.useMTPlugins"
    // provisioning.*
    | "provisioning.gitConventions"
    | "provisioning.readmes"
    | "provisioning.userAttribution"
    // queryHistory.*
    | "queryHistory.localOnly"
    | "queryHistory.recentQueriesUI"
    // queryeditor.*
    | "queryeditor.coauthoringUi"
    // rawPrometheus.*
    | "rawPrometheus.tableNg"
    // reporting.*
    | "reporting.anyPageReporting"
    // snapshots.*
    | "snapshots.kubernetesSnapshots"
    // stateTimeline.*
    | "stateTimeline.nameAboveBars"
    // table.*
    | "table.autoColumnWidths"
    | "table.inspectDataTableNG"
    | "table.paginationPageSize"
    | "table.refresh"
    | "table.refreshNewFeatures"
    // text.*
    | "text.newFeatures"
    // legacy toggles
    | "alertRuleRestore"
    | "alertingNavigationV2"
    | "alertingRuleRecoverDeleted"
    | "alertingTriage"
    | "analyticsFramework"
    | "awsAssumeRolePerDatasourceExternalId"
    | "canvasPanelNesting"
    | "canvasPanelPanZoom"
    | "dashboardNewLayouts"
    | "dashboardTemplatesAssistantButton"
    | "dashboardUndoRedo"
    | "datasourcesApiServerEnableHealthEndpointFrontend"
    | "enableColorblindSafePanelOptions"
    | "enableExtensionsAdminPage"
    | "experimentRecentlyViewedDashboards"
    | "faroSessionReplay"
    | "feedbackButton"
    | "foldersAppPlatformAPI"
    | "globalDashboardVariables"
    | "inlineLogDetailsNoScrolls"
    | "kubernetesTeamsApi"
    | "logsTablePanelNG"
    | "lokiShardSplitting"
    | "managedPluginsV2"
    | "newSavedQueriesExperience"
    | "otelLogsFormatting"
    | "perPanelNonApplicableDrilldowns"
    | "pieChartGradientColorScheme"
    | "playlistsRBAC"
    | "provisioningExport"
    | "provisioningFolderMetadata"
    | "queryEditorNext"
    | "queryLibrary"
    | "recentlyViewedDashboards"
    | "reportingFooterSettings"
    | "reportingHeaderSettings"
    | "savedQueriesRBAC"
    | "secretsManagementAppPlatformUI"
    | "splashScreen"
    | "sqlExpressionsCodeMirror"
    | "sqlExpressionsColumnAutoComplete"
    | "suggestedDashboardsAssistantButton"
    | "tableSharedCrosshair"
    | "useKubernetesShortURLsAPI"
    | "vizActionsAuth";
  export type NumberFlagKey = never;
  export type StringFlagKey = never;
  export type ObjectFlagKey =
    // grafana.*
    | "grafana.mtFallback";
}
