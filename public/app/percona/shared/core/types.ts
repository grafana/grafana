export enum Databases {
  postgresql = 'postgresql',
  mongodb = 'mongodb',
  mysql = 'mysql',
  mariadb = 'mariadb',
  proxysql = 'proxysql',
  haproxy = 'haproxy',
}

export enum ApiErrorCode {
  ERROR_CODE_XTRABACKUP_NOT_INSTALLED = 'ERROR_CODE_XTRABACKUP_NOT_INSTALLED',
  ERROR_CODE_INVALID_XTRABACKUP = 'ERROR_CODE_INVALID_XTRABACKUP',
  ERROR_CODE_INCOMPATIBLE_XTRABACKUP = 'ERROR_CODE_INCOMPATIBLE_XTRABACKUP',
  ERROR_CODE_INCOMPATIBLE_TARGET_MYSQL = 'ERROR_CODE_INCOMPATIBLE_TARGET_MYSQL',
}

interface ApiDetailedError {
  code: ApiErrorCode;
}

export interface ApiError {
  details: ApiDetailedError[];
}

export interface ApiVerboseError {
  message: string;
  link?: string;
}

export interface PaginatedPayload {
  page_totals: {
    total_items: number;
    total_pages: number;
  };
}

export interface ApiParamBody {
  [key: string]: {
    intValues?: number[];
    longValues?: number[];
    stringValues?: string[];
  };
}

export interface ApiParams {
  filter_params: {
    [key: string]: {
      int_values: {
        values: number[];
      };
      long_values: {
        values: number[];
      };
      string_values: {
        values: string[];
      };
    };
  };
}

export interface PaginatedFomattedResponse<T> {
  data: T;
  totals: {
    totalItems: number;
    totalPages: number;
  };
}

export interface PrioritizedLabels {
  primary: string[];
  secondary: string[];
}

export interface ServerInfo {
  serverName: string;
  serverId: string;
  serverTelemetryId: string;
}

export enum Severity {
  SEVERITY_EMERGENCY = 'Emergency',
  SEVERITY_ALERT = 'Alert',
  SEVERITY_CRITICAL = 'Critical',
  SEVERITY_ERROR = 'Error',
  SEVERITY_WARNING = 'Warning',
  SEVERITY_NOTICE = 'Notice',
  SEVERITY_INFO = 'Info',
  SEVERITY_DEBUG = 'Debug',
}

import {
  TemplateAnnotation,
  TemplateParam,
} from 'app/percona/integrated-alerting/components/AlertRuleTemplate/AlertRuleTemplate.types';

export enum AlertRuleParamType {
  BOOL = 'bool',
  FLOAT = 'float',
  STRING = 'string',
}

export enum AlertRuleFilterType {
  MATCH = 'MATCH',
  MISMATCH = 'MISMATCH',
}

export type AlertRulesParsedParam = TemplateParam & { value: string | boolean | number };

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
  custom_labels?: { [K: string]: string };
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

export interface AlertRulesListResponseChannel {
  channel_id: string;
  summary: string;
}

export interface AlertRulesListPayloadFilter {
  label: string;
  type: AlertRuleFilterType;
  regexp: string;
}

export interface AlertRulesListResponseParam {
  name: string;
  type: keyof typeof AlertRuleParamType;
  [AlertRuleParamType.BOOL]?: boolean;
  [AlertRuleParamType.FLOAT]?: number;
  [AlertRuleParamType.STRING]?: string;
}

export interface AlertRuleCreatePayload {
  custom_labels?: { [K: string]: string };
  filters: AlertRulesListPayloadFilter[];
  for: string;
  params?: AlertRulesListResponseParam[];
  severity: keyof typeof Severity;
  name: string;
  template_name: string;
  group: string;
  folder_uid: string;
}
