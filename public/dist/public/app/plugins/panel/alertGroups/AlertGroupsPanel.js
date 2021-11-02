import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { CustomScrollbar } from '@grafana/ui';
import { config } from '@grafana/runtime';
import { fetchAlertGroupsAction } from 'app/features/alerting/unified/state/actions';
import { initialAsyncRequestState } from 'app/features/alerting/unified/utils/redux';
import { NOTIFICATIONS_POLL_INTERVAL_MS } from 'app/features/alerting/unified/utils/constants';
import { useUnifiedAlertingSelector } from 'app/features/alerting/unified/hooks/useUnifiedAlertingSelector';
import { AlertGroup } from './AlertGroup';
import { parseMatchers } from 'app/features/alerting/unified/utils/alertmanager';
import { useFilteredGroups } from './useFilteredGroups';
export var AlertGroupsPanel = function (props) {
    var _a;
    var dispatch = useDispatch();
    var isAlertingEnabled = config.unifiedAlertingEnabled;
    var expandAll = props.options.expandAll;
    var alertManagerSourceName = props.options.alertmanager;
    var alertGroups = useUnifiedAlertingSelector(function (state) { return state.amAlertGroups; }) || initialAsyncRequestState;
    var results = ((_a = alertGroups[alertManagerSourceName || '']) === null || _a === void 0 ? void 0 : _a.result) || [];
    var matchers = props.options.labels ? parseMatchers(props.options.labels) : [];
    var filteredResults = useFilteredGroups(results, matchers);
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
    var hasResults = filteredResults.length > 0;
    return (React.createElement(CustomScrollbar, { autoHeightMax: "100%", autoHeightMin: "100%" }, isAlertingEnabled && (React.createElement("div", null,
        hasResults &&
            filteredResults.map(function (group) {
                return (React.createElement(AlertGroup, { alertManagerSourceName: alertManagerSourceName, key: JSON.stringify(group.labels), group: group, expandAll: expandAll }));
            }),
        !hasResults && 'No alerts'))));
};
//# sourceMappingURL=AlertGroupsPanel.js.map