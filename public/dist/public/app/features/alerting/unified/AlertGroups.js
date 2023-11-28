import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { Alert, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { useDispatch } from 'app/types';
import { AlertmanagerChoice } from '../../../plugins/datasource/alertmanager/types';
import { alertmanagerApi } from './api/alertmanagerApi';
import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';
import { AlertGroup } from './components/alert-groups/AlertGroup';
import { AlertGroupFilter } from './components/alert-groups/AlertGroupFilter';
import { useFilteredAmGroups } from './hooks/useFilteredAmGroups';
import { useGroupedAlerts } from './hooks/useGroupedAlerts';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { useAlertmanager } from './state/AlertmanagerContext';
import { fetchAlertGroupsAction } from './state/actions';
import { NOTIFICATIONS_POLL_INTERVAL_MS } from './utils/constants';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import { getFiltersFromUrlParams } from './utils/misc';
import { initialAsyncRequestState } from './utils/redux';
const AlertGroups = () => {
    var _a;
    const { useGetAlertmanagerChoiceStatusQuery } = alertmanagerApi;
    const { selectedAlertmanager } = useAlertmanager();
    const dispatch = useDispatch();
    const [queryParams] = useQueryParams();
    const { groupBy = [] } = getFiltersFromUrlParams(queryParams);
    const styles = useStyles2(getStyles);
    const { currentData: amConfigStatus } = useGetAlertmanagerChoiceStatusQuery();
    const alertGroups = useUnifiedAlertingSelector((state) => state.amAlertGroups);
    const { loading, error, result: results = [] } = (_a = alertGroups[selectedAlertmanager || '']) !== null && _a !== void 0 ? _a : initialAsyncRequestState;
    const groupedAlerts = useGroupedAlerts(results, groupBy);
    const filteredAlertGroups = useFilteredAmGroups(groupedAlerts);
    const grafanaAmDeliveryDisabled = selectedAlertmanager === GRAFANA_RULES_SOURCE_NAME &&
        (amConfigStatus === null || amConfigStatus === void 0 ? void 0 : amConfigStatus.alertmanagersChoice) === AlertmanagerChoice.External;
    useEffect(() => {
        function fetchNotifications() {
            if (selectedAlertmanager) {
                dispatch(fetchAlertGroupsAction(selectedAlertmanager));
            }
        }
        fetchNotifications();
        const interval = setInterval(fetchNotifications, NOTIFICATIONS_POLL_INTERVAL_MS);
        return () => {
            clearInterval(interval);
        };
    }, [dispatch, selectedAlertmanager]);
    return (React.createElement(React.Fragment, null,
        React.createElement(AlertGroupFilter, { groups: results }),
        loading && React.createElement(LoadingPlaceholder, { text: "Loading notifications" }),
        error && !loading && (React.createElement(Alert, { title: 'Error loading notifications', severity: 'error' }, error.message || 'Unknown error')),
        grafanaAmDeliveryDisabled && (React.createElement(Alert, { title: "Grafana alerts are not delivered to Grafana Alertmanager" }, "Grafana is configured to send alerts to external alertmanagers only. No alerts are expected to be available here for the selected Alertmanager.")),
        results &&
            filteredAlertGroups.map((group, index) => {
                return (React.createElement(React.Fragment, { key: `${JSON.stringify(group.labels)}-group-${index}` },
                    ((index === 1 && Object.keys(filteredAlertGroups[0].labels).length === 0) ||
                        (index === 0 && Object.keys(group.labels).length > 0)) && (React.createElement("p", { className: styles.groupingBanner },
                        "Grouped by: ",
                        Object.keys(group.labels).join(', '))),
                    React.createElement(AlertGroup, { alertManagerSourceName: selectedAlertmanager || '', group: group })));
            }),
        results && !filteredAlertGroups.length && React.createElement("p", null, "No results.")));
};
const AlertGroupsPage = () => (React.createElement(AlertmanagerPageWrapper, { pageId: "groups", accessType: "instance" },
    React.createElement(AlertGroups, null)));
const getStyles = (theme) => ({
    groupingBanner: css `
    margin: ${theme.spacing(2, 0)};
  `,
});
export default AlertGroupsPage;
//# sourceMappingURL=AlertGroups.js.map