export type Annotations = Record<string | ReservedAnnotation, string>;
export type Labels = Record<string, string>;

/**
 * These annotations have special meaning / reserved usage in Grafana.
 */
export enum ReservedAnnotation {
  description = 'description',
  summary = 'summary',
  runbookURL = 'runbook_url',
  alertId = '__alertId__',
  dashboardUID = '__dashboardUid__',
  panelID = '__panelId__',
}
