import { __assign, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { Icon } from '../Icon/Icon';
import { useTheme } from '../../themes/ThemeContext';
import { stylesFactory } from '../../themes/stylesFactory';
import { Tooltip } from '../Tooltip/Tooltip';
import { getColorForTheme } from '@grafana/data';
import tinycolor from 'tinycolor2';
import { css, cx } from '@emotion/css';
import { HorizontalGroup } from '../Layout/Layout';
export var Badge = React.memo(function (_a) {
    var icon = _a.icon, color = _a.color, text = _a.text, tooltip = _a.tooltip, className = _a.className, otherProps = __rest(_a, ["icon", "color", "text", "tooltip", "className"]);
    var theme = useTheme();
    var styles = getStyles(theme, color);
    var badge = (React.createElement("div", __assign({ className: cx(styles.wrapper, className) }, otherProps),
        React.createElement(HorizontalGroup, { align: "center", spacing: "xs" },
            icon && React.createElement(Icon, { name: icon, size: "sm" }),
            React.createElement("span", null, text))));
    return tooltip ? (React.createElement(Tooltip, { content: tooltip, placement: "auto" }, badge)) : (badge);
});
Badge.displayName = 'Badge';
var getStyles = stylesFactory(function (theme, color) {
    var sourceColor = getColorForTheme(color, theme);
    var borderColor = '';
    var bgColor = '';
    var textColor = '';
    if (theme.isDark) {
        bgColor = tinycolor(sourceColor).setAlpha(0.15).toString();
        borderColor = tinycolor(sourceColor).darken(30).toString();
        textColor = tinycolor(sourceColor).lighten(15).toString();
    }
    else {
        bgColor = tinycolor(sourceColor).setAlpha(0.15).toString();
        borderColor = tinycolor(sourceColor).lighten(20).toString();
        textColor = tinycolor(sourceColor).darken(15).toString();
    }
    return {
        wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      font-size: ", ";\n      display: inline-flex;\n      padding: 1px 4px;\n      border-radius: 3px;\n      background: ", ";\n      border: 1px solid ", ";\n      color: ", ";\n      font-weight: ", ";\n\n      > span {\n        position: relative;\n        top: 1px;\n        margin-left: 2px;\n      }\n    "], ["\n      font-size: ", ";\n      display: inline-flex;\n      padding: 1px 4px;\n      border-radius: 3px;\n      background: ", ";\n      border: 1px solid ", ";\n      color: ", ";\n      font-weight: ", ";\n\n      > span {\n        position: relative;\n        top: 1px;\n        margin-left: 2px;\n      }\n    "])), theme.typography.size.sm, bgColor, borderColor, textColor, theme.typography.weight.regular),
    };
});
var templateObject_1;
//# sourceMappingURL=Badge.js.map