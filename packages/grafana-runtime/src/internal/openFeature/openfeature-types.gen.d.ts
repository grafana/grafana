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
    | "lokiShardSplitting"
    | "faroSessionReplay"
    | "queryHistory.localOnly"
    | "queryHistory.recentQueriesUI"
    | "provisioningFolderMetadata"
    | "provisioning.readmes"
    | "provisioning.gitConventions"
    | "grafana.kubernetesAnnotationsClient"
    | "grafana.newPanelQueryErrorsUI"
    | "useKubernetesShortURLsAPI"
    | "stateTimeline.nameAboveBars"
    | "sqlExpressionsCodeMirror"
    | "newSavedQueriesExperience"
    | "grafana.customDashboardTemplates"
    | "dashboardTemplatesAssistantButton"
    | "suggestedDashboardsAssistantButton"
    | "recentlyViewedDashboards"
    | "experimentRecentlyViewedDashboards"
    | "otelLogsFormatting"
    | "grafana.starredFolders"
    | "plugins.useMTPlugins"
    | "dashboardSectionVariables"
    | "globalDashboardVariables"
    | "queryEditorNext"
    | "managedPluginsV2"
    | "analyticsFramework"
    | "grafana.scenesFlickeringFix"
    | "grafana.viewPanelPane"
    | "datasourcesApiServerEnableHealthEndpointFrontend"
    | "flameGraphWithCallTree"
    | "inlineLogDetailsNoScrolls"
    | "logsTablePanelNG"
    | "plugins.useMTPluginSettings"
    | "splashScreen"
    | "grafana.newPreferencesPage"
    | "datasources.config.ui.useNewDatasourceCRUDAPIs"
    | "datasources.apiserver.useNewAPIsForDatasourceResources"
    | "reporting.anyPageReporting"
    | "assistant.frontend.tools.dashboardTemplates"
    | "grafana.unifiedHomepage"
    | "alerting.syncExternalAlertmanager"
    | "grafana.enableScopesFirstMode"
    | "grafana.logLevelInference"
    | "plugins.initDataSourcesAsync"
    | "grafana.panelEditNextFeedbackEvent"
    | "grafana.visualDesignRefresh"
    | "table.protoRowParser"
    | "dataviz.experimentalColorSchemes"
    | "grafana.customizableMegaMenu"
    | "grafana.onDemandDiagnostics";
  export type NumberFlagKey = never;
  export type StringFlagKey = never;
  export type ObjectFlagKey = never;
}
