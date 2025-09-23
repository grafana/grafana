import { FormattedTemplate } from '../AlertRuleTemplate.types';

export interface DeleteRuleTemplateModalProps {
  template: FormattedTemplate;
  isVisible: boolean;
  setVisible: (value: boolean) => void;
  getAlertRuleTemplates: () => void;
}
