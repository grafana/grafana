import { __assign, __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { useTheme, stylesFactory } from '@grafana/ui';
import { TagBadge } from './TagBadge';
export var TagOption = function (_a) {
    var _b;
    var data = _a.data, className = _a.className, label = _a.label, isFocused = _a.isFocused, innerProps = _a.innerProps;
    var theme = useTheme();
    var styles = getStyles(theme);
    return (React.createElement("div", __assign({ className: cx(styles.option, isFocused && styles.optionFocused), "aria-label": "Tag option" }, innerProps),
        React.createElement("div", { className: "tag-filter-option " + (className || '') },
            React.createElement(TagBadge, { label: label, removeIcon: false, count: (_b = data.count) !== null && _b !== void 0 ? _b : 0 }))));
};
var getStyles = stylesFactory(function (theme) {
    return {
        option: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      padding: 8px;\n      white-space: nowrap;\n      cursor: pointer;\n      border-left: 2px solid transparent;\n      &:hover {\n        background: ", ";\n      }\n    "], ["\n      padding: 8px;\n      white-space: nowrap;\n      cursor: pointer;\n      border-left: 2px solid transparent;\n      &:hover {\n        background: ", ";\n      }\n    "])), theme.colors.dropdownOptionHoverBg),
        optionFocused: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      background: ", ";\n      border-style: solid;\n      border-top: 0;\n      border-right: 0;\n      border-bottom: 0;\n      border-left-width: 2px;\n    "], ["\n      background: ", ";\n      border-style: solid;\n      border-top: 0;\n      border-right: 0;\n      border-bottom: 0;\n      border-left-width: 2px;\n    "])), theme.colors.dropdownOptionHoverBg),
    };
});
var templateObject_1, templateObject_2;
//# sourceMappingURL=TagOption.js.map