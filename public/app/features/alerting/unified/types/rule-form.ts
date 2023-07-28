import { AlertQuery, GrafanaAlertStateDecision } from 'app/types/unified-alerting-dto';

import { Folder } from '../components/rule-editor/RuleFolderPicker';

export enum RuleFormType {
  grafana = 'grafana',
  cloudAlerting = 'cloud-alerting',
  cloudRecording = 'cloud-recording',
}

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
  folder: Folder | null;
  evaluateEvery: string;
  evaluateFor: string;
  isPaused?: boolean;

  // cortex / loki rules
  namespace: string;
  forTime: number;
  forTimeUnit: string;
  expression: string;
}
