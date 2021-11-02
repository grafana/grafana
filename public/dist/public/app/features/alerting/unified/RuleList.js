import { __makeTemplateObject, __read } from "tslib";
import { urlUtil } from '@grafana/data';
import { useStyles2, LinkButton, withErrorBoundary, Button } from '@grafana/ui';
import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { NoRulesSplash } from './components/rules/NoRulesCTA';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { useFilteredRules } from './hooks/useFilteredRules';
import { fetchAllPromAndRulerRulesAction } from './state/actions';
import { getAllRulesSourceNames } from './utils/datasource';
import { css } from '@emotion/css';
import { useCombinedRuleNamespaces } from './hooks/useCombinedRuleNamespaces';
import { RULE_LIST_POLL_INTERVAL_MS } from './utils/constants';
import RulesFilter from './components/rules/RulesFilter';
import { RuleListGroupView } from './components/rules/RuleListGroupView';
import { RuleListStateView } from './components/rules/RuleListStateView';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { useLocation } from 'react-router-dom';
import { contextSrv } from 'app/core/services/context_srv';
import { RuleStats } from './components/rules/RuleStats';
import { RuleListErrors } from './components/rules/RuleListErrors';
import { getFiltersFromUrlParams } from './utils/misc';
var VIEWS = {
    groups: RuleListGroupView,
    state: RuleListStateView,
};
export var RuleList = withErrorBoundary(function () {
    var dispatch = useDispatch();
    var styles = useStyles2(getStyles);
    var rulesDataSourceNames = useMemo(getAllRulesSourceNames, []);
    var location = useLocation();
    var _a = __read(useState(false), 2), expandAll = _a[0], setExpandAll = _a[1];
    var _b = __read(useQueryParams(), 1), queryParams = _b[0];
    var filters = getFiltersFromUrlParams(queryParams);
    var filtersActive = Object.values(filters).some(function (filter) { return filter !== undefined; });
    var view = VIEWS[queryParams['view']]
        ? queryParams['view']
        : 'groups';
    var ViewComponent = VIEWS[view];
    // fetch rules, then poll every RULE_LIST_POLL_INTERVAL_MS
    useEffect(function () {
        dispatch(fetchAllPromAndRulerRulesAction());
        var interval = setInterval(function () { return dispatch(fetchAllPromAndRulerRulesAction()); }, RULE_LIST_POLL_INTERVAL_MS);
        return function () {
            clearInterval(interval);
        };
    }, [dispatch]);
    var promRuleRequests = useUnifiedAlertingSelector(function (state) { return state.promRules; });
    var rulerRuleRequests = useUnifiedAlertingSelector(function (state) { return state.rulerRules; });
    var dispatched = rulesDataSourceNames.some(function (name) { var _a, _b; return ((_a = promRuleRequests[name]) === null || _a === void 0 ? void 0 : _a.dispatched) || ((_b = rulerRuleRequests[name]) === null || _b === void 0 ? void 0 : _b.dispatched); });
    var loading = rulesDataSourceNames.some(function (name) { var _a, _b; return ((_a = promRuleRequests[name]) === null || _a === void 0 ? void 0 : _a.loading) || ((_b = rulerRuleRequests[name]) === null || _b === void 0 ? void 0 : _b.loading); });
    var haveResults = rulesDataSourceNames.some(function (name) {
        var _a, _b, _c, _d, _e;
        return (((_b = (_a = promRuleRequests[name]) === null || _a === void 0 ? void 0 : _a.result) === null || _b === void 0 ? void 0 : _b.length) && !((_c = promRuleRequests[name]) === null || _c === void 0 ? void 0 : _c.error)) ||
            (Object.keys(((_d = rulerRuleRequests[name]) === null || _d === void 0 ? void 0 : _d.result) || {}).length && !((_e = rulerRuleRequests[name]) === null || _e === void 0 ? void 0 : _e.error));
    });
    var showNewAlertSplash = dispatched && !loading && !haveResults;
    var combinedNamespaces = useCombinedRuleNamespaces();
    var filteredNamespaces = useFilteredRules(combinedNamespaces);
    return (React.createElement(AlertingPageWrapper, { pageId: "alert-list", isLoading: loading && !haveResults },
        React.createElement(RuleListErrors, null),
        !showNewAlertSplash && (React.createElement(React.Fragment, null,
            React.createElement(RulesFilter, null),
            React.createElement("div", { className: styles.break }),
            React.createElement("div", { className: styles.buttonsContainer },
                React.createElement("div", { className: styles.statsContainer },
                    view === 'groups' && filtersActive && (React.createElement(Button, { className: styles.expandAllButton, icon: expandAll ? 'angle-double-up' : 'angle-double-down', variant: "secondary", onClick: function () { return setExpandAll(!expandAll); } }, expandAll ? 'Collapse all' : 'Expand all')),
                    React.createElement(RuleStats, { showInactive: true, showRecording: true, namespaces: filteredNamespaces })),
                (contextSrv.hasEditPermissionInFolders || contextSrv.isEditor) && (React.createElement(LinkButton, { href: urlUtil.renderUrl('alerting/new', { returnTo: location.pathname + location.search }), icon: "plus" }, "New alert rule"))))),
        showNewAlertSplash && React.createElement(NoRulesSplash, null),
        haveResults && React.createElement(ViewComponent, { expandAll: expandAll, namespaces: filteredNamespaces })));
}, { style: 'page' });
var getStyles = function (theme) { return ({
    break: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    width: 100%;\n    height: 0;\n    margin-bottom: ", ";\n    border-bottom: solid 1px ", ";\n  "], ["\n    width: 100%;\n    height: 0;\n    margin-bottom: ", ";\n    border-bottom: solid 1px ", ";\n  "])), theme.spacing(2), theme.colors.border.medium),
    buttonsContainer: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    margin-bottom: ", ";\n    display: flex;\n    justify-content: space-between;\n  "], ["\n    margin-bottom: ", ";\n    display: flex;\n    justify-content: space-between;\n  "])), theme.spacing(2)),
    statsContainer: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: row;\n    align-items: center;\n  "], ["\n    display: flex;\n    flex-direction: row;\n    align-items: center;\n  "]))),
    expandAllButton: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    margin-right: ", ";\n  "], ["\n    margin-right: ", ";\n  "])), theme.spacing(1)),
}); };
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=RuleList.js.map