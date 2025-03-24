import { ReservedAnnotation } from '@grafana/alerting/src/types/common';

export const RULER_NOT_SUPPORTED_MSG = 'ruler not supported';

export const RULE_LIST_POLL_INTERVAL_MS = 30000;

export const ALERTMANAGER_NAME_QUERY_KEY = 'alertmanager';
export const ALERTMANAGER_NAME_LOCAL_STORAGE_KEY = 'alerting-alertmanager';
export const SILENCES_POLL_INTERVAL_MS = 20000;
export const NOTIFICATIONS_POLL_INTERVAL_MS = 20000;
export const CONTACT_POINTS_STATE_INTERVAL_MS = 20000;

export const TIMESERIES = 'timeseries';
export const TABLE = 'table';
export const STAT = 'stat';

export { ReservedAnnotation as Annotation } from '@grafana/alerting/src/types/common';

export const annotationLabels: Record<ReservedAnnotation, string> = {
  [ReservedAnnotation.description]: 'Description',
  [ReservedAnnotation.summary]: 'Summary',
  [ReservedAnnotation.runbookURL]: 'Runbook URL',
  [ReservedAnnotation.dashboardUID]: 'Dashboard UID',
  [ReservedAnnotation.panelID]: 'Panel ID',
  [ReservedAnnotation.alertId]: 'Alert ID',
};

export const annotationDescriptions: Record<ReservedAnnotation, string> = {
  [ReservedAnnotation.description]: 'Description of what the alert rule does.',
  [ReservedAnnotation.summary]: 'Short summary of what happened and why.',
  [ReservedAnnotation.runbookURL]: 'Webpage where you keep your runbook for the alert.',
  [ReservedAnnotation.dashboardUID]: '',
  [ReservedAnnotation.panelID]: '',
  [ReservedAnnotation.alertId]: '',
};

export const defaultAnnotations = [
  { key: ReservedAnnotation.summary, value: '' },
  { key: ReservedAnnotation.description, value: '' },
  { key: ReservedAnnotation.runbookURL, value: '' },
];

/** Special matcher name used to identify alert rules by UID */
export const MATCHER_ALERT_RULE_UID = '__alert_rule_uid__';
