export const RULER_NOT_SUPPORTED_MSG = 'ruler not supported';

export const RULE_LIST_POLL_INTERVAL_MS = 20000;

export const ALERTMANAGER_NAME_QUERY_KEY = 'alertmanager';
export const ALERTMANAGER_NAME_LOCAL_STORAGE_KEY = 'alerting-alertmanager';
export const SILENCES_POLL_INTERVAL_MS = 20000;
export const NOTIFICATIONS_POLL_INTERVAL_MS = 20000;
export const CONTACT_POINTS_STATE_INTERVAL_MS = 20000;

export const TIMESERIES = 'timeseries';
export const TABLE = 'table';
export const STAT = 'stat';

export enum Annotation {
  description = 'description',
  summary = 'summary',
  runbookURL = 'runbook_url',
  alertId = '__alertId__',
  dashboardUID = '__dashboardUid__',
  panelID = '__panelId__',
}

export const annotationLabels: Record<Annotation, string> = {
  [Annotation.description]: 'Description',
  [Annotation.summary]: 'Summary',
  [Annotation.runbookURL]: 'Runbook URL',
  [Annotation.dashboardUID]: 'Dashboard UID',
  [Annotation.panelID]: 'Panel ID',
  [Annotation.alertId]: 'Alert ID',
};

export const annotationDescriptions: Record<Annotation, string> = {
  [Annotation.description]: 'Description of what the alert rule does',
  [Annotation.summary]: 'Short summary of what happened and why',
  [Annotation.runbookURL]: 'Webpage where you keep your runbook for the alert',
  [Annotation.dashboardUID]: '',
  [Annotation.panelID]: '',
  [Annotation.alertId]: '',
};

export const defaultAnnotations = [
  { key: Annotation.summary, value: '' },
  { key: Annotation.description, value: '' },
  { key: Annotation.runbookURL, value: '' },
];
