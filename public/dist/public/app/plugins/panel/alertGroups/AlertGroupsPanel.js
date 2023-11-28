import React, { useEffect } from 'react';
import { config } from '@grafana/runtime';
import { CustomScrollbar } from '@grafana/ui';
import { useUnifiedAlertingSelector } from 'app/features/alerting/unified/hooks/useUnifiedAlertingSelector';
import { fetchAlertGroupsAction } from 'app/features/alerting/unified/state/actions';
import { parseMatchers } from 'app/features/alerting/unified/utils/alertmanager';
import { NOTIFICATIONS_POLL_INTERVAL_MS } from 'app/features/alerting/unified/utils/constants';
import { initialAsyncRequestState } from 'app/features/alerting/unified/utils/redux';
import { useDispatch } from 'app/types';
import { AlertGroup } from './AlertGroup';
import { useFilteredGroups } from './useFilteredGroups';
export const AlertGroupsPanel = (props) => {
    var _a;
    const dispatch = useDispatch();
    const isAlertingEnabled = config.unifiedAlertingEnabled;
    const expandAll = props.options.expandAll;
    const alertManagerSourceName = props.options.alertmanager;
    const alertGroups = useUnifiedAlertingSelector((state) => state.amAlertGroups) || initialAsyncRequestState;
    const results = ((_a = alertGroups[alertManagerSourceName || '']) === null || _a === void 0 ? void 0 : _a.result) || [];
    const matchers = props.options.labels ? parseMatchers(props.options.labels) : [];
    const filteredResults = useFilteredGroups(results, matchers);
    useEffect(() => {
        function fetchNotifications() {
            if (alertManagerSourceName) {
                dispatch(fetchAlertGroupsAction(alertManagerSourceName));
            }
        }
        fetchNotifications();
        const interval = setInterval(fetchNotifications, NOTIFICATIONS_POLL_INTERVAL_MS);
        return () => {
            clearInterval(interval);
        };
    }, [dispatch, alertManagerSourceName]);
    const hasResults = filteredResults.length > 0;
    return (React.createElement(CustomScrollbar, { autoHeightMax: "100%", autoHeightMin: "100%" }, isAlertingEnabled && (React.createElement("div", null,
        hasResults &&
            filteredResults.map((group) => {
                return (React.createElement(AlertGroup, { alertManagerSourceName: alertManagerSourceName, key: JSON.stringify(group.labels), group: group, expandAll: expandAll }));
            }),
        !hasResults && 'No alerts'))));
};
//# sourceMappingURL=AlertGroupsPanel.js.map