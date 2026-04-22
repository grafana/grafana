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
    | "provisioningFolderMetadata"
    | "dashboardTemplatesAssistantButton"
    | "suggestedDashboardsAssistantButton"
    | "newLogsPanel"
    | "recentlyViewedDashboards"
    | "createdByMeSearchFilter"
    | "otelLogsFormatting"
    | "newLogContext"
    | "dashboardSectionVariables"
    | "queryEditorNext"
    | "analyticsFramework"
    | "flameGraphWithCallTree"
    | "inlineLogDetailsNoScrolls"
    | "splashScreen"
    | "grafana.newPreferencesPage"
    | "reporting.anyPageReporting";
  export type NumberFlagKey = never;
  export type StringFlagKey = never;
  export type ObjectFlagKey = never;
}
