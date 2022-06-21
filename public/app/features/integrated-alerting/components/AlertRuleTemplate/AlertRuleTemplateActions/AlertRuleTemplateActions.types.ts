import { FormattedTemplate } from '../AlertRuleTemplatesTable/AlertRuleTemplatesTable.types';

export interface AlertRuleTemplateActionsProps {
  template: FormattedTemplate;
  getAlertRuleTemplates: () => void;
}
