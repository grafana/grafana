import { __makeTemplateObject, __read } from "tslib";
import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Alert, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { AlertGroup } from './components/alert-groups/AlertGroup';
import { AlertGroupFilter } from './components/alert-groups/AlertGroupFilter';
import { fetchAlertGroupsAction } from './state/actions';
import { initialAsyncRequestState } from './utils/redux';
import { getFiltersFromUrlParams } from './utils/misc';
import { NOTIFICATIONS_POLL_INTERVAL_MS } from './utils/constants';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { useGroupedAlerts } from './hooks/useGroupedAlerts';
import { useFilteredAmGroups } from './hooks/useFilteredAmGroups';
import { css } from '@emotion/css';
var AlertGroups = function () {
    var _a;
    var _b = __read(useAlertManagerSourceName(), 1), alertManagerSourceName = _b[0];
    var dispatch = useDispatch();
    var _c = __read(useQueryParams(), 1), queryParams = _c[0];
    var _d = getFiltersFromUrlParams(queryParams).groupBy, groupBy = _d === void 0 ? [] : _d;
    var styles = useStyles2(getStyles);
    var alertGroups = useUnifiedAlertingSelector(function (state) { return state.amAlertGroups; });
    var _e = (_a = alertGroups[alertManagerSourceName || '']) !== null && _a !== void 0 ? _a : initialAsyncRequestState, loading = _e.loading, error = _e.error, _f = _e.result, results = _f === void 0 ? [] : _f;
    var groupedAlerts = useGroupedAlerts(results, groupBy);
    var filteredAlertGroups = useFilteredAmGroups(groupedAlerts);
    useEffect(function () {
        function fetchNotifications() {
            if (alertManagerSourceName) {
                dispatch(fetchAlertGroupsAction(alertManagerSourceName));
            }
        }
        fetchNotifications();
        var interval = setInterval(fetchNotifications, NOTIFICATIONS_POLL_INTERVAL_MS);
        return function () {
            clearInterval(interval);
        };
    }, [dispatch, alertManagerSourceName]);
    return (React.createElement(AlertingPageWrapper, { pageId: "groups" },
        React.createElement(AlertGroupFilter, { groups: results }),
        loading && React.createElement(LoadingPlaceholder, { text: "Loading notifications" }),
        error && !loading && (React.createElement(Alert, { title: 'Error loading notifications', severity: 'error' }, error.message || 'Unknown error')),
        results &&
            filteredAlertGroups.map(function (group, index) {
                return (React.createElement(React.Fragment, { key: JSON.stringify(group.labels) + "-group-" + index },
                    ((index === 1 && Object.keys(filteredAlertGroups[0].labels).length === 0) ||
                        (index === 0 && Object.keys(group.labels).length > 0)) && (React.createElement("p", { className: styles.groupingBanner },
                        "Grouped by: ",
                        Object.keys(group.labels).join(', '))),
                    React.createElement(AlertGroup, { alertManagerSourceName: alertManagerSourceName || '', group: group })));
            }),
        results && !filteredAlertGroups.length && React.createElement("p", null, "No results.")));
};
var getStyles = function (theme) { return ({
    groupingBanner: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin: ", ";\n  "], ["\n    margin: ", ";\n  "])), theme.spacing(2, 0)),
}); };
export default AlertGroups;
var templateObject_1;
//# sourceMappingURL=AlertGroups.js.map