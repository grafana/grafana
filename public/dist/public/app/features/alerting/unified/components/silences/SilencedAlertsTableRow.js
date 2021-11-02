import { __read } from "tslib";
import React, { useState } from 'react';
import { CollapseToggle } from '../CollapseToggle';
import { ActionIcon } from '../rules/ActionIcon';
import { getAlertTableStyles } from '../../styles/table';
import { useStyles2 } from '@grafana/ui';
import { intervalToAbbreviatedDurationString } from '@grafana/data';
import { AlertLabels } from '../AlertLabels';
import { AmAlertStateTag } from './AmAlertStateTag';
export var SilencedAlertsTableRow = function (_a) {
    var alert = _a.alert, className = _a.className;
    var _b = __read(useState(true), 2), isCollapsed = _b[0], setIsCollapsed = _b[1];
    var tableStyles = useStyles2(getAlertTableStyles);
    var duration = intervalToAbbreviatedDurationString({
        start: new Date(alert.startsAt),
        end: new Date(alert.endsAt),
    });
    var alertName = Object.entries(alert.labels).reduce(function (name, _a) {
        var _b = __read(_a, 2), labelKey = _b[0], labelValue = _b[1];
        if (labelKey === 'alertname' || labelKey === '__alert_rule_title__') {
            name = labelValue;
        }
        return name;
    }, '');
    return (React.createElement(React.Fragment, null,
        React.createElement("tr", { className: className },
            React.createElement("td", null,
                React.createElement(CollapseToggle, { isCollapsed: isCollapsed, onToggle: function (collapsed) { return setIsCollapsed(collapsed); } })),
            React.createElement("td", null,
                React.createElement(AmAlertStateTag, { state: alert.status.state })),
            React.createElement("td", null,
                "for ",
                duration,
                " seconds"),
            React.createElement("td", null, alertName),
            React.createElement("td", { className: tableStyles.actionsCell },
                React.createElement(ActionIcon, { icon: "chart-line", to: alert.generatorURL, tooltip: "View in explorer" }))),
        !isCollapsed && (React.createElement("tr", { className: className },
            React.createElement("td", null),
            React.createElement("td", { colSpan: 5 },
                React.createElement(AlertLabels, { labels: alert.labels }))))));
};
//# sourceMappingURL=SilencedAlertsTableRow.js.map