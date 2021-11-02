import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { useTheme, stylesFactory } from '../../../themes';
var stopPropagation = function (event) { return event.stopPropagation(); };
export var TimeZoneGroup = function (props) {
    var theme = useTheme();
    var children = props.children, label = props.label;
    var styles = getStyles(theme);
    if (!label) {
        return React.createElement("div", { onClick: stopPropagation }, children);
    }
    return (React.createElement("div", { onClick: stopPropagation },
        React.createElement("div", { className: styles.header },
            React.createElement("span", { className: styles.label }, label)),
        children));
};
var getStyles = stylesFactory(function (theme) {
    return {
        header: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      padding: 7px 10px;\n      width: 100%;\n      border-top: 1px solid ", ";\n      text-transform: capitalize;\n    "], ["\n      padding: 7px 10px;\n      width: 100%;\n      border-top: 1px solid ", ";\n      text-transform: capitalize;\n    "])), theme.colors.border1),
        label: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      font-size: ", ";\n      color: ", ";\n      font-weight: ", ";\n    "], ["\n      font-size: ", ";\n      color: ", ";\n      font-weight: ", ";\n    "])), theme.typography.size.sm, theme.colors.textWeak, theme.typography.weight.semibold),
    };
});
var templateObject_1, templateObject_2;
//# sourceMappingURL=TimeZoneGroup.js.map