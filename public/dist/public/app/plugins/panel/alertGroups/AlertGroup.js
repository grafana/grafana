import { __makeTemplateObject, __read } from "tslib";
import { AlertState } from 'app/plugins/datasource/alertmanager/types';
import React, { useState, useEffect } from 'react';
import { intervalToAbbreviatedDurationString } from '@grafana/data';
import { useStyles2, LinkButton } from '@grafana/ui';
import { css } from '@emotion/css';
import { AlertLabels } from 'app/features/alerting/unified/components/AlertLabels';
import { AlertGroupHeader } from 'app/features/alerting/unified/components/alert-groups/AlertGroupHeader';
import { CollapseToggle } from 'app/features/alerting/unified/components/CollapseToggle';
import { getNotificationsTextColors } from 'app/features/alerting/unified/styles/notifications';
import { makeAMLink } from 'app/features/alerting/unified/utils/misc';
import { getMatcherQueryParams } from 'app/features/alerting/unified/utils/matchers';
export var AlertGroup = function (_a) {
    var alertManagerSourceName = _a.alertManagerSourceName, group = _a.group, expandAll = _a.expandAll;
    var _b = __read(useState(expandAll), 2), showAlerts = _b[0], setShowAlerts = _b[1];
    var styles = useStyles2(getStyles);
    var textStyles = useStyles2(getNotificationsTextColors);
    useEffect(function () { return setShowAlerts(expandAll); }, [expandAll]);
    return (React.createElement("div", { className: styles.group, "data-testid": "alert-group" },
        Object.keys(group.labels).length > 0 ? (React.createElement(AlertLabels, { labels: group.labels })) : (React.createElement("div", { className: styles.noGroupingText }, "No grouping")),
        React.createElement("div", { className: styles.row },
            React.createElement(CollapseToggle, { isCollapsed: !showAlerts, onToggle: function () { return setShowAlerts(!showAlerts); } }),
            ' ',
            React.createElement(AlertGroupHeader, { group: group })),
        showAlerts && (React.createElement("div", { className: styles.alerts }, group.alerts.map(function (alert, index) {
            var state = alert.status.state.toUpperCase();
            var interval = intervalToAbbreviatedDurationString({
                start: new Date(alert.startsAt),
                end: Date.now(),
            });
            return (React.createElement("div", { "data-testid": 'alert-group-alert', className: styles.alert, key: alert.fingerprint + "-" + index },
                React.createElement("div", null,
                    React.createElement("span", { className: textStyles[alert.status.state] },
                        state,
                        " "),
                    "for ",
                    interval),
                React.createElement("div", null,
                    React.createElement(AlertLabels, { labels: alert.labels })),
                React.createElement("div", { className: styles.actionsRow },
                    alert.status.state === AlertState.Suppressed && (React.createElement(LinkButton, { href: makeAMLink('/alerting/silences', alertManagerSourceName) + "&silenceIds=" + alert.status.silencedBy.join(','), className: styles.button, icon: 'bell', size: 'sm' }, "Manage silences")),
                    alert.status.state === AlertState.Active && (React.createElement(LinkButton, { href: makeAMLink('/alerting/silence/new', alertManagerSourceName) + "&" + getMatcherQueryParams(alert.labels), className: styles.button, icon: 'bell-slash', size: 'sm' }, "Silence")),
                    alert.generatorURL && (React.createElement(LinkButton, { className: styles.button, href: alert.generatorURL, icon: 'chart-line', size: 'sm' }, "See source")))));
        })))));
};
var getStyles = function (theme) { return ({
    noGroupingText: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    height: ", ";\n  "], ["\n    height: ", ";\n  "])), theme.spacing(4)),
    group: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    background-color: ", ";\n    margin: ", ";\n    padding: ", ";\n  "], ["\n    background-color: ", ";\n    margin: ", ";\n    padding: ", ";\n  "])), theme.colors.background.secondary, theme.spacing(0.5, 1, 0.5, 1), theme.spacing(1)),
    row: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: row;\n    align-items: center;\n  "], ["\n    display: flex;\n    flex-direction: row;\n    align-items: center;\n  "]))),
    alerts: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    margin: ", ";\n  "], ["\n    margin: ", ";\n  "])), theme.spacing(0, 2, 0, 4)),
    alert: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    padding: ", ";\n    & + & {\n      border-top: 1px solid ", ";\n    }\n  "], ["\n    padding: ", ";\n    & + & {\n      border-top: 1px solid ", ";\n    }\n  "])), theme.spacing(1, 0), theme.colors.border.medium),
    button: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n    & + & {\n      margin-left: ", ";\n    }\n  "], ["\n    & + & {\n      margin-left: ", ";\n    }\n  "])), theme.spacing(1)),
    actionsRow: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n    padding: ", ";\n  "], ["\n    padding: ", ";\n  "])), theme.spacing(1, 0)),
}); };
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7;
//# sourceMappingURL=AlertGroup.js.map