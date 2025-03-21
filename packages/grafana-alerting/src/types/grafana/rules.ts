import { Annotations, Labels } from '../common';
import { PrometheusRuleGroup } from '../prometheus/rules';

interface GenericPrometheusRule {
  health: 'ok' | 'unknown' | 'error';
  name: string;
  query: string;
  evaluationTime?: number;
  lastEvaluation?: string;
  lastError?: string;
  labels?: Labels;
}

export interface PrometheusAlertingRule extends GenericPrometheusRule {
  type: 'alerting';
  state: 'firing' | 'pending' | 'inactive';
  alerts?: Array<{
    labels: Labels;
    annotations: Annotations;
    state: 'Normal' | 'Alerting' | 'Pending' | 'NoData' | 'Error';
    activeAt: string;
    value: string;
  }>;
  annotations?: Annotations;
  duration?: number; // pending period (in seconds)
}

export interface PrometheusRecordingRule extends GenericPrometheusRule {
  type: 'recording';
  state: 'inactive'; // recording rules are always inactive
}

export type PrometheusRule = PrometheusAlertingRule | PrometheusRecordingRule;

export interface GrafanaPrometheusRuleGroup extends Omit<PrometheusRuleGroup, 'limit'> {
  folderUid: string;
  totals: TotalsByStateAndHealth;
}

/* Shows how many rules are in each state or health. Keep in mind a rule can have both a state and health */
export interface TotalsByStateAndHealth {
  error?: number;
  inactive?: number;
}
