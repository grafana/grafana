import React, { useState } from 'react';
import { intervalToAbbreviatedDurationString } from '@grafana/data';
import { AlertLabels } from '../AlertLabels';
import { CollapseToggle } from '../CollapseToggle';
import { AmAlertStateTag } from './AmAlertStateTag';
export const SilencedAlertsTableRow = ({ alert, className }) => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const duration = intervalToAbbreviatedDurationString({
        start: new Date(alert.startsAt),
        end: new Date(alert.endsAt),
    });
    const alertName = Object.entries(alert.labels).reduce((name, [labelKey, labelValue]) => {
        if (labelKey === 'alertname' || labelKey === '__alert_rule_title__') {
            name = labelValue;
        }
        return name;
    }, '');
    return (React.createElement(React.Fragment, null,
        React.createElement("tr", { className: className },
            React.createElement("td", null,
                React.createElement(CollapseToggle, { isCollapsed: isCollapsed, onToggle: (collapsed) => setIsCollapsed(collapsed) })),
            React.createElement("td", null,
                React.createElement(AmAlertStateTag, { state: alert.status.state })),
            React.createElement("td", null,
                "for ",
                duration,
                " seconds"),
            React.createElement("td", null, alertName)),
        !isCollapsed && (React.createElement("tr", { className: className },
            React.createElement("td", null),
            React.createElement("td", { colSpan: 5 },
                React.createElement(AlertLabels, { labels: alert.labels, size: "sm" }))))));
};
//# sourceMappingURL=SilencedAlertsTableRow.js.map