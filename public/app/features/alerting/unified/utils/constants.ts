import type { ReservedAnnotation } from '@grafana/alerting/types';

export enum Annotation {
  description = 'description',
  summary = 'summary',
  runbookURL = 'runbook_url',
  alertId = '__alertId__',
  dashboardUID = '__dashboardUid__',
  panelID = '__panelId__',
}

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

export const annotationLabels: Record<ReservedAnnotation, string> = {
  description: 'Description',
  summary: 'Summary',
  runbook_url: 'Runbook URL',
  __dashboardUid__: 'Dashboard UID',
  __panelId__: 'Panel ID',
  __alertId__: 'Alert ID',
};

export const annotationDescriptions: Record<ReservedAnnotation, string> = {
  description: 'Description of what the alert rule does.',
  summary: 'Short summary of what happened and why.',
  runbook_url: 'Webpage where you keep your runbook for the alert.',
  __dashboardUid__: '',
  __panelId__: '',
  __alertId__: '',
};

export const defaultAnnotations: Array<{ key: ReservedAnnotation; value: string }> = [
  { key: 'summary', value: '' },
  { key: 'description', value: '' },
  { key: 'runbook_url', value: '' },
];

/** Special matcher name used to identify alert rules by UID */
export const MATCHER_ALERT_RULE_UID = '__alert_rule_uid__';
