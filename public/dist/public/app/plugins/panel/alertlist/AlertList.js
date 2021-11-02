import { __assign, __awaiter, __generator, __makeTemplateObject, __read } from "tslib";
import React, { useState } from 'react';
import { sortBy } from 'lodash';
import { dateMath, dateTime } from '@grafana/data';
import { Card, CustomScrollbar, Icon, stylesFactory, useStyles } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import { getBackendSrv, getTemplateSrv } from '@grafana/runtime';
import { useAsync } from 'react-use';
import alertDef from 'app/features/alerting/state/alertDef';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { ShowOption, SortOrder } from './types';
export function AlertList(props) {
    var _this = this;
    var _a = __read(useState(''), 2), noAlertsMessage = _a[0], setNoAlertsMessage = _a[1];
    var currentAlertState = useAsync(function () { return __awaiter(_this, void 0, void 0, function () {
        var params, panel, alerts, currentAlerts;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (props.options.showOptions !== ShowOption.Current) {
                        return [2 /*return*/];
                    }
                    params = {
                        state: getStateFilter(props.options.stateFilter),
                    };
                    panel = (_a = getDashboardSrv().getCurrent()) === null || _a === void 0 ? void 0 : _a.getPanelById(props.id);
                    if (props.options.alertName) {
                        params.query = getTemplateSrv().replace(props.options.alertName, panel.scopedVars);
                    }
                    if (props.options.folderId >= 0) {
                        params.folderId = props.options.folderId;
                    }
                    if (props.options.dashboardTitle) {
                        params.dashboardQuery = props.options.dashboardTitle;
                    }
                    if (props.options.dashboardAlerts) {
                        params.dashboardId = (_b = getDashboardSrv().getCurrent()) === null || _b === void 0 ? void 0 : _b.id;
                    }
                    if (props.options.tags) {
                        params.dashboardTag = props.options.tags;
                    }
                    return [4 /*yield*/, getBackendSrv().get('/api/alerts', params, "alert-list-get-current-alert-state-" + props.id)];
                case 1:
                    alerts = _c.sent();
                    currentAlerts = sortAlerts(props.options.sortOrder, alerts.map(function (al) { return (__assign(__assign({}, al), { stateModel: alertDef.getStateDisplayModel(al.state), newStateDateAgo: dateTime(al.newStateDate).locale('en').fromNow(true) })); }));
                    if (currentAlerts.length > props.options.maxItems) {
                        currentAlerts = currentAlerts.slice(0, props.options.maxItems);
                    }
                    setNoAlertsMessage(currentAlerts.length === 0 ? 'No alerts' : '');
                    return [2 /*return*/, currentAlerts];
            }
        });
    }); }, [
        props.options.showOptions,
        props.options.stateFilter.alerting,
        props.options.stateFilter.execution_error,
        props.options.stateFilter.no_data,
        props.options.stateFilter.ok,
        props.options.stateFilter.paused,
        props.options.stateFilter.pending,
        props.options.maxItems,
        props.options.tags,
        props.options.dashboardAlerts,
        props.options.dashboardTitle,
        props.options.folderId,
        props.options.alertName,
        props.options.sortOrder,
    ]);
    var recentStateChanges = useAsync(function () { return __awaiter(_this, void 0, void 0, function () {
        var params, currentDashboard, data, alertHistory;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (props.options.showOptions !== ShowOption.RecentChanges) {
                        return [2 /*return*/];
                    }
                    params = {
                        limit: props.options.maxItems,
                        type: 'alert',
                        newState: getStateFilter(props.options.stateFilter),
                    };
                    currentDashboard = getDashboardSrv().getCurrent();
                    if (props.options.dashboardAlerts) {
                        params.dashboardId = currentDashboard === null || currentDashboard === void 0 ? void 0 : currentDashboard.id;
                    }
                    params.from = dateMath.parse(currentDashboard === null || currentDashboard === void 0 ? void 0 : currentDashboard.time.from).unix() * 1000;
                    params.to = dateMath.parse(currentDashboard === null || currentDashboard === void 0 ? void 0 : currentDashboard.time.to).unix() * 1000;
                    return [4 /*yield*/, getBackendSrv().get('/api/annotations', params, "alert-list-get-state-changes-" + props.id)];
                case 1:
                    data = _a.sent();
                    alertHistory = sortAlerts(props.options.sortOrder, data.map(function (al) {
                        return __assign(__assign({}, al), { time: currentDashboard === null || currentDashboard === void 0 ? void 0 : currentDashboard.formatDate(al.time, 'MMM D, YYYY HH:mm:ss'), stateModel: alertDef.getStateDisplayModel(al.newState), info: alertDef.getAlertAnnotationInfo(al) });
                    }));
                    setNoAlertsMessage(alertHistory.length === 0 ? 'No alerts in current time range' : '');
                    return [2 /*return*/, alertHistory];
            }
        });
    }); }, [
        props.options.showOptions,
        props.options.maxItems,
        props.options.stateFilter.alerting,
        props.options.stateFilter.execution_error,
        props.options.stateFilter.no_data,
        props.options.stateFilter.ok,
        props.options.stateFilter.paused,
        props.options.stateFilter.pending,
        props.options.dashboardAlerts,
        props.options.sortOrder,
    ]);
    var styles = useStyles(getStyles);
    return (React.createElement(CustomScrollbar, { autoHeightMin: "100%", autoHeightMax: "100%" },
        React.createElement("div", { className: styles.container },
            noAlertsMessage && React.createElement("div", { className: styles.noAlertsMessage }, noAlertsMessage),
            React.createElement("section", null,
                React.createElement("ol", { className: styles.alertRuleList }, props.options.showOptions === ShowOption.Current
                    ? !currentAlertState.loading &&
                        currentAlertState.value &&
                        currentAlertState.value.map(function (alert) { return (React.createElement("li", { className: styles.alertRuleItem, key: "alert-" + alert.id },
                            React.createElement(Card, { heading: alert.name, href: alert.url + "?viewPanel=" + alert.panelId, className: styles.cardContainer },
                                React.createElement(Card.Figure, { className: cx(styles.alertRuleItemIcon, alert.stateModel.stateClass) },
                                    React.createElement(Icon, { name: alert.stateModel.iconClass, size: "xl", className: styles.alertIcon })),
                                React.createElement(Card.Meta, null,
                                    React.createElement("div", { className: styles.alertRuleItemText },
                                        React.createElement("span", { className: alert.stateModel.stateClass }, alert.stateModel.text),
                                        React.createElement("span", { className: styles.alertRuleItemTime },
                                            " for ",
                                            alert.newStateDateAgo)))))); })
                    : !recentStateChanges.loading &&
                        recentStateChanges.value &&
                        recentStateChanges.value.map(function (alert) { return (React.createElement("li", { className: styles.alertRuleItem, key: "alert-" + alert.id },
                            React.createElement(Card, { heading: alert.alertName, className: styles.cardContainer },
                                React.createElement(Card.Figure, { className: cx(styles.alertRuleItemIcon, alert.stateModel.stateClass) },
                                    React.createElement(Icon, { name: alert.stateModel.iconClass, size: "xl" })),
                                React.createElement(Card.Meta, null,
                                    React.createElement("span", { className: cx(styles.alertRuleItemText, alert.stateModel.stateClass) }, alert.stateModel.text),
                                    React.createElement("span", null, alert.time),
                                    alert.info && React.createElement("span", { className: styles.alertRuleItemInfo }, alert.info))))); }))))));
}
function sortAlerts(sortOrder, alerts) {
    if (sortOrder === SortOrder.Importance) {
        // @ts-ignore
        return sortBy(alerts, function (a) { return alertDef.alertStateSortScore[a.state || a.newState]; });
    }
    else if (sortOrder === SortOrder.TimeAsc) {
        return sortBy(alerts, function (a) { return new Date(a.newStateDate || a.time); });
    }
    else if (sortOrder === SortOrder.TimeDesc) {
        return sortBy(alerts, function (a) { return new Date(a.newStateDate || a.time); }).reverse();
    }
    var result = sortBy(alerts, function (a) { return (a.name || a.alertName).toLowerCase(); });
    if (sortOrder === SortOrder.AlphaDesc) {
        result.reverse();
    }
    return result;
}
function getStateFilter(stateFilter) {
    return Object.entries(stateFilter)
        .filter(function (_a) {
        var _b = __read(_a, 2), _ = _b[0], val = _b[1];
        return val;
    })
        .map(function (_a) {
        var _b = __read(_a, 2), key = _b[0], _ = _b[1];
        return key;
    });
}
var getStyles = stylesFactory(function (theme) { return ({
    cardContainer: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    padding: ", " 0 ", " 0;\n    line-height: ", ";\n    margin-bottom: 0px;\n  "], ["\n    padding: ", " 0 ", " 0;\n    line-height: ", ";\n    margin-bottom: 0px;\n  "])), theme.spacing.xs, theme.spacing.xxs, theme.typography.lineHeight.md),
    container: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    overflow-y: auto;\n    height: 100%;\n  "], ["\n    overflow-y: auto;\n    height: 100%;\n  "]))),
    alertRuleList: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    display: flex;\n    flex-wrap: wrap;\n    justify-content: space-between;\n    list-style-type: none;\n  "], ["\n    display: flex;\n    flex-wrap: wrap;\n    justify-content: space-between;\n    list-style-type: none;\n  "]))),
    alertRuleItem: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    display: flex;\n    align-items: center;\n    width: 100%;\n    height: 100%;\n    background: ", ";\n    padding: ", " ", ";\n    border-radius: ", ";\n    margin-bottom: ", ";\n  "], ["\n    display: flex;\n    align-items: center;\n    width: 100%;\n    height: 100%;\n    background: ", ";\n    padding: ", " ", ";\n    border-radius: ", ";\n    margin-bottom: ", ";\n  "])), theme.colors.bg2, theme.spacing.xs, theme.spacing.sm, theme.border.radius.md, theme.spacing.xs),
    alertRuleItemIcon: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    display: flex;\n    justify-content: center;\n    align-items: center;\n    width: ", ";\n    padding: 0 ", " 0 ", ";\n    margin-right: 0px;\n  "], ["\n    display: flex;\n    justify-content: center;\n    align-items: center;\n    width: ", ";\n    padding: 0 ", " 0 ", ";\n    margin-right: 0px;\n  "])), theme.spacing.xl, theme.spacing.xs, theme.spacing.xxs),
    alertRuleItemText: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n    font-weight: ", ";\n    font-size: ", ";\n    margin: 0;\n  "], ["\n    font-weight: ", ";\n    font-size: ", ";\n    margin: 0;\n  "])), theme.typography.weight.bold, theme.typography.size.sm),
    alertRuleItemTime: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n    color: ", ";\n    font-weight: normal;\n    white-space: nowrap;\n  "], ["\n    color: ", ";\n    font-weight: normal;\n    white-space: nowrap;\n  "])), theme.colors.textWeak),
    alertRuleItemInfo: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n    font-weight: normal;\n    flex-grow: 2;\n    display: flex;\n    align-items: flex-end;\n  "], ["\n    font-weight: normal;\n    flex-grow: 2;\n    display: flex;\n    align-items: flex-end;\n  "]))),
    noAlertsMessage: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    width: 100%;\n    height: 100%;\n  "], ["\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    width: 100%;\n    height: 100%;\n  "]))),
    alertIcon: css(templateObject_10 || (templateObject_10 = __makeTemplateObject(["\n    margin-right: ", ";\n  "], ["\n    margin-right: ", ";\n  "])), theme.spacing.xs),
}); });
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10;
//# sourceMappingURL=AlertList.js.map