import { Template } from './AlertRuleTemplatesTable/AlertRuleTemplatesTable.types';

export interface UploadAlertRuleTemplatePayload {
  yaml: string;
}

export interface UpdateAlertRuleTemplatePayload {
  yaml: string;
}

export interface TemplatesList {
  templates: Template[];
}
