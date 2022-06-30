import { Severity } from 'app/percona/shared/core';

import { TemplateAnnotation, TemplateParam } from '../AlertRuleTemplate/AlertRuleTemplate.types';

export interface AlertRulesContext {
  getAlertRules: () => void;
  setAddModalVisible: (isVisible: boolean) => void;
  setSelectedAlertRule: (alertRule: AlertRule | null) => void;
}

//New types of filters add here, they will be automatically added everywhere
export enum AlertRuleFilterType {
  EQUAL = '=',
  REGEX = '=~',
}

export interface AlertRule {
  ruleId: string;
  createdAt: string;
  disabled: boolean;
  duration: string;
  filters: string[];
  lastNotified: string;
  severity: Severity[keyof Severity];
  name: string;
  rawValues: AlertRulesListResponseRule;
  params: AlertRulesParsedParam[];
  expr: string;
}

export type AlertRulesParsedParam = TemplateParam & { value: string | boolean | number };

export interface AlertRulesListPayloadFilter {
  key: string;
  type: keyof typeof AlertRuleFilterType;
  value: string;
}

export enum AlertRuleParamType {
  BOOL = 'bool',
  FLOAT = 'float',
  STRING = 'string',
}

export interface AlertRulesListResponseParam {
  name: string;
  type: keyof typeof AlertRuleParamType;
  [AlertRuleParamType.BOOL]?: boolean;
  [AlertRuleParamType.FLOAT]?: number;
  [AlertRuleParamType.STRING]?: string;
}

export interface AlertRulesListResponseChannel {
  channel_id: string;
  summary: string;
}

export interface AlertRulesListResponseRule {
  channels: AlertRulesListResponseChannel[];
  created_at: string;
  disabled: boolean;
  filters: AlertRulesListPayloadFilter[];
  default_for: string;
  for: string; // duration, e.g.: '999s'
  last_notified?: string;
  params_values?: AlertRulesListResponseParam[];
  params_definitions: TemplateParam[];
  severity: keyof typeof Severity;
  default_severity: keyof typeof Severity;
  name: string;
  expr: string;
  expr_template: string;
  rule_id: string;
  annotations?: TemplateAnnotation;
  template_name: string;
  summary: string;
  custom_labels?: AlertRulePayloadCustomLabels;
}

export interface AlertRulesTotals {
  total_items: number;
  total_pages: number;
}

export interface AlertRulesListResponse {
  rules: AlertRulesListResponseRule[];
  totals: AlertRulesTotals;
}

export interface AlertRulePayloadCustomLabels {
  [K: string]: string;
}

type AlertRulesListPayloadParam = AlertRulesListResponseParam;

export interface AlertRuleCreateResponse {
  rule_id: string;
}

export interface AlertRuleCreatePayload {
  channel_ids: string[];
  custom_labels?: AlertRulePayloadCustomLabels;
  disabled: boolean;
  filters: AlertRulesListPayloadFilter[];
  for: string;
  params?: AlertRulesListPayloadParam[];
  severity: keyof typeof Severity;
  name: string;
  template_name: string;
}

export interface AlertRuleCopyPayload extends Omit<AlertRuleCreatePayload, 'template_name'> {
  source_rule_id: string;
}

export interface AlertRuleGetPayload {
  page_params: {
    page_size: number;
    index: number;
  };
}

export interface AlertRuleUpdatePayload extends AlertRuleCreatePayload {
  rule_id: string;
}

export interface AlertRuleTogglePayload {
  disabled: 'DO_NOT_CHANGE' | 'TRUE' | 'FALSE';
  rule_id: string;
}

export interface AlertRuleDeletePayload {
  rule_id: string;
}
