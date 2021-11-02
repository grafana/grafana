import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { Alert, Field, Modal, useStyles2 } from '@grafana/ui';
export function ApiKeysAddedModal(_a) {
    var onDismiss = _a.onDismiss, apiKey = _a.apiKey, rootPath = _a.rootPath;
    var styles = useStyles2(getStyles);
    return (React.createElement(Modal, { title: "API Key Created", onDismiss: onDismiss, onClickBackdrop: onDismiss, isOpen: true },
        React.createElement(Field, { label: "Key" },
            React.createElement("span", { className: styles.label }, apiKey)),
        React.createElement(Alert, { severity: "info", title: "You will only be able to view this key here once!" }, "It is not stored in this form, so be sure to copy it now."),
        React.createElement("p", { className: "text-muted" }, "You can authenticate a request using the Authorization HTTP header, example:"),
        React.createElement("pre", { className: styles.small },
            "curl -H \"Authorization: Bearer ",
            apiKey,
            "\" ",
            rootPath,
            "/api/dashboards/home")));
}
function getStyles(theme) {
    return {
        label: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      padding: ", ";\n      background-color: ", ";\n      border-radius: ", ";\n    "], ["\n      padding: ", ";\n      background-color: ", ";\n      border-radius: ", ";\n    "])), theme.spacing(1), theme.colors.background.secondary, theme.shape.borderRadius()),
        small: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      font-size: ", ";\n      font-weight: ", ";\n    "], ["\n      font-size: ", ";\n      font-weight: ", ";\n    "])), theme.typography.bodySmall.fontSize, theme.typography.bodySmall.fontWeight),
    };
}
var templateObject_1, templateObject_2;
//# sourceMappingURL=ApiKeysAddedModal.js.map