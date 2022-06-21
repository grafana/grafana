export interface AlertRulesContext {
  getAlertRules: () => void;
}

export enum AlertRuleFilterType {
  EQUAL = '=',
}

export enum AlertRulesListPayloadTemplateParamUnits {
  PARAM_UNIT_INVALID = 'Invalid unit',
  PERCENTAGE = '%',
}

export interface AlertRulesListPayloadTemplateParam {
  [AlertRuleParamType.BOOL]?: {
    default: boolean;
  };
  [AlertRuleParamType.FLOAT]?: {
    default: number;
  };
  [AlertRuleParamType.STRING]?: {
    default: string;
  };
  name: string;
  unit?: keyof typeof AlertRulesListPayloadTemplateParamUnits;
  type: keyof typeof AlertRuleParamType;
}

export interface AlertRulesListPayloadTemplate {
  params: AlertRulesListPayloadTemplateParam[];
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

export interface AlertRulesListPayloadFilter {
  key: string;
  type: keyof typeof AlertRuleFilterType;
  value: string;
}

export enum AlertRuleParamType {
  PARAM_TYPE_INVALID = 'Invalid type',
  BOOL = 'bool',
  FLOAT = 'float',
  STRING = 'string',
}

export interface AlertRulesListResponseParam {
  [AlertRuleParamType.BOOL]?: boolean;
  [AlertRuleParamType.FLOAT]?: number;
  name: string;
  [AlertRuleParamType.STRING]?: string;
  type: keyof typeof AlertRuleParamType;
}

export interface AlertRulesListResponseRule {
  created_at: string;
  disabled: boolean;
  filters: AlertRulesListPayloadFilter[];
  for: string; // duration, e.g.: '999s'
  last_notified?: string;
  params?: AlertRulesListResponseParam[];
  severity: keyof typeof AlertRuleSeverity;
  summary: string;
  template: AlertRulesListPayloadTemplate;
}

export interface AlertRulesListResponse {
  rules: AlertRulesListResponseRule[];
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
  custom_labels: AlertRulePayloadCustomLabels;
  disabled: boolean;
  filters: AlertRulesListPayloadFilter[];
  for: string;
  params?: AlertRulesListPayloadParam[];
  severity: keyof typeof AlertRuleSeverity;
  summary: string;
  template_name: string;
}
