import { FormattedTemplate } from '../AlertRuleTemplate.types';

export interface AlertRuleTemplateActionsProps {
  template: FormattedTemplate;
  getAlertRuleTemplates: () => void;
}
