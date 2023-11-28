import { css } from '@emotion/css';
import React from 'react';
import { dateTime } from '@grafana/data';
import { Alert, Badge, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { alertmanagerApi } from '../../api/alertmanagerApi';
import { isNullDate } from '../../utils/time';
import { AlertLabels } from '../AlertLabels';
import { DynamicTable } from '../DynamicTable';
import { AmAlertStateTag } from './AmAlertStateTag';
export const SilencedInstancesPreview = ({ amSourceName, matchers }) => {
    const { useGetAlertmanagerAlertsQuery } = alertmanagerApi;
    const styles = useStyles2(getStyles);
    const columns = useColumns();
    // By default the form contains an empty matcher - with empty name and value and = operator
    // We don't want to fetch previews for empty matchers as it results in all alerts returned
    const hasValidMatchers = matchers.some((matcher) => matcher.value && matcher.name);
    const { currentData: alerts = [], isFetching, isError, } = useGetAlertmanagerAlertsQuery({ amSourceName, filter: { matchers } }, { skip: !hasValidMatchers, refetchOnMountOrArgChange: true });
    const tableItemAlerts = alerts.map((alert) => ({
        id: alert.fingerprint,
        data: alert,
    }));
    return (React.createElement("div", null,
        React.createElement("h4", { className: styles.title },
            "Affected alert instances",
            tableItemAlerts.length > 0 ? (React.createElement(Badge, { className: styles.badge, color: "blue", text: tableItemAlerts.length })) : null),
        !hasValidMatchers && React.createElement("span", null, "Add a valid matcher to see affected alerts"),
        isError && (React.createElement(Alert, { title: "Preview not available", severity: "error" }, "Error occured when generating affected alerts preview. Are you matchers valid?")),
        isFetching && React.createElement(LoadingPlaceholder, { text: "Loading..." }),
        !isFetching && !isError && hasValidMatchers && (React.createElement("div", { className: styles.table }, tableItemAlerts.length > 0 ? (React.createElement(DynamicTable, { items: tableItemAlerts, isExpandable: false, cols: columns, pagination: { itemsPerPage: 10 } })) : (React.createElement("span", null, "No matching alert instances found"))))));
};
function useColumns() {
    const styles = useStyles2(getStyles);
    return [
        {
            id: 'state',
            label: 'State',
            renderCell: function renderStateTag({ data }) {
                return React.createElement(AmAlertStateTag, { state: data.status.state });
            },
            size: '120px',
            className: styles.stateColumn,
        },
        {
            id: 'labels',
            label: 'Labels',
            renderCell: function renderName({ data }) {
                return React.createElement(AlertLabels, { labels: data.labels, size: "sm" });
            },
            size: 'auto',
        },
        {
            id: 'created',
            label: 'Created',
            renderCell: function renderSummary({ data }) {
                return React.createElement(React.Fragment, null, isNullDate(data.startsAt) ? '-' : dateTime(data.startsAt).format('YYYY-MM-DD HH:mm:ss'));
            },
            size: '180px',
        },
    ];
}
const getStyles = (theme) => ({
    table: css `
    max-width: ${theme.breakpoints.values.lg}px;
  `,
    moreMatches: css `
    margin-top: ${theme.spacing(1)};
  `,
    title: css `
    display: flex;
    align-items: center;
  `,
    badge: css `
    margin-left: ${theme.spacing(1)};
  `,
    stateColumn: css `
    display: flex;
    align-items: center;
  `,
});
//# sourceMappingURL=SilencedInstancesPreview.js.map