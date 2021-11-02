import { __makeTemplateObject, __read } from "tslib";
import { AlertState } from 'app/plugins/datasource/alertmanager/types';
import React, { useState } from 'react';
import { useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { AlertLabels } from '../AlertLabels';
import { AlertGroupAlertsTable } from './AlertGroupAlertsTable';
import { CollapseToggle } from '../CollapseToggle';
import { AlertGroupHeader } from './AlertGroupHeader';
export var AlertGroup = function (_a) {
    var alertManagerSourceName = _a.alertManagerSourceName, group = _a.group;
    var _b = __read(useState(true), 2), isCollapsed = _b[0], setIsCollapsed = _b[1];
    var styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement("div", { className: styles.header },
            React.createElement("div", { className: styles.group, "data-testid": "alert-group" },
                React.createElement(CollapseToggle, { isCollapsed: isCollapsed, onToggle: function () { return setIsCollapsed(!isCollapsed); }, "data-testid": "alert-group-collapse-toggle" }),
                Object.keys(group.labels).length ? (React.createElement(AlertLabels, { className: styles.headerLabels, labels: group.labels })) : (React.createElement("span", null, "No grouping"))),
            React.createElement(AlertGroupHeader, { group: group })),
        !isCollapsed && React.createElement(AlertGroupAlertsTable, { alertManagerSourceName: alertManagerSourceName, alerts: group.alerts })));
};
var getStyles = function (theme) {
    var _a;
    return (_a = {
            wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    & + & {\n      margin-top: ", ";\n    }\n  "], ["\n    & + & {\n      margin-top: ", ";\n    }\n  "])), theme.spacing(2)),
            headerLabels: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    padding-bottom: 0 !important;\n    margin-bottom: -", ";\n  "], ["\n    padding-bottom: 0 !important;\n    margin-bottom: -", ";\n  "])), theme.spacing(0.5)),
            header: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: row;\n    flex-wrap: wrap;\n    align-items: center;\n    justify-content: space-between;\n    padding: ", ";\n    background-color: ", ";\n    width: 100%;\n  "], ["\n    display: flex;\n    flex-direction: row;\n    flex-wrap: wrap;\n    align-items: center;\n    justify-content: space-between;\n    padding: ", ";\n    background-color: ", ";\n    width: 100%;\n  "])), theme.spacing(1, 1, 1, 0), theme.colors.background.secondary),
            group: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: row;\n    align-items: center;\n  "], ["\n    display: flex;\n    flex-direction: row;\n    align-items: center;\n  "]))),
            summary: css(templateObject_5 || (templateObject_5 = __makeTemplateObject([""], [""]))),
            spanElement: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n    margin-left: ", ";\n  "], ["\n    margin-left: ", ";\n  "])), theme.spacing(0.5))
        },
        _a[AlertState.Active] = css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.colors.error.main),
        _a[AlertState.Suppressed] = css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.colors.primary.main),
        _a[AlertState.Unprocessed] = css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.colors.secondary.main),
        _a);
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9;
//# sourceMappingURL=AlertGroup.js.map