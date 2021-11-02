import { __makeTemplateObject } from "tslib";
import { IconButton, useStyles2 } from '@grafana/ui';
import React from 'react';
import { css, cx } from '@emotion/css';
import { selectors } from '@grafana/e2e-selectors';
export var QueryOperationAction = function (_a) {
    var icon = _a.icon, active = _a.active, disabled = _a.disabled, title = _a.title, onClick = _a.onClick;
    var styles = useStyles2(getStyles);
    return (React.createElement("div", { className: cx(styles.icon, active && styles.active) },
        React.createElement(IconButton, { name: icon, title: title, className: styles.icon, disabled: !!disabled, onClick: onClick, surface: "header", type: "button", "aria-label": selectors.components.QueryEditorRow.actionButton(title) })));
};
QueryOperationAction.displayName = 'QueryOperationAction';
var getStyles = function (theme) {
    return {
        icon: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      position: relative;\n      color: ", ";\n    "], ["\n      display: flex;\n      position: relative;\n      color: ", ";\n    "])), theme.colors.text.secondary),
        active: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      &::before {\n        display: block;\n        content: ' ';\n        position: absolute;\n        left: -1px;\n        right: 2px;\n        height: 3px;\n        border-radius: 2px;\n        bottom: -8px;\n        background-image: ", " !important;\n      }\n    "], ["\n      &::before {\n        display: block;\n        content: ' ';\n        position: absolute;\n        left: -1px;\n        right: 2px;\n        height: 3px;\n        border-radius: 2px;\n        bottom: -8px;\n        background-image: ", " !important;\n      }\n    "])), theme.colors.gradients.brandHorizontal),
    };
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=QueryOperationAction.js.map