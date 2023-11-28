import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAsyncFn, useInterval } from 'react-use';
import { Stack } from '@grafana/experimental';
import { Button, useStyles2, withErrorBoundary } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { useDispatch } from 'app/types';
import { trackRuleListNavigation } from './Analytics';
import { MoreActionsRuleButtons } from './MoreActionsRuleButtons';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { NoRulesSplash } from './components/rules/NoRulesCTA';
import { INSTANCES_DISPLAY_LIMIT } from './components/rules/RuleDetails';
import { RuleListErrors } from './components/rules/RuleListErrors';
import { RuleListGroupView } from './components/rules/RuleListGroupView';
import { RuleListStateView } from './components/rules/RuleListStateView';
import { RuleStats } from './components/rules/RuleStats';
import RulesFilter from './components/rules/RulesFilter';
import { useCombinedRuleNamespaces } from './hooks/useCombinedRuleNamespaces';
import { useFilteredRules, useRulesFilter } from './hooks/useFilteredRules';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAllPromAndRulerRulesAction } from './state/actions';
import { RULE_LIST_POLL_INTERVAL_MS } from './utils/constants';
import { getAllRulesSourceNames } from './utils/datasource';
const VIEWS = {
    groups: RuleListGroupView,
    state: RuleListStateView,
};
// make sure we ask for 1 more so we show the "show x more" button
const LIMIT_ALERTS = INSTANCES_DISPLAY_LIMIT + 1;
const RuleList = withErrorBoundary(() => {
    const dispatch = useDispatch();
    const styles = useStyles2(getStyles);
    const rulesDataSourceNames = useMemo(getAllRulesSourceNames, []);
    const [expandAll, setExpandAll] = useState(false);
    const onFilterCleared = useCallback(() => setExpandAll(false), []);
    const [queryParams] = useQueryParams();
    const { filterState, hasActiveFilters } = useRulesFilter();
    const view = VIEWS[queryParams['view']]
        ? queryParams['view']
        : 'groups';
    const ViewComponent = VIEWS[view];
    const promRuleRequests = useUnifiedAlertingSelector((state) => state.promRules);
    const rulerRuleRequests = useUnifiedAlertingSelector((state) => state.rulerRules);
    const loading = rulesDataSourceNames.some((name) => { var _a, _b; return ((_a = promRuleRequests[name]) === null || _a === void 0 ? void 0 : _a.loading) || ((_b = rulerRuleRequests[name]) === null || _b === void 0 ? void 0 : _b.loading); });
    const promRequests = Object.entries(promRuleRequests);
    const allPromLoaded = promRequests.every(([_, state]) => state.dispatched && ((state === null || state === void 0 ? void 0 : state.result) !== undefined || (state === null || state === void 0 ? void 0 : state.error) !== undefined));
    const allPromEmpty = promRequests.every(([_, state]) => { var _a; return state.dispatched && ((_a = state === null || state === void 0 ? void 0 : state.result) === null || _a === void 0 ? void 0 : _a.length) === 0; });
    const limitAlerts = hasActiveFilters ? undefined : LIMIT_ALERTS;
    // Trigger data refresh only when the RULE_LIST_POLL_INTERVAL_MS elapsed since the previous load FINISHED
    const [_, fetchRules] = useAsyncFn(() => __awaiter(void 0, void 0, void 0, function* () {
        if (!loading) {
            yield dispatch(fetchAllPromAndRulerRulesAction(false, { limitAlerts }));
        }
    }), [loading, limitAlerts, dispatch]);
    useEffect(() => {
        trackRuleListNavigation().catch(() => { });
    }, []);
    // fetch rules, then poll every RULE_LIST_POLL_INTERVAL_MS
    useEffect(() => {
        dispatch(fetchAllPromAndRulerRulesAction(false, { limitAlerts }));
    }, [dispatch, limitAlerts]);
    useInterval(fetchRules, RULE_LIST_POLL_INTERVAL_MS);
    // Show splash only when we loaded all of the data sources and none of them has alerts
    const hasNoAlertRulesCreatedYet = allPromLoaded && allPromEmpty && promRequests.length > 0;
    const combinedNamespaces = useCombinedRuleNamespaces();
    const filteredNamespaces = useFilteredRules(combinedNamespaces, filterState);
    return (
    // We don't want to show the Loading... indicator for the whole page.
    // We show separate indicators for Grafana-managed and Cloud rules
    React.createElement(AlertingPageWrapper, { pageId: "alert-list", isLoading: false },
        React.createElement(RuleListErrors, null),
        React.createElement(RulesFilter, { onFilterCleared: onFilterCleared }),
        !hasNoAlertRulesCreatedYet && (React.createElement(React.Fragment, null,
            React.createElement("div", { className: styles.break }),
            React.createElement("div", { className: styles.buttonsContainer },
                React.createElement("div", { className: styles.statsContainer },
                    view === 'groups' && hasActiveFilters && (React.createElement(Button, { className: styles.expandAllButton, icon: expandAll ? 'angle-double-up' : 'angle-double-down', variant: "secondary", onClick: () => setExpandAll(!expandAll) }, expandAll ? 'Collapse all' : 'Expand all')),
                    React.createElement(RuleStats, { namespaces: filteredNamespaces })),
                React.createElement(Stack, { direction: "row", gap: 0.5 },
                    React.createElement(MoreActionsRuleButtons, null))))),
        hasNoAlertRulesCreatedYet && React.createElement(NoRulesSplash, null),
        !hasNoAlertRulesCreatedYet && React.createElement(ViewComponent, { expandAll: expandAll, namespaces: filteredNamespaces })));
}, { style: 'page' });
const getStyles = (theme) => ({
    break: css `
    width: 100%;
    height: 0;
    margin-bottom: ${theme.spacing(2)};
    border-bottom: solid 1px ${theme.colors.border.medium};
  `,
    buttonsContainer: css `
    margin-bottom: ${theme.spacing(2)};
    display: flex;
    justify-content: space-between;
  `,
    statsContainer: css `
    display: flex;
    flex-direction: row;
    align-items: center;
  `,
    expandAllButton: css `
    margin-right: ${theme.spacing(1)};
  `,
});
export default RuleList;
//# sourceMappingURL=RuleList.js.map