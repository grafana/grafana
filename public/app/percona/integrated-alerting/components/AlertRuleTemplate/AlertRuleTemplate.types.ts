import { Severity } from 'app/percona/shared/core';

export interface UploadAlertRuleTemplatePayload {
  yaml: string;
}

export interface UpdateAlertRuleTemplatePayload {
  yaml: string;
  name: string;
}

export interface DeleteAlertRuleTemplatePayload {
  name: string;
}

export interface AlertRuleTemplateGetPayload {
  page_params: {
    page_size: number;
    index: number;
  };
}

interface AlertRuleTemplatesTotals {
  total_items: number;
  total_pages: number;
}

export interface TemplatesListAPI {
  templates: TemplateAPI[];
  totals: AlertRuleTemplatesTotals;
}

export interface TemplatesList extends Omit<TemplatesListAPI, 'templates'> {
  templates: Template[];
}

export enum SourceDescription {
  BUILT_IN = 'TEMPLATE_SOURCE_BUILT_IN',
  SAAS = 'TEMPLATE_SOURCE_SAAS',
  USER_FILE = 'TEMPLATE_SOURCE_USER_FILE',
  USER_API = 'TEMPLATE_SOURCE_USER_API',
}

// https://github.com/percona/saas/blob/main/pkg/alert/type.go
export enum TemplateParamType {
  FLOAT = 'PARAM_TYPE_FLOAT',
  BOOL = 'PARAM_TYPE_BOOL',
  STRING = 'PARAM_TYPE_STRING',
}

// https://github.com/percona/saas/blob/main/pkg/alert/unit.go
export enum TemplateParamUnit {
  PERCENTAGE = 'PARAM_UNIT_PERCENTAGE',
  SECONDS = 'PARAM_UNIT_SECONDS',
}

export interface TemplateFloatParamAPI {
  has_default: boolean;
  has_min: boolean;
  has_max: boolean;
  default?: number;
  min?: number;
  max?: number;
}

export interface TemplateFloatParam extends Omit<TemplateFloatParamAPI, 'has_default' | 'has_min' | 'has_max'> {
  hasDefault: boolean;
  hasMin: boolean;
  hasMax: boolean;
}

export interface TemplateParamAPI {
  name: string;
  type: TemplateParamType;
  unit: TemplateParamUnit;
  summary: string;
  float?: TemplateFloatParamAPI;
}

export interface TemplateParam extends Omit<TemplateParamAPI, 'float'> {
  float?: TemplateFloatParam;
}

export interface TemplateAnnotation {
  summary?: string;
}

export interface TemplateAPI {
  summary: string;
  name: string;
  source: SourceDescription;
  created_at?: string;
  yaml: string;
  params?: TemplateParamAPI[];
  expr: string;
  annotations?: TemplateAnnotation;
  severity: keyof typeof Severity;
  for: string;
}

export interface Template extends Omit<TemplateAPI, 'params'> {
  params?: TemplateParam[];
}

export interface FormattedTemplate {
  name: string;
  summary: string;
  source: SourceDescription;
  created_at?: string;
  yaml: string;
}

export interface AlertRuleTemplatesTableProps {
  pendingRequest: boolean;
  data: FormattedTemplate[];
  getAlertRuleTemplates: () => void;
}
