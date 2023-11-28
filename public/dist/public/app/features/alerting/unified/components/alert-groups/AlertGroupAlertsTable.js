import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { intervalToAbbreviatedDurationString } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { AlertLabels } from '../AlertLabels';
import { DynamicTableWithGuidelines } from '../DynamicTableWithGuidelines';
import { AmAlertStateTag } from '../silences/AmAlertStateTag';
import { AlertDetails } from './AlertDetails';
export const AlertGroupAlertsTable = ({ alerts, alertManagerSourceName }) => {
    const styles = useStyles2(getStyles);
    const columns = useMemo(() => [
        {
            id: 'state',
            label: 'State',
            // eslint-disable-next-line react/display-name
            renderCell: ({ data: alert }) => (React.createElement(React.Fragment, null,
                React.createElement(AmAlertStateTag, { state: alert.status.state }),
                React.createElement("span", { className: styles.duration },
                    "for",
                    ' ',
                    intervalToAbbreviatedDurationString({
                        start: new Date(alert.startsAt),
                        end: new Date(alert.endsAt),
                    })))),
            size: '220px',
        },
        {
            id: 'labels',
            label: 'Labels',
            // eslint-disable-next-line react/display-name
            renderCell: ({ data: { labels } }) => React.createElement(AlertLabels, { labels: labels, size: "sm" }),
            size: 1,
        },
    ], [styles]);
    const items = useMemo(() => alerts.map((alert) => ({
        id: alert.fingerprint,
        data: alert,
    })), [alerts]);
    return (React.createElement("div", { className: styles.tableWrapper, "data-testid": "alert-group-table" },
        React.createElement(DynamicTableWithGuidelines, { cols: columns, items: items, isExpandable: true, renderExpandedContent: ({ data: alert }) => (React.createElement(AlertDetails, { alert: alert, alertManagerSourceName: alertManagerSourceName })) })));
};
const getStyles = (theme) => ({
    tableWrapper: css `
    margin-top: ${theme.spacing(3)};
    ${theme.breakpoints.up('md')} {
      margin-left: ${theme.spacing(4.5)};
    }
  `,
    duration: css `
    margin-left: ${theme.spacing(1)};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
});
//# sourceMappingURL=AlertGroupAlertsTable.js.map