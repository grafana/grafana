/* Prometheus internal models */

import { DataSourceInstanceSettings } from '@grafana/data';
import { PromAlertingRuleState, PromRuleType } from './unified-alerting-dto';

export type Alert = {
  activeAt: string;
  annotations: { [key: string]: string };
  labels: { [key: string]: string };
  state: PromAlertingRuleState;
  value: string;
};

interface RuleBase {
  health: string;
  name: string;
  query: string;
  lastEvaluation?: string;
  evaluationTime?: number;
  lastError?: string;
}

export interface AlertingRule extends RuleBase {
  alerts: Alert[];
  labels: {
    [key: string]: string;
  };
  annotations: {
    [key: string]: string;
  };
  state: PromAlertingRuleState;
  type: PromRuleType.Alerting;
}

export interface RecordingRule extends RuleBase {
  type: PromRuleType.Recording;

  labels?: {
    [key: string]: string;
  };
}

export type Rule = AlertingRule | RecordingRule;

export type BaseRuleGroup = { name: string };

export interface RuleGroup {
  name: string;
  interval: number;
  rules: Rule[];
}

export interface RuleNamespace {
  datasourceName: string;
  name: string;
  groups: RuleGroup[];
}

export interface RulesSourceResult {
  datasourceName: string;
  error?: unknown;
  namespaces?: RuleNamespace[];
}

export type RulesSource = DataSourceInstanceSettings | 'grafana';
