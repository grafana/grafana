import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { renderMarkdown } from '@grafana/data';
import { useTheme } from '../../themes/ThemeContext';
var getStyles = function (theme, height, visible) {
    return {
        typeaheadItem: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: type-ahead-item;\n      z-index: 11;\n      padding: ", " ", " ", " ", ";\n      border-radius: ", ";\n      border: ", ";\n      overflow-y: scroll;\n      overflow-x: hidden;\n      outline: none;\n      background: ", ";\n      color: ", ";\n      box-shadow: 0 0 20px ", ";\n      visibility: ", ";\n      width: 250px;\n      height: ", "px;\n      position: relative;\n      word-break: break-word;\n    "], ["\n      label: type-ahead-item;\n      z-index: 11;\n      padding: ", " ", " ", " ", ";\n      border-radius: ", ";\n      border: ", ";\n      overflow-y: scroll;\n      overflow-x: hidden;\n      outline: none;\n      background: ", ";\n      color: ", ";\n      box-shadow: 0 0 20px ", ";\n      visibility: ", ";\n      width: 250px;\n      height: ", "px;\n      position: relative;\n      word-break: break-word;\n    "])), theme.spacing.sm, theme.spacing.sm, theme.spacing.sm, theme.spacing.md, theme.border.radius.md, theme.colors.border2, theme.colors.bg2, theme.colors.text, theme.colors.dropdownShadow, visible === true ? 'visible' : 'hidden', height + parseInt(theme.spacing.xxs, 10)),
    };
};
export var TypeaheadInfo = function (_a) {
    var item = _a.item, height = _a.height;
    var visible = item && !!item.documentation;
    var label = item ? item.label : '';
    var documentation = renderMarkdown(item === null || item === void 0 ? void 0 : item.documentation);
    var theme = useTheme();
    var styles = getStyles(theme, height, visible);
    return (React.createElement("div", { className: cx([styles.typeaheadItem]) },
        React.createElement("b", null, label),
        React.createElement("hr", null),
        React.createElement("div", { dangerouslySetInnerHTML: { __html: documentation } })));
};
var templateObject_1;
//# sourceMappingURL=TypeaheadInfo.js.map