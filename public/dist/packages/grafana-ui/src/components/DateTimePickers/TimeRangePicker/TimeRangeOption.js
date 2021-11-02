import { __makeTemplateObject } from "tslib";
import React, { memo } from 'react';
import { css, cx } from '@emotion/css';
import { useStyles2 } from '../../../themes/ThemeContext';
import { getFocusStyles } from '../../../themes/mixins';
import { v4 as uuidv4 } from 'uuid';
var getStyles = function (theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      align-items: center;\n      flex-direction: row-reverse;\n      justify-content: space-between;\n      padding: 7px 9px 7px 9px;\n\n      &:hover {\n        background: ", ";\n        cursor: pointer;\n      }\n    "], ["\n      display: flex;\n      align-items: center;\n      flex-direction: row-reverse;\n      justify-content: space-between;\n      padding: 7px 9px 7px 9px;\n\n      &:hover {\n        background: ", ";\n        cursor: pointer;\n      }\n    "])), theme.colors.action.hover),
        selected: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      background: ", ";\n      font-weight: ", ";\n    "], ["\n      background: ", ";\n      font-weight: ", ";\n    "])), theme.colors.action.selected, theme.typography.fontWeightMedium),
        radio: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      opacity: 0;\n\n      &:focus-visible + label {\n        ", ";\n      }\n    "], ["\n      opacity: 0;\n\n      &:focus-visible + label {\n        ", ";\n      }\n    "])), getFocusStyles(theme)),
        label: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      cursor: pointer;\n    "], ["\n      cursor: pointer;\n    "]))),
    };
};
export var TimeRangeOption = memo(function (_a) {
    var value = _a.value, onSelect = _a.onSelect, _b = _a.selected, selected = _b === void 0 ? false : _b, name = _a.name;
    var styles = useStyles2(getStyles);
    // In case there are more of the same timerange in the list
    var id = uuidv4();
    return (React.createElement("li", { onClick: function () { return onSelect(value); }, className: cx(styles.container, selected && styles.selected) },
        React.createElement("input", { className: styles.radio, checked: selected, name: name, type: "checkbox", id: id, onChange: function () { return onSelect(value); } }),
        React.createElement("label", { className: styles.label, htmlFor: id }, value.display)));
});
TimeRangeOption.displayName = 'TimeRangeOption';
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=TimeRangeOption.js.map