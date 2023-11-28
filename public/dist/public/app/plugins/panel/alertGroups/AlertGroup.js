import { css } from '@emotion/css';
import React, { useState, useEffect } from 'react';
import { intervalToAbbreviatedDurationString } from '@grafana/data';
import { useStyles2, LinkButton } from '@grafana/ui';
import { AlertLabels } from 'app/features/alerting/unified/components/AlertLabels';
import { CollapseToggle } from 'app/features/alerting/unified/components/CollapseToggle';
import { AlertGroupHeader } from 'app/features/alerting/unified/components/alert-groups/AlertGroupHeader';
import { getNotificationsTextColors } from 'app/features/alerting/unified/styles/notifications';
import { makeAMLink, makeLabelBasedSilenceLink } from 'app/features/alerting/unified/utils/misc';
import { AlertState } from 'app/plugins/datasource/alertmanager/types';
export const AlertGroup = ({ alertManagerSourceName, group, expandAll }) => {
    const [showAlerts, setShowAlerts] = useState(expandAll);
    const styles = useStyles2(getStyles);
    const textStyles = useStyles2(getNotificationsTextColors);
    useEffect(() => setShowAlerts(expandAll), [expandAll]);
    return (React.createElement("div", { className: styles.group, "data-testid": "alert-group" },
        Object.keys(group.labels).length > 0 ? (React.createElement(AlertLabels, { labels: group.labels, size: "sm" })) : (React.createElement("div", { className: styles.noGroupingText }, "No grouping")),
        React.createElement("div", { className: styles.row },
            React.createElement(CollapseToggle, { isCollapsed: !showAlerts, onToggle: () => setShowAlerts(!showAlerts) }),
            ' ',
            React.createElement(AlertGroupHeader, { group: group })),
        showAlerts && (React.createElement("div", { className: styles.alerts }, group.alerts.map((alert, index) => {
            const state = alert.status.state.toUpperCase();
            const interval = intervalToAbbreviatedDurationString({
                start: new Date(alert.startsAt),
                end: Date.now(),
            });
            return (React.createElement("div", { "data-testid": 'alert-group-alert', className: styles.alert, key: `${alert.fingerprint}-${index}` },
                React.createElement("div", null,
                    React.createElement("span", { className: textStyles[alert.status.state] },
                        state,
                        " "),
                    "for ",
                    interval),
                React.createElement("div", null,
                    React.createElement(AlertLabels, { labels: alert.labels, size: "sm" })),
                React.createElement("div", { className: styles.actionsRow },
                    alert.status.state === AlertState.Suppressed && (React.createElement(LinkButton, { href: `${makeAMLink('/alerting/silences', alertManagerSourceName)}&silenceIds=${alert.status.silencedBy.join(',')}`, className: styles.button, icon: 'bell', size: 'sm' }, "Manage silences")),
                    alert.status.state === AlertState.Active && (React.createElement(LinkButton, { href: makeLabelBasedSilenceLink(alertManagerSourceName, alert.labels), className: styles.button, icon: 'bell-slash', size: 'sm' }, "Silence")),
                    alert.generatorURL && (React.createElement(LinkButton, { className: styles.button, href: alert.generatorURL, icon: 'chart-line', size: 'sm' }, "See source")))));
        })))));
};
const getStyles = (theme) => ({
    noGroupingText: css `
    height: ${theme.spacing(4)};
  `,
    group: css `
    background-color: ${theme.colors.background.secondary};
    margin: ${theme.spacing(0.5, 1, 0.5, 1)};
    padding: ${theme.spacing(1)};
  `,
    row: css `
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: ${theme.spacing(1)};
  `,
    alerts: css `
    margin: ${theme.spacing(0, 2, 0, 4)};
  `,
    alert: css `
    padding: ${theme.spacing(1, 0)};
    & + & {
      border-top: 1px solid ${theme.colors.border.medium};
    }
  `,
    button: css `
    & + & {
      margin-left: ${theme.spacing(1)};
    }
  `,
    actionsRow: css `
    padding: ${theme.spacing(1, 0)};
  `,
});
//# sourceMappingURL=AlertGroup.js.map