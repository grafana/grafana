import { css, cx } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { getAlertTableStyles } from '../../styles/table';
import { SilencedAlertsTableRow } from './SilencedAlertsTableRow';
const SilencedAlertsTable = ({ silencedAlerts }) => {
    const tableStyles = useStyles2(getAlertTableStyles);
    const styles = useStyles2(getStyles);
    if (!!silencedAlerts.length) {
        return (React.createElement("table", { className: cx(tableStyles.table, styles.tableMargin) },
            React.createElement("colgroup", null,
                React.createElement("col", { className: tableStyles.colExpand }),
                React.createElement("col", { className: styles.colState }),
                React.createElement("col", null),
                React.createElement("col", { className: styles.colName })),
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", null),
                    React.createElement("th", null, "State"),
                    React.createElement("th", null),
                    React.createElement("th", null, "Alert name"))),
            React.createElement("tbody", null, silencedAlerts.map((alert, index) => {
                return (React.createElement(SilencedAlertsTableRow, { key: alert.fingerprint, alert: alert, className: index % 2 === 0 ? tableStyles.evenRow : '' }));
            }))));
    }
    else {
        return null;
    }
};
const getStyles = (theme) => ({
    tableMargin: css `
    margin-bottom: ${theme.spacing(1)};
  `,
    colState: css `
    width: 110px;
  `,
    colName: css `
    width: 65%;
  `,
});
export default SilencedAlertsTable;
//# sourceMappingURL=SilencedAlertsTable.js.map