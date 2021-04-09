import { GrafanaQuery, GrafanaAlertState } from 'app/types/unified-alerting-dto';

export enum RuleFormType {
  threshold = 'threshold',
  system = 'system',
}

export interface RuleFormValues {
  name?: string;
  type?: RuleFormType;
  dataSourceName: string | null;
  location?: { namespace: string; group: string };
  folder?: { title: string; id: number };
  forTime: number;
  forTimeUnit: string;
  expression: string;
  queries: GrafanaQuery[];
  condition: string;
  no_data_state: GrafanaAlertState;
  exec_err_state: GrafanaAlertState;
  labels: Array<{ key: string; value: string }>;
  annotations: Array<{ key: string; value: string }>;
}
