import { css } from '@emotion/css';
import React, { useState } from 'react';
import { useStyles2 } from '@grafana/ui';
import { AlertState } from 'app/plugins/datasource/alertmanager/types';
import { AlertLabels } from '../AlertLabels';
import { CollapseToggle } from '../CollapseToggle';
import { AlertGroupAlertsTable } from './AlertGroupAlertsTable';
import { AlertGroupHeader } from './AlertGroupHeader';
export const AlertGroup = ({ alertManagerSourceName, group }) => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement("div", { className: styles.header },
            React.createElement("div", { className: styles.group, "data-testid": "alert-group" },
                React.createElement(CollapseToggle, { size: "sm", isCollapsed: isCollapsed, onToggle: () => setIsCollapsed(!isCollapsed), "data-testid": "alert-group-collapse-toggle" }),
                Object.keys(group.labels).length ? (React.createElement(AlertLabels, { labels: group.labels, size: "sm" })) : (React.createElement("span", null, "No grouping"))),
            React.createElement(AlertGroupHeader, { group: group })),
        !isCollapsed && React.createElement(AlertGroupAlertsTable, { alertManagerSourceName: alertManagerSourceName, alerts: group.alerts })));
};
const getStyles = (theme) => ({
    wrapper: css `
    & + & {
      margin-top: ${theme.spacing(2)};
    }
  `,
    header: css `
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    padding: ${theme.spacing(1, 1, 1, 0)};
    background-color: ${theme.colors.background.secondary};
    width: 100%;
  `,
    group: css `
    display: flex;
    flex-direction: row;
    align-items: center;
  `,
    summary: css ``,
    spanElement: css `
    margin-left: ${theme.spacing(0.5)};
  `,
    [AlertState.Active]: css `
    color: ${theme.colors.error.main};
  `,
    [AlertState.Suppressed]: css `
    color: ${theme.colors.primary.main};
  `,
    [AlertState.Unprocessed]: css `
    color: ${theme.colors.secondary.main};
  `,
});
//# sourceMappingURL=AlertGroup.js.map