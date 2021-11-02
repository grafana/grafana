import { __assign, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { cx, css } from '@emotion/css';
import { useTheme } from '../../themes';
import { InlineLabel } from './InlineLabel';
import { getChildId } from '../../utils/children';
export var InlineField = function (_a) {
    var children = _a.children, label = _a.label, tooltip = _a.tooltip, _b = _a.labelWidth, labelWidth = _b === void 0 ? 'auto' : _b, invalid = _a.invalid, loading = _a.loading, disabled = _a.disabled, className = _a.className, htmlFor = _a.htmlFor, grow = _a.grow, transparent = _a.transparent, htmlProps = __rest(_a, ["children", "label", "tooltip", "labelWidth", "invalid", "loading", "disabled", "className", "htmlFor", "grow", "transparent"]);
    var theme = useTheme();
    var styles = getStyles(theme, grow);
    var inputId = htmlFor !== null && htmlFor !== void 0 ? htmlFor : getChildId(children);
    var labelElement = typeof label === 'string' ? (React.createElement(InlineLabel, { width: labelWidth, tooltip: tooltip, htmlFor: inputId, transparent: transparent }, label)) : (label);
    return (React.createElement("div", __assign({ className: cx(styles.container, className) }, htmlProps),
        labelElement,
        React.cloneElement(children, { invalid: invalid, disabled: disabled, loading: loading })));
};
InlineField.displayName = 'InlineField';
var getStyles = function (theme, grow) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: row;\n      align-items: flex-start;\n      text-align: left;\n      position: relative;\n      flex: ", " 0 auto;\n      margin: 0 ", " ", " 0;\n    "], ["\n      display: flex;\n      flex-direction: row;\n      align-items: flex-start;\n      text-align: left;\n      position: relative;\n      flex: ", " 0 auto;\n      margin: 0 ", " ", " 0;\n    "])), grow ? 1 : 0, theme.spacing.xs, theme.spacing.xs),
    };
};
var templateObject_1;
//# sourceMappingURL=InlineField.js.map