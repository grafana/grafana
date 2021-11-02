import { __makeTemplateObject } from "tslib";
import { useStyles2 } from '@grafana/ui';
import React, { useMemo } from 'react';
import { css, cx } from '@emotion/css';
import { RuleDetails } from './RuleDetails';
import { isCloudRulesSource } from '../../utils/datasource';
import { useHasRuler } from '../../hooks/useHasRuler';
import { Annotation } from '../../utils/constants';
import { RuleState } from './RuleState';
import { RuleHealth } from './RuleHealth';
import { DynamicTable } from '../DynamicTable';
import { DynamicTableWithGuidelines } from '../DynamicTableWithGuidelines';
export var RulesTable = function (_a) {
    var _b;
    var rules = _a.rules, className = _a.className, _c = _a.showGuidelines, showGuidelines = _c === void 0 ? false : _c, _d = _a.emptyMessage, emptyMessage = _d === void 0 ? 'No rules found.' : _d, _e = _a.showGroupColumn, showGroupColumn = _e === void 0 ? false : _e, _f = _a.showSummaryColumn, showSummaryColumn = _f === void 0 ? false : _f;
    var styles = useStyles2(getStyles);
    var wrapperClass = cx(styles.wrapper, className, (_b = {}, _b[styles.wrapperMargin] = showGuidelines, _b));
    var items = useMemo(function () {
        var seenKeys = [];
        return rules.map(function (rule, ruleIdx) {
            var _a;
            var key = JSON.stringify([(_a = rule.promRule) === null || _a === void 0 ? void 0 : _a.type, rule.labels, rule.query, rule.name, rule.annotations]);
            if (seenKeys.includes(key)) {
                key += "-" + ruleIdx;
            }
            seenKeys.push(key);
            return {
                id: key,
                data: rule,
            };
        });
    }, [rules]);
    var columns = useColumns(showSummaryColumn, showGroupColumn);
    if (!rules.length) {
        return React.createElement("div", { className: cx(wrapperClass, styles.emptyMessage) }, emptyMessage);
    }
    var TableComponent = showGuidelines ? DynamicTableWithGuidelines : DynamicTable;
    return (React.createElement("div", { className: wrapperClass, "data-testid": "rules-table" },
        React.createElement(TableComponent, { cols: columns, isExpandable: true, items: items, renderExpandedContent: function (_a) {
                var rule = _a.data;
                return React.createElement(RuleDetails, { rule: rule });
            } })));
};
export var getStyles = function (theme) { return ({
    wrapperMargin: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    ", " {\n      margin-left: 36px;\n    }\n  "], ["\n    ", " {\n      margin-left: 36px;\n    }\n  "])), theme.breakpoints.up('md')),
    emptyMessage: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    padding: ", ";\n  "], ["\n    padding: ", ";\n  "])), theme.spacing(1)),
    wrapper: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    width: auto;\n    background-color: ", ";\n    border-radius: ", ";\n  "], ["\n    width: auto;\n    background-color: ", ";\n    border-radius: ", ";\n  "])), theme.colors.background.secondary, theme.shape.borderRadius()),
}); };
function useColumns(showSummaryColumn, showGroupColumn) {
    var hasRuler = useHasRuler();
    return useMemo(function () {
        var columns = [
            {
                id: 'state',
                label: 'State',
                // eslint-disable-next-line react/display-name
                renderCell: function (_a) {
                    var rule = _a.data;
                    var namespace = rule.namespace;
                    var rulesSource = namespace.rulesSource;
                    var promRule = rule.promRule, rulerRule = rule.rulerRule;
                    var isDeleting = !!(hasRuler(rulesSource) && promRule && !rulerRule);
                    var isCreating = !!(hasRuler(rulesSource) && rulerRule && !promRule);
                    return React.createElement(RuleState, { rule: rule, isDeleting: isDeleting, isCreating: isCreating });
                },
                size: '165px',
            },
            {
                id: 'name',
                label: 'Name',
                // eslint-disable-next-line react/display-name
                renderCell: function (_a) {
                    var rule = _a.data;
                    return rule.name;
                },
                size: 5,
            },
            {
                id: 'health',
                label: 'Health',
                // eslint-disable-next-line react/display-name
                renderCell: function (_a) {
                    var promRule = _a.data.promRule;
                    return (promRule ? React.createElement(RuleHealth, { rule: promRule }) : null);
                },
                size: '75px',
            },
        ];
        if (showSummaryColumn) {
            columns.push({
                id: 'summary',
                label: 'Summary',
                // eslint-disable-next-line react/display-name
                renderCell: function (_a) {
                    var _b;
                    var rule = _a.data;
                    return (_b = rule.annotations[Annotation.summary]) !== null && _b !== void 0 ? _b : '';
                },
                size: 5,
            });
        }
        if (showGroupColumn) {
            columns.push({
                id: 'group',
                label: 'Group',
                // eslint-disable-next-line react/display-name
                renderCell: function (_a) {
                    var rule = _a.data;
                    var namespace = rule.namespace, group = rule.group;
                    var rulesSource = namespace.rulesSource;
                    return isCloudRulesSource(rulesSource) ? namespace.name + " > " + group.name : namespace.name;
                },
                size: 5,
            });
        }
        return columns;
    }, [hasRuler, showSummaryColumn, showGroupColumn]);
}
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=RulesTable.js.map