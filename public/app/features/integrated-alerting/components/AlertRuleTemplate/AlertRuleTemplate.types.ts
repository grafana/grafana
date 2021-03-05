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

export interface TemplatesList {
  templates: Template[];
}

export enum SourceDescription {
  BUILT_IN = 'Built-in',
  SAAS = 'Percona Enterprise Platform',
  USER_FILE = 'User-defined (file)',
  USER_API = 'User-defined (UI)',
}

export interface Template {
  summary: string;
  name: string;
  source: keyof typeof SourceDescription;
  created_at: string | undefined;
  yaml: string;
}

export interface FormattedTemplate {
  name: string;
  summary: string;
  source: SourceDescription[keyof SourceDescription];
  created_at: string | undefined;
  yaml: string;
}

export interface AlertRuleTemplatesTableProps {
  pendingRequest: boolean;
  data: FormattedTemplate[];
  getAlertRuleTemplates: () => void;
}
