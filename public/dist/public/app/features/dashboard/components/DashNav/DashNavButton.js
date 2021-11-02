import { __makeTemplateObject } from "tslib";
// Libraries
import React from 'react';
import { css } from '@emotion/css';
// Components
import { IconButton, useTheme, stylesFactory } from '@grafana/ui';
export var DashNavButton = function (_a) {
    var icon = _a.icon, iconType = _a.iconType, iconSize = _a.iconSize, tooltip = _a.tooltip, onClick = _a.onClick, children = _a.children;
    var theme = useTheme();
    var styles = getStyles(theme);
    return (React.createElement("div", { className: styles.noBorderContainer },
        icon && (React.createElement(IconButton, { name: icon, size: iconSize, iconType: iconType, tooltip: tooltip, tooltipPlacement: "bottom", onClick: onClick })),
        children));
};
var getStyles = stylesFactory(function (theme) { return ({
    noBorderContainer: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    padding: 0 ", ";\n    display: flex;\n  "], ["\n    padding: 0 ", ";\n    display: flex;\n  "])), theme.spacing.xs),
}); });
var templateObject_1;
//# sourceMappingURL=DashNavButton.js.map