import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { getTagColorsFromName } from '../../utils';
import { stylesFactory, useTheme } from '../../themes';
import { Icon } from '../Icon/Icon';
var getStyles = stylesFactory(function (_a) {
    var theme = _a.theme, name = _a.name;
    var _b = getTagColorsFromName(name), color = _b.color, borderColor = _b.borderColor;
    var height = theme.spacing.formInputHeight - 8;
    return {
        itemStyle: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      align-items: center;\n      height: ", "px;\n      line-height: ", "px;\n      background-color: ", ";\n      color: ", ";\n      border: 1px solid ", ";\n      border-radius: 3px;\n      padding: 0 ", ";\n      margin-right: 3px;\n      white-space: nowrap;\n      text-shadow: none;\n      font-weight: 500;\n      font-size: ", ";\n    "], ["\n      display: flex;\n      align-items: center;\n      height: ", "px;\n      line-height: ", "px;\n      background-color: ", ";\n      color: ", ";\n      border: 1px solid ", ";\n      border-radius: 3px;\n      padding: 0 ", ";\n      margin-right: 3px;\n      white-space: nowrap;\n      text-shadow: none;\n      font-weight: 500;\n      font-size: ", ";\n    "])), height, height - 2, color, theme.palette.white, borderColor, theme.spacing.xs, theme.typography.size.sm),
        nameStyle: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      margin-right: 3px;\n    "], ["\n      margin-right: 3px;\n    "]))),
    };
});
/**
 * @internal
 * Only used internally by TagsInput
 * */
export var TagItem = function (_a) {
    var name = _a.name, onRemove = _a.onRemove;
    var theme = useTheme();
    var styles = getStyles({ theme: theme, name: name });
    return (React.createElement("div", { className: styles.itemStyle },
        React.createElement("span", { className: styles.nameStyle }, name),
        React.createElement(Icon, { className: "pointer", name: "times", onClick: function () { return onRemove(name); } })));
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=TagItem.js.map