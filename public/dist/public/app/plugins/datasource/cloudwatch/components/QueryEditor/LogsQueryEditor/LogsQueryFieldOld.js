import { __awaiter } from "tslib";
import { languages as prismLanguages } from 'prismjs';
import React from 'react';
import { BracesPlugin, QueryField, SlatePrism, withTheme2, } from '@grafana/ui';
import syntax from '../../../language/cloudwatch-logs/syntax';
import { getStatsGroups } from '../../../utils/query/getStatsGroups';
import { LogGroupsFieldWrapper } from '../../shared/LogGroups/LogGroupsField';
const plugins = [
    BracesPlugin(),
    SlatePrism({
        onlyIn: (node) => node.object === 'block' && node.type === 'code_block',
        getSyntax: (node) => 'cloudwatch',
    }, Object.assign(Object.assign({}, prismLanguages), { cloudwatch: syntax })),
];
export const CloudWatchLogsQueryField = (props) => {
    var _a, _b, _c;
    const { query, datasource, onChange, ExtraFieldElement, data } = props;
    const showError = ((_a = data === null || data === void 0 ? void 0 : data.error) === null || _a === void 0 ? void 0 : _a.refId) === query.refId;
    const cleanText = datasource.languageProvider.cleanText;
    const onChangeQuery = (value) => {
        // Send text change to parent
        const nextQuery = Object.assign(Object.assign({}, query), { expression: value, statsGroups: getStatsGroups(value) });
        onChange(nextQuery);
    };
    const onTypeahead = (typeahead) => __awaiter(void 0, void 0, void 0, function* () {
        const { datasource, query } = props;
        const { logGroups } = query;
        if (!datasource.languageProvider) {
            return { suggestions: [] };
        }
        const { history, absoluteRange } = props;
        const { prefix, text, value, wrapperClasses, labelKey, editor } = typeahead;
        return yield datasource.languageProvider.provideCompletionItems({ text, value, prefix, wrapperClasses, labelKey, editor }, {
            history,
            absoluteRange,
            logGroups: logGroups,
            region: query.region,
        });
    });
    return (React.createElement(React.Fragment, null,
        React.createElement(LogGroupsFieldWrapper, { region: query.region, datasource: datasource, legacyLogGroupNames: query.logGroupNames, logGroups: query.logGroups, onChange: (logGroups) => {
                onChange(Object.assign(Object.assign({}, query), { logGroups, logGroupNames: undefined }));
            }, 
            //legacy props can be removed once we remove support for Legacy Log Group Selector
            legacyOnChange: (logGroups) => {
                onChange(Object.assign(Object.assign({}, query), { logGroupNames: logGroups }));
            } }),
        React.createElement("div", { className: "gf-form-inline gf-form-inline--nowrap flex-grow-1" },
            React.createElement("div", { className: "gf-form gf-form--grow flex-shrink-1" },
                React.createElement(QueryField, { additionalPlugins: plugins, query: (_b = query.expression) !== null && _b !== void 0 ? _b : '', onChange: onChangeQuery, onTypeahead: onTypeahead, cleanText: cleanText, placeholder: "Enter a CloudWatch Logs Insights query (run with Shift+Enter)", portalOrigin: "cloudwatch" })),
            ExtraFieldElement),
        showError ? (React.createElement("div", { className: "query-row-break" },
            React.createElement("div", { className: "prom-query-field-info text-error" }, (_c = data === null || data === void 0 ? void 0 : data.error) === null || _c === void 0 ? void 0 : _c.message))) : null));
};
export default withTheme2(CloudWatchLogsQueryField);
//# sourceMappingURL=LogsQueryFieldOld.js.map