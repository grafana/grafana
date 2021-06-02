import { TemplateParam } from '../AlertRuleTemplate/AlertRuleTemplate.types';

export interface AlertRulesContext {
  getAlertRules: () => void;
  setAddModalVisible: (isVisible: boolean) => void;
  setSelectedAlertRule: (alertRule: AlertRule | null) => void;
}

export enum AlertRuleFilterType {
  EQUAL = '=',
}

export enum AlertRulesListPayloadTemplateParamUnits {
  PARAM_UNIT_INVALID = 'Invalid unit',
  PERCENTAGE = '%',
}

export interface AlertRulesListPayloadTemplate {
  name: string;
  summary: string;
  params: TemplateParam[];
  yaml?: string;
}

export enum AlertRuleSeverity {
  SEVERITY_CRITICAL = 'Critical',
  SEVERITY_ERROR = 'High',
  SEVERITY_WARNING = 'Warning',
  SEVERITY_NOTICE = 'Notice',
}

export interface AlertRule {
  ruleId: string;
  createdAt: string;
  disabled: boolean;
  duration: string;
  filters: string[];
  lastNotified: string;
  severity: AlertRuleSeverity[keyof AlertRuleSeverity];
  summary: string;
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
  for: string; // duration, e.g.: '999s'
  last_notified?: string;
  params?: AlertRulesListResponseParam[];
  severity: keyof typeof AlertRuleSeverity;
  summary: string;
  template: AlertRulesListPayloadTemplate;
  expr: string;
  rule_id: string;
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
  severity: keyof typeof AlertRuleSeverity;
  summary: string;
  template_name: string;
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
