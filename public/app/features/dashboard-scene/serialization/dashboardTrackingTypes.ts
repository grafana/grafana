/**
 * Types for dashboard tracking/analytics.
 * These are extracted to a separate file to avoid circular dependencies
 * when importing in interactions.ts
 */

export interface DashboardTrackingInfo {
  uid?: string;
  title?: string;
  schemaVersion: number;
  panels_count: number;
  rowCount?: number;
  settings_nowdelay?: number;
  settings_livenow?: boolean;
}

export interface DynamicDashboardsTrackingInformation {
  panelCount: number;
  rowCount: number;
  tabCount: number;
  templateVariableCount: number;
  maxNestingLevel: number;
  conditionalRenderRulesCount: number;
  autoLayoutCount: number;
  customGridLayoutCount: number;
  rowsLayoutCount: number;
  tabsLayoutCount: number;
  dashStructure: string;
  panelsByDatasourceType: Record<string, number>;
}
