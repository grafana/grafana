/**
 * These annotations have special meaning / reserved usage in Grafana.
 */
export type ReservedAnnotation =
  | 'description'
  | 'summary'
  | 'runbook_url'
  | '__alertId__'
  | '__dashboardUid__'
  | '__panelId__';
