import { GrafanaQuery, GrafanaAlertState } from 'app/types/unified-alerting-dto';

export enum RuleFormType {
  threshold = 'threshold',
  system = 'system',
}

export interface RuleFormValues {
  // common
  name?: string;
  type?: RuleFormType;
  dataSourceName: string | null;

  labels: Array<{ key: string; value: string }>;
  annotations: Array<{ key: string; value: string }>;

  // threshold alerts
  queries: GrafanaQuery[];
  condition: string;
  no_data_state: GrafanaAlertState;
  exec_err_state: GrafanaAlertState;
  folder?: { title: string; id: number };
  evaluateEvery: string;
  evaluateFor: string;

  // system alerts
  location?: { namespace: string; group: string };
  forTime: number;
  forTimeUnit: string;
  expression: string;
}
