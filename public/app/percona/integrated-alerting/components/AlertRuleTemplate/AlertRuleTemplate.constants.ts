export const ALERT_RULE_TEMPLATES_TABLE_ID = 'alert-rule-templates';
import { TemplateParamUnit } from './AlertRuleTemplate.types';

export const UNIT_MAP: Record<TemplateParamUnit, string> = {
  [TemplateParamUnit.PERCENTAGE]: '%',
  [TemplateParamUnit.SECONDS]: 'seconds',
};
