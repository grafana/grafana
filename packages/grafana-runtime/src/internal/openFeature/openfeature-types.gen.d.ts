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
    | "provisioningFolderMetadata"
    | "stateTimeline.nameAboveBars"
    | "newSavedQueriesExperience"
    | "dashboardTemplatesAssistantButton"
    | "suggestedDashboardsAssistantButton"
    | "newLogsPanel"
    | "recentlyViewedDashboards"
    | "experimentRecentlyViewedDashboards"
    | "createdByMeSearchFilter"
    | "otelLogsFormatting"
    | "newLogContext"
    | "useMTPlugins"
    | "dashboardSectionVariables"
    | "globalDashboardVariables"
    | "queryEditorNext"
    | "managedPluginsV2"
    | "analyticsFramework"
    | "datasourcesApiServerEnableHealthEndpointFrontend"
    | "flameGraphWithCallTree"
    | "inlineLogDetailsNoScrolls"
    | "splashScreen"
    | "grafana.newPreferencesPage"
    | "datasources.config.ui.useNewDatasourceCRUDAPIs"
    | "datasources.apiserver.useNewAPIsForDatasourceResources"
    | "reporting.anyPageReporting"
    | "assistant.frontend.tools.dashboardTemplates";
  export type NumberFlagKey = never;
  export type StringFlagKey = never;
  export type ObjectFlagKey = never;
}
