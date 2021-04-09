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
  condition: string | null; // refId of the query that gets alerted on
  noDataState: GrafanaAlertState;
  execErrState: GrafanaAlertState;
  folder?: { title: string; id: number };
  evaluateEvery: string;
  evaluateFor: string;

  // system alerts
  location?: { namespace: string; group: string };
  forTime: number;
  forTimeUnit: string;
  expression: string;
}
