import { GrafanaQuery, GrafanaAlertStateDecision } from 'app/types/unified-alerting-dto';

export enum RuleFormType {
  grafana = 'grafana',
  cloud = 'cloud',
}

export interface RuleFormValues {
  // common
  name: string;
  type?: RuleFormType;
  dataSourceName: string | null;

  labels: Array<{ key: string; value: string }>;
  annotations: Array<{ key: string; value: string }>;

  // grafana rules
  queries: GrafanaQuery[];
  condition: string | null; // refId of the query that gets alerted on
  noDataState: GrafanaAlertStateDecision;
  execErrState: GrafanaAlertStateDecision;
  folder: { title: string; id: number } | null;
  evaluateEvery: string;
  evaluateFor: string;

  // cortex / loki rules
  namespace: string;
  group: string;
  forTime: number;
  forTimeUnit: string;
  expression: string;
}
