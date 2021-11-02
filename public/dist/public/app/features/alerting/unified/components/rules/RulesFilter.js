import { __makeTemplateObject, __read } from "tslib";
import React, { useState } from 'react';
import { Button, Icon, Input, Label, RadioButtonGroup, Tooltip, useStyles } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import { debounce } from 'lodash';
import { PromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { getFiltersFromUrlParams } from '../../utils/misc';
import { DataSourcePicker } from '@grafana/runtime';
import { alertStateToReadable } from '../../utils/rules';
var ViewOptions = [
    {
        icon: 'folder',
        label: 'Groups',
        value: 'group',
    },
    {
        icon: 'heart-rate',
        label: 'State',
        value: 'state',
    },
];
var RuleTypeOptions = [
    {
        label: 'Alert ',
        value: PromRuleType.Alerting,
    },
    {
        label: 'Recording ',
        value: PromRuleType.Recording,
    },
];
var RulesFilter = function () {
    var _a = __read(useQueryParams(), 2), queryParams = _a[0], setQueryParams = _a[1];
    // This key is used to force a rerender on the inputs when the filters are cleared
    var _b = __read(useState(Math.floor(Math.random() * 100)), 2), filterKey = _b[0], setFilterKey = _b[1];
    var dataSourceKey = "dataSource-" + filterKey;
    var queryStringKey = "queryString-" + filterKey;
    var _c = getFiltersFromUrlParams(queryParams), dataSource = _c.dataSource, alertState = _c.alertState, queryString = _c.queryString, ruleType = _c.ruleType;
    var styles = useStyles(getStyles);
    var stateOptions = Object.entries(PromAlertingRuleState).map(function (_a) {
        var _b = __read(_a, 2), key = _b[0], value = _b[1];
        return ({
            label: alertStateToReadable(value),
            value: value,
        });
    });
    var handleDataSourceChange = function (dataSourceValue) {
        setQueryParams({ dataSource: dataSourceValue.name });
    };
    var handleQueryStringChange = debounce(function (e) {
        var target = e.target;
        setQueryParams({ queryString: target.value || null });
    }, 600);
    var handleAlertStateChange = function (value) {
        setQueryParams({ alertState: value });
    };
    var handleViewChange = function (view) {
        setQueryParams({ view: view });
    };
    var handleRuleTypeChange = function (ruleType) {
        setQueryParams({ ruleType: ruleType });
    };
    var handleClearFiltersClick = function () {
        setQueryParams({
            alertState: null,
            queryString: null,
            dataSource: null,
            ruleType: null,
        });
        setTimeout(function () { return setFilterKey(filterKey + 1); }, 100);
    };
    var searchIcon = React.createElement(Icon, { name: 'search' });
    return (React.createElement("div", { className: styles.container },
        React.createElement("div", { className: styles.inputWidth },
            React.createElement(Label, null, "Select data source"),
            React.createElement(DataSourcePicker, { key: dataSourceKey, alerting: true, noDefault: true, current: dataSource, onChange: handleDataSourceChange })),
        React.createElement("div", { className: cx(styles.flexRow, styles.spaceBetween) },
            React.createElement("div", { className: styles.flexRow },
                React.createElement("div", { className: styles.rowChild },
                    React.createElement(Label, null,
                        React.createElement(Tooltip, { content: React.createElement("div", null,
                                "Filter rules and alerts using label querying, ex:",
                                React.createElement("pre", null, "{severity=\"critical\", instance=~\"cluster-us-.+\"}")) },
                            React.createElement(Icon, { name: "info-circle", className: styles.tooltip })),
                        "Search by label"),
                    React.createElement(Input, { key: queryStringKey, className: styles.inputWidth, prefix: searchIcon, onChange: handleQueryStringChange, defaultValue: queryString, placeholder: "Search", "data-testid": "search-query-input" })),
                React.createElement("div", { className: styles.rowChild },
                    React.createElement(Label, null, "State"),
                    React.createElement(RadioButtonGroup, { options: stateOptions, value: alertState, onChange: handleAlertStateChange })),
                React.createElement("div", { className: styles.rowChild },
                    React.createElement(Label, null, "Rule type"),
                    React.createElement(RadioButtonGroup, { options: RuleTypeOptions, value: ruleType, onChange: handleRuleTypeChange })),
                React.createElement("div", { className: styles.rowChild },
                    React.createElement(Label, null, "View as"),
                    React.createElement(RadioButtonGroup, { options: ViewOptions, value: String(queryParams['view'] || 'group'), onChange: handleViewChange }))),
            (dataSource || alertState || queryString || ruleType) && (React.createElement("div", { className: styles.flexRow },
                React.createElement(Button, { className: styles.clearButton, fullWidth: false, icon: "times", variant: "secondary", onClick: handleClearFiltersClick }, "Clear filters"))))));
};
var getStyles = function (theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: column;\n      border-bottom: 1px solid ", ";\n      padding-bottom: ", ";\n\n      & > div {\n        margin-bottom: ", ";\n      }\n    "], ["\n      display: flex;\n      flex-direction: column;\n      border-bottom: 1px solid ", ";\n      padding-bottom: ", ";\n\n      & > div {\n        margin-bottom: ", ";\n      }\n    "])), theme.colors.border1, theme.spacing.sm, theme.spacing.sm),
        inputWidth: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      width: 340px;\n      flex-grow: 0;\n    "], ["\n      width: 340px;\n      flex-grow: 0;\n    "]))),
        flexRow: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: row;\n      align-items: flex-end;\n      width: 100%;\n      flex-wrap: wrap;\n    "], ["\n      display: flex;\n      flex-direction: row;\n      align-items: flex-end;\n      width: 100%;\n      flex-wrap: wrap;\n    "]))),
        spaceBetween: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      justify-content: space-between;\n    "], ["\n      justify-content: space-between;\n    "]))),
        rowChild: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      margin-right: ", ";\n      margin-top: ", ";\n    "], ["\n      margin-right: ", ";\n      margin-top: ", ";\n    "])), theme.spacing.sm, theme.spacing.sm),
        tooltip: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      margin: 0 ", ";\n    "], ["\n      margin: 0 ", ";\n    "])), theme.spacing.xs),
        clearButton: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      margin-top: ", ";\n    "], ["\n      margin-top: ", ";\n    "])), theme.spacing.sm),
    };
};
export default RulesFilter;
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7;
//# sourceMappingURL=RulesFilter.js.map