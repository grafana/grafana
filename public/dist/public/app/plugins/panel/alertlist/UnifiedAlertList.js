import { __makeTemplateObject, __read, __spreadArray } from "tslib";
import React, { useEffect, useMemo } from 'react';
import { sortBy } from 'lodash';
import { useDispatch } from 'react-redux';
import { intervalToAbbreviatedDurationString } from '@grafana/data';
import { CustomScrollbar, Icon, LoadingPlaceholder, useStyles, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { AlertInstances } from './AlertInstances';
import alertDef from 'app/features/alerting/state/alertDef';
import { SortOrder } from './types';
import { flattenRules, alertStateToState, getFirstActiveAt } from 'app/features/alerting/unified/utils/rules';
import { fetchAllPromRulesAction } from 'app/features/alerting/unified/state/actions';
import { useUnifiedAlertingSelector } from 'app/features/alerting/unified/hooks/useUnifiedAlertingSelector';
import { getAllRulesSourceNames } from 'app/features/alerting/unified/utils/datasource';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { Annotation, RULE_LIST_POLL_INTERVAL_MS } from 'app/features/alerting/unified/utils/constants';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';
export function UnifiedAlertList(props) {
    var dispatch = useDispatch();
    var rulesDataSourceNames = useMemo(getAllRulesSourceNames, []);
    useEffect(function () {
        dispatch(fetchAllPromRulesAction());
        var interval = setInterval(function () { return dispatch(fetchAllPromRulesAction()); }, RULE_LIST_POLL_INTERVAL_MS);
        return function () {
            clearInterval(interval);
        };
    }, [dispatch]);
    var promRulesRequests = useUnifiedAlertingSelector(function (state) { return state.promRules; });
    var dispatched = rulesDataSourceNames.some(function (name) { var _a; return (_a = promRulesRequests[name]) === null || _a === void 0 ? void 0 : _a.dispatched; });
    var loading = rulesDataSourceNames.some(function (name) { var _a; return (_a = promRulesRequests[name]) === null || _a === void 0 ? void 0 : _a.loading; });
    var haveResults = rulesDataSourceNames.some(function (name) { var _a, _b, _c; return ((_b = (_a = promRulesRequests[name]) === null || _a === void 0 ? void 0 : _a.result) === null || _b === void 0 ? void 0 : _b.length) && !((_c = promRulesRequests[name]) === null || _c === void 0 ? void 0 : _c.error); });
    var styles = useStyles(getStyles);
    var stateStyle = useStyles2(getStateTagStyles);
    var rules = useMemo(function () {
        return filterRules(props.options, sortRules(props.options.sortOrder, Object.values(promRulesRequests).flatMap(function (_a) {
            var _b = _a.result, result = _b === void 0 ? [] : _b;
            return flattenRules(result);
        })));
    }, [props.options, promRulesRequests]);
    var rulesToDisplay = rules.length <= props.options.maxItems ? rules : rules.slice(0, props.options.maxItems);
    var noAlertsMessage = rules.length ? '' : 'No alerts';
    return (React.createElement(CustomScrollbar, { autoHeightMin: "100%", autoHeightMax: "100%" },
        React.createElement("div", { className: styles.container },
            dispatched && loading && !haveResults && React.createElement(LoadingPlaceholder, { text: "Loading..." }),
            noAlertsMessage && React.createElement("div", { className: styles.noAlertsMessage }, noAlertsMessage),
            React.createElement("section", null,
                React.createElement("ol", { className: styles.alertRuleList }, haveResults &&
                    rulesToDisplay.map(function (ruleWithLocation, index) {
                        var rule = ruleWithLocation.rule, namespaceName = ruleWithLocation.namespaceName, groupName = ruleWithLocation.groupName;
                        var firstActiveAt = getFirstActiveAt(rule);
                        return (React.createElement("li", { className: styles.alertRuleItem, key: "alert-" + namespaceName + "-" + groupName + "-" + rule.name + "-" + index },
                            React.createElement("div", { className: stateStyle.icon },
                                React.createElement(Icon, { name: alertDef.getStateDisplayModel(rule.state).iconClass, className: stateStyle[alertStateToState[rule.state]], size: 'lg' })),
                            React.createElement("div", null,
                                React.createElement("div", { className: styles.instanceDetails },
                                    React.createElement("div", { className: styles.alertName, title: rule.name }, rule.name),
                                    React.createElement("div", { className: styles.alertDuration },
                                        React.createElement("span", { className: stateStyle[alertStateToState[rule.state]] }, rule.state.toUpperCase()),
                                        ' ',
                                        firstActiveAt && rule.state !== PromAlertingRuleState.Inactive && (React.createElement(React.Fragment, null,
                                            "for",
                                            ' ',
                                            React.createElement("span", null, intervalToAbbreviatedDurationString({
                                                start: firstActiveAt,
                                                end: Date.now(),
                                            })))))),
                                React.createElement(AlertInstances, { ruleWithLocation: ruleWithLocation, showInstances: props.options.showInstances }))));
                    }))))));
}
function sortRules(sortOrder, rules) {
    if (sortOrder === SortOrder.Importance) {
        // @ts-ignore
        return sortBy(rules, function (rule) { return alertDef.alertStateSortScore[rule.state]; });
    }
    else if (sortOrder === SortOrder.TimeAsc) {
        return sortBy(rules, function (rule) { return getFirstActiveAt(rule.rule) || new Date(); });
    }
    else if (sortOrder === SortOrder.TimeDesc) {
        return sortBy(rules, function (rule) { return getFirstActiveAt(rule.rule) || new Date(); }).reverse();
    }
    var result = sortBy(rules, function (rule) { return rule.rule.name.toLowerCase(); });
    if (sortOrder === SortOrder.AlphaDesc) {
        result.reverse();
    }
    return result;
}
function filterRules(options, rules) {
    var _a;
    var filteredRules = __spreadArray([], __read(rules), false);
    if (options.dashboardAlerts) {
        var dashboardUid_1 = (_a = getDashboardSrv().getCurrent()) === null || _a === void 0 ? void 0 : _a.uid;
        filteredRules = filteredRules.filter(function (_a) {
            var _b = _a.rule.annotations, annotations = _b === void 0 ? {} : _b;
            return Object.entries(annotations).some(function (_a) {
                var _b = __read(_a, 2), key = _b[0], value = _b[1];
                return key === Annotation.dashboardUID && value === dashboardUid_1;
            });
        });
    }
    if (options.alertName) {
        filteredRules = filteredRules.filter(function (_a) {
            var name = _a.rule.name;
            return name.toLocaleLowerCase().includes(options.alertName.toLocaleLowerCase());
        });
    }
    if (Object.values(options.stateFilter).some(function (value) { return value; })) {
        filteredRules = filteredRules.filter(function (rule) {
            return ((options.stateFilter.firing && rule.rule.state === PromAlertingRuleState.Firing) ||
                (options.stateFilter.pending && rule.rule.state === PromAlertingRuleState.Pending) ||
                (options.stateFilter.inactive && rule.rule.state === PromAlertingRuleState.Inactive));
        });
    }
    if (options.folder) {
        filteredRules = filteredRules.filter(function (rule) {
            return rule.namespaceName === options.folder.title;
        });
    }
    return filteredRules;
}
var getStyles = function (theme) { return ({
    cardContainer: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    padding: ", " 0 ", " 0;\n    line-height: ", ";\n    margin-bottom: 0px;\n  "], ["\n    padding: ", " 0 ", " 0;\n    line-height: ", ";\n    margin-bottom: 0px;\n  "])), theme.spacing.xs, theme.spacing.xxs, theme.typography.lineHeight.md),
    container: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    overflow-y: auto;\n    height: 100%;\n  "], ["\n    overflow-y: auto;\n    height: 100%;\n  "]))),
    alertRuleList: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    display: flex;\n    flex-wrap: wrap;\n    justify-content: space-between;\n    list-style-type: none;\n  "], ["\n    display: flex;\n    flex-wrap: wrap;\n    justify-content: space-between;\n    list-style-type: none;\n  "]))),
    alertRuleItem: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    display: flex;\n    align-items: center;\n    width: 100%;\n    height: 100%;\n    background: ", ";\n    padding: ", " ", ";\n    border-radius: ", ";\n    margin-bottom: ", ";\n\n    & > * {\n      margin-right: ", ";\n    }\n  "], ["\n    display: flex;\n    align-items: center;\n    width: 100%;\n    height: 100%;\n    background: ", ";\n    padding: ", " ", ";\n    border-radius: ", ";\n    margin-bottom: ", ";\n\n    & > * {\n      margin-right: ", ";\n    }\n  "])), theme.colors.bg2, theme.spacing.xs, theme.spacing.sm, theme.border.radius.md, theme.spacing.xs, theme.spacing.sm),
    alertName: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    font-size: ", ";\n    font-weight: ", ";\n  "], ["\n    font-size: ", ";\n    font-weight: ", ";\n  "])), theme.typography.size.md, theme.typography.weight.bold),
    alertDuration: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n    font-size: ", ";\n  "], ["\n    font-size: ", ";\n  "])), theme.typography.size.sm),
    alertRuleItemText: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n    font-weight: ", ";\n    font-size: ", ";\n    margin: 0;\n  "], ["\n    font-weight: ", ";\n    font-size: ", ";\n    margin: 0;\n  "])), theme.typography.weight.bold, theme.typography.size.sm),
    alertRuleItemTime: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n    color: ", ";\n    font-weight: normal;\n    white-space: nowrap;\n  "], ["\n    color: ", ";\n    font-weight: normal;\n    white-space: nowrap;\n  "])), theme.colors.textWeak),
    alertRuleItemInfo: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n    font-weight: normal;\n    flex-grow: 2;\n    display: flex;\n    align-items: flex-end;\n  "], ["\n    font-weight: normal;\n    flex-grow: 2;\n    display: flex;\n    align-items: flex-end;\n  "]))),
    noAlertsMessage: css(templateObject_10 || (templateObject_10 = __makeTemplateObject(["\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    width: 100%;\n    height: 100%;\n  "], ["\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    width: 100%;\n    height: 100%;\n  "]))),
    alertIcon: css(templateObject_11 || (templateObject_11 = __makeTemplateObject(["\n    margin-right: ", ";\n  "], ["\n    margin-right: ", ";\n  "])), theme.spacing.xs),
    instanceDetails: css(templateObject_12 || (templateObject_12 = __makeTemplateObject(["\n    min-width: 1px;\n    white-space: nowrap;\n    overflow: hidden;\n    text-overflow: ellipsis;\n  "], ["\n    min-width: 1px;\n    white-space: nowrap;\n    overflow: hidden;\n    text-overflow: ellipsis;\n  "]))),
}); };
var getStateTagStyles = function (theme) { return ({
    common: css(templateObject_13 || (templateObject_13 = __makeTemplateObject(["\n    width: 70px;\n    text-align: center;\n    align-self: stretch;\n\n    display: inline-block;\n    color: white;\n    border-radius: ", ";\n    font-size: ", ";\n    /* padding: ", "; */\n    text-transform: capitalize;\n    line-height: 1.2;\n    flex-shrink: 0;\n\n    display: flex;\n    flex-direction: column;\n    justify-content: center;\n  "], ["\n    width: 70px;\n    text-align: center;\n    align-self: stretch;\n\n    display: inline-block;\n    color: white;\n    border-radius: ", ";\n    font-size: ", ";\n    /* padding: ", "; */\n    text-transform: capitalize;\n    line-height: 1.2;\n    flex-shrink: 0;\n\n    display: flex;\n    flex-direction: column;\n    justify-content: center;\n  "])), theme.shape.borderRadius(), theme.typography.size.sm, theme.spacing(2, 0)),
    icon: css(templateObject_14 || (templateObject_14 = __makeTemplateObject(["\n    margin-top: ", ";\n    align-self: flex-start;\n  "], ["\n    margin-top: ", ";\n    align-self: flex-start;\n  "])), theme.spacing(2.5)),
    // good: css`
    //   background-color: ${theme.colors.success.main};
    //   border: solid 1px ${theme.colors.success.main};
    //   color: ${theme.colors.success.contrastText};
    // `,
    // warning: css`
    //   background-color: ${theme.colors.warning.main};
    //   border: solid 1px ${theme.colors.warning.main};
    //   color: ${theme.colors.warning.contrastText};
    // `,
    // bad: css`
    //   background-color: ${theme.colors.error.main};
    //   border: solid 1px ${theme.colors.error.main};
    //   color: ${theme.colors.error.contrastText};
    // `,
    // neutral: css`
    //   background-color: ${theme.colors.secondary.main};
    //   border: solid 1px ${theme.colors.secondary.main};
    // `,
    // info: css`
    //   background-color: ${theme.colors.primary.main};
    //   border: solid 1px ${theme.colors.primary.main};
    //   color: ${theme.colors.primary.contrastText};
    // `,
    good: css(templateObject_15 || (templateObject_15 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.colors.success.main),
    bad: css(templateObject_16 || (templateObject_16 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.colors.error.main),
    warning: css(templateObject_17 || (templateObject_17 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.colors.warning.main),
    neutral: css(templateObject_18 || (templateObject_18 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.colors.secondary.main),
    info: css(templateObject_19 || (templateObject_19 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.colors.primary.main),
}); };
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13, templateObject_14, templateObject_15, templateObject_16, templateObject_17, templateObject_18, templateObject_19;
//# sourceMappingURL=UnifiedAlertList.js.map