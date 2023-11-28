export const ALERT_RULE_TEMPLATES_TABLE_ID = 'alert-rule-templates';
import { SourceDescription, TemplateParamUnit } from './AlertRuleTemplate.types';
export const UNIT_MAP = {
    [TemplateParamUnit.PERCENTAGE]: '%',
    [TemplateParamUnit.SECONDS]: 'seconds',
};
export const SOURCE_MAP = {
    [SourceDescription.BUILT_IN]: 'Built-in',
    [SourceDescription.SAAS]: 'Percona Platform',
    [SourceDescription.USER_FILE]: 'User Created (file)',
    [SourceDescription.USER_API]: 'User Created (UI)',
};
export const GET_TEMPLATES_CANCEL_TOKEN = 'getTemplates';
//# sourceMappingURL=AlertRuleTemplate.constants.js.map