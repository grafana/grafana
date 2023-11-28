import { __rest } from "tslib";
import moment from 'moment/moment';
import { UNIT_MAP, SOURCE_MAP } from './AlertRuleTemplate.constants';
export const formatTemplate = (template) => {
    const { summary, source, created_at } = template, restProps = __rest(template, ["summary", "source", "created_at"]);
    return Object.assign({ summary,
        source, created_at: created_at ? moment(created_at).format('YYYY-MM-DD HH:mm:ss') : undefined }, restProps);
};
export const formatTemplates = (templates) => templates.map(formatTemplate);
export const beautifyUnit = (unit) => UNIT_MAP[unit];
export const formatSource = (source) => SOURCE_MAP[source];
export const formatDate = (date) => date && moment(date).format('YYYY-MM-DD');
//# sourceMappingURL=AlertRuleTemplate.utils.js.map