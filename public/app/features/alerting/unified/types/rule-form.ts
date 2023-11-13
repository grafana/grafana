import { Receiver } from 'app/plugins/datasource/alertmanager/types';
import { AlertQuery, GrafanaAlertStateDecision } from 'app/types/unified-alerting-dto';

import { Folder } from '../components/rule-editor/RuleFolderPicker';
import { AlertManagerMetaData } from '../components/rule-editor/notificaton-preview/useGetAlertManagersSourceNamesAndImage';

export enum RuleFormType {
  grafana = 'grafana',
  cloudAlerting = 'cloud-alerting',
  cloudRecording = 'cloud-recording',
}
export interface AMContactPoint {
  alertManager: AlertManagerMetaData;
  selectedContactPoint?: Receiver;
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
  contactPoints?: AMContactPoint[];

  // cortex / loki rules
  namespace: string;
  forTime: number;
  forTimeUnit: string;
  keepFiringForTime?: number;
  keepFiringForTimeUnit?: string;
  expression: string;
}
