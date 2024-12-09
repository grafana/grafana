import { AlertQuery, GrafanaAlertStateDecision } from 'app/types/unified-alerting-dto';

export enum RuleFormType {
  grafana = 'grafana-alerting',
  grafanaRecording = 'grafana-recording',
  cloudAlerting = 'cloud-alerting',
  cloudRecording = 'cloud-recording',
}

export interface ContactPoint {
  selectedContactPoint: string;
  overrideGrouping: boolean;
  groupBy: string[];
  overrideTimings: boolean;
  groupWaitValue: string;
  groupIntervalValue: string;
  repeatIntervalValue: string;
  muteTimeIntervals: string[];
}

// key: name of alert manager, value ContactPoint
export interface AlertManagerManualRouting {
  [key: string]: ContactPoint;
}

export interface SimplifiedEditor {
  simplifiedQueryEditor: boolean;
  simplifiedNotificationEditor: boolean;
}

export type KVObject = { key: string; value: string };
export type KBObjectArray = KVObject[];

export interface RuleFormValues {
  // common
  name: string;
  type?: RuleFormType;
  dataSourceName: string | null;
  group: string;

  labels: Array<{ key: string; value: string }>;
  annotations: Array<{ key: string; value: string }>;

  // grafana rules
  queries: AlertQuery[];
  condition: string | null; // refId of the query that gets alerted on
  noDataState: GrafanaAlertStateDecision;
  execErrState: GrafanaAlertStateDecision;
  folder: Folder | undefined;
  evaluateEvery: string;
  evaluateFor: string;
  isPaused?: boolean;
  manualRouting: boolean; // if true contactPoints are used. This field will not be used for saving the rule
  contactPoints?: AlertManagerManualRouting;
  editorSettings?: SimplifiedEditor;
  metric?: string;

  // cortex / loki rules
  namespace: string;
  forTime: number;
  forTimeUnit: string;
  keepFiringForTime?: number;
  keepFiringForTimeUnit?: string;
  expression: string;
}

export type Folder = { title: string; uid: string };
