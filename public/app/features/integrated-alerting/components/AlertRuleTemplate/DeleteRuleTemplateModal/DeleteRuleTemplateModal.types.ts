import { FormattedTemplate } from '../AlertRuleTemplatesTable/AlertRuleTemplatesTable.types';

export interface DeleteRuleTemplateModalProps {
  template: FormattedTemplate;
  isVisible: boolean;
  setVisible: (value: boolean) => void;
  getAlertRuleTemplates: () => void;
}
