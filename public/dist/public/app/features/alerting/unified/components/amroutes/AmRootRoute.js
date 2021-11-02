import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { Button, useStyles2 } from '@grafana/ui';
import { AmRootRouteForm } from './AmRootRouteForm';
import { AmRootRouteRead } from './AmRootRouteRead';
import { isVanillaPrometheusAlertManagerDataSource } from '../../utils/datasource';
export var AmRootRoute = function (_a) {
    var isEditMode = _a.isEditMode, onSave = _a.onSave, onEnterEditMode = _a.onEnterEditMode, onExitEditMode = _a.onExitEditMode, receivers = _a.receivers, routes = _a.routes, alertManagerSourceName = _a.alertManagerSourceName;
    var styles = useStyles2(getStyles);
    var isReadOnly = isVanillaPrometheusAlertManagerDataSource(alertManagerSourceName);
    return (React.createElement("div", { className: styles.container, "data-testid": "am-root-route-container" },
        React.createElement("div", { className: styles.titleContainer },
            React.createElement("h5", { className: styles.title },
                "Root policy - ",
                React.createElement("i", null, "default for all alerts")),
            !isEditMode && !isReadOnly && (React.createElement(Button, { icon: "pen", onClick: onEnterEditMode, size: "sm", type: "button", variant: "secondary" }, "Edit"))),
        React.createElement("p", null, "All alerts will go to the default contact point, unless you set additional matchers in the specific routing area."),
        isEditMode ? (React.createElement(AmRootRouteForm, { alertManagerSourceName: alertManagerSourceName, onCancel: onExitEditMode, onSave: onSave, receivers: receivers, routes: routes })) : (React.createElement(AmRootRouteRead, { routes: routes }))));
};
var getStyles = function (theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      background-color: ", ";\n      color: ", ";\n      padding: ", ";\n    "], ["\n      background-color: ", ";\n      color: ", ";\n      padding: ", ";\n    "])), theme.colors.background.secondary, theme.colors.text.secondary, theme.spacing(2)),
        titleContainer: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      color: ", ";\n      display: flex;\n      flex-flow: row nowrap;\n    "], ["\n      color: ", ";\n      display: flex;\n      flex-flow: row nowrap;\n    "])), theme.colors.text.primary),
        title: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      flex: 100%;\n    "], ["\n      flex: 100%;\n    "]))),
    };
};
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=AmRootRoute.js.map