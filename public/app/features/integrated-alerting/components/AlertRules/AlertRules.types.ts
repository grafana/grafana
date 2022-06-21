import {} from '../AlertRuleTemplate/AlertRuleTemplate.types';

export enum AlertRuleFilterType {
  EQUAL = '=',
}

export interface AlertRulesListResponseTemplateParam {
  name: string;
  unit?: string;
  value: any;
}

export interface AlertRulesListResponseTemplate {
  params: AlertRulesListResponseTemplateParam[];
}

export enum AlertRuleSeverity {
  SEVERITY_CRITICAL = 'Critical',
  SEVERITY_ERROR = 'High',
  SEVERITY_WARNING = 'Warning',
  SEVERITY_NOTICE = 'Notice',
}

export interface AlertRule {
  createdAt: string;
  disabled: boolean;
  duration: string;
  filters: string[];
  lastNotified: string;
  severity: AlertRuleSeverity[keyof AlertRuleSeverity];
  summary: string;
  threshold: string;
}

export interface AlertRulesListResponseFilter {
  key: string;
  type: keyof typeof AlertRuleFilterType;
  value: string;
}

export enum AlertRuleParamType {
  PARAM_TYPE_INVALID,
  BOOL = 'bool',
  FLOAT = 'float',
  STRING = 'string',
}

export interface AlertRulesListResponseParam {
  bool?: boolean;
  float?: number;
  name: string;
  string?: string;
  type: keyof typeof AlertRuleParamType;
}

export interface AlertRulesListResponseRule {
  created_at: string;
  disabled: boolean;
  filters: AlertRulesListResponseFilter[];
  for: string; // duration, e.g.: '999s'
  last_notified?: string;
  params?: AlertRulesListResponseParam[];
  severity: keyof typeof AlertRuleSeverity;
  summary: string;
  template: AlertRulesListResponseTemplate;
}

export interface AlertRulesListResponse {
  rules: AlertRulesListResponseRule[];
}
