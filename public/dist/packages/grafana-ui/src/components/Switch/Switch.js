import { __assign, __makeTemplateObject, __rest } from "tslib";
import React, { useRef } from 'react';
import { css, cx } from '@emotion/css';
import { uniqueId } from 'lodash';
import { deprecationWarning } from '@grafana/data';
import { stylesFactory, useTheme2 } from '../../themes';
import { getFocusStyles, getMouseFocusStyles } from '../../themes/mixins';
export var Switch = React.forwardRef(function (_a, ref) {
    var value = _a.value, checked = _a.checked, disabled = _a.disabled, onChange = _a.onChange, id = _a.id, inputProps = __rest(_a, ["value", "checked", "disabled", "onChange", "id"]);
    if (checked) {
        deprecationWarning('Switch', 'checked prop', 'value');
    }
    var theme = useTheme2();
    var styles = getSwitchStyles(theme);
    var switchIdRef = useRef(id ? id : uniqueId('switch-'));
    return (React.createElement("div", { className: cx(styles.switch) },
        React.createElement("input", __assign({ type: "checkbox", disabled: disabled, checked: value, onChange: function (event) {
                onChange === null || onChange === void 0 ? void 0 : onChange(event);
            }, id: switchIdRef.current }, inputProps, { ref: ref })),
        React.createElement("label", { htmlFor: switchIdRef.current })));
});
Switch.displayName = 'Switch';
export var InlineSwitch = React.forwardRef(function (_a, ref) {
    var transparent = _a.transparent, showLabel = _a.showLabel, label = _a.label, value = _a.value, id = _a.id, props = __rest(_a, ["transparent", "showLabel", "label", "value", "id"]);
    var theme = useTheme2();
    var styles = getSwitchStyles(theme, transparent);
    return (React.createElement("div", { className: styles.inlineContainer },
        showLabel && (React.createElement("label", { htmlFor: id, className: cx(styles.inlineLabel, value && styles.inlineLabelEnabled, 'inline-switch-label') }, label)),
        React.createElement(Switch, __assign({}, props, { id: id, label: label, ref: ref, value: value }))));
});
InlineSwitch.displayName = 'Switch';
var getSwitchStyles = stylesFactory(function (theme, transparent) {
    return {
        switch: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      width: 32px;\n      height: 16px;\n      position: relative;\n\n      input {\n        opacity: 0;\n        left: -100vw;\n        z-index: -1000;\n        position: absolute;\n\n        &:disabled + label {\n          background: ", ";\n          cursor: not-allowed;\n        }\n\n        &:checked + label {\n          background: ", ";\n          border-color: ", ";\n\n          &:hover {\n            background: ", ";\n          }\n\n          &::after {\n            transform: translate3d(18px, -50%, 0);\n            background: ", ";\n          }\n        }\n\n        &:focus + label,\n        &:focus-visible + label {\n          ", "\n        }\n\n        &:focus:not(:focus-visible) + label {\n          ", "\n        }\n      }\n\n      label {\n        width: 100%;\n        height: 100%;\n        cursor: pointer;\n        border: none;\n        border-radius: 50px;\n        background: ", ";\n        border: 1px solid ", ";\n        transition: all 0.3s ease;\n\n        &:hover {\n          border-color: ", ";\n        }\n\n        &::after {\n          position: absolute;\n          display: block;\n          content: '';\n          width: 12px;\n          height: 12px;\n          border-radius: 6px;\n          background: ", ";\n          box-shadow: ", ";\n          top: 50%;\n          transform: translate3d(2px, -50%, 0);\n          transition: transform 0.2s cubic-bezier(0.19, 1, 0.22, 1);\n        }\n      }\n    "], ["\n      width: 32px;\n      height: 16px;\n      position: relative;\n\n      input {\n        opacity: 0;\n        left: -100vw;\n        z-index: -1000;\n        position: absolute;\n\n        &:disabled + label {\n          background: ", ";\n          cursor: not-allowed;\n        }\n\n        &:checked + label {\n          background: ", ";\n          border-color: ", ";\n\n          &:hover {\n            background: ", ";\n          }\n\n          &::after {\n            transform: translate3d(18px, -50%, 0);\n            background: ", ";\n          }\n        }\n\n        &:focus + label,\n        &:focus-visible + label {\n          ", "\n        }\n\n        &:focus:not(:focus-visible) + label {\n          ", "\n        }\n      }\n\n      label {\n        width: 100%;\n        height: 100%;\n        cursor: pointer;\n        border: none;\n        border-radius: 50px;\n        background: ", ";\n        border: 1px solid ", ";\n        transition: all 0.3s ease;\n\n        &:hover {\n          border-color: ", ";\n        }\n\n        &::after {\n          position: absolute;\n          display: block;\n          content: '';\n          width: 12px;\n          height: 12px;\n          border-radius: 6px;\n          background: ", ";\n          box-shadow: ", ";\n          top: 50%;\n          transform: translate3d(2px, -50%, 0);\n          transition: transform 0.2s cubic-bezier(0.19, 1, 0.22, 1);\n        }\n      }\n    "])), theme.colors.action.disabledBackground, theme.colors.primary.main, theme.colors.primary.main, theme.colors.primary.shade, theme.colors.primary.contrastText, getFocusStyles(theme), getMouseFocusStyles(theme), theme.components.input.background, theme.components.input.borderColor, theme.components.input.borderHover, theme.colors.text.secondary, theme.shadows.z1),
        inlineContainer: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      padding: ", ";\n      height: ", ";\n      display: inline-flex;\n      align-items: center;\n      background: ", ";\n      border: 1px solid ", ";\n      border-radius: ", ";\n\n      &:hover {\n        border: 1px solid ", ";\n\n        .inline-switch-label {\n          color: ", ";\n        }\n      }\n    "], ["\n      padding: ", ";\n      height: ", ";\n      display: inline-flex;\n      align-items: center;\n      background: ", ";\n      border: 1px solid ", ";\n      border-radius: ", ";\n\n      &:hover {\n        border: 1px solid ", ";\n\n        .inline-switch-label {\n          color: ", ";\n        }\n      }\n    "])), theme.spacing(0, 1), theme.spacing(theme.components.height.md), transparent ? 'transparent' : theme.components.input.background, transparent ? 'transparent' : theme.components.input.borderColor, theme.shape.borderRadius(), transparent ? 'transparent' : theme.components.input.borderHover, theme.colors.text.primary),
        inlineLabel: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      cursor: pointer;\n      padding-right: ", ";\n      color: ", ";\n      white-space: nowrap;\n    "], ["\n      cursor: pointer;\n      padding-right: ", ";\n      color: ", ";\n      white-space: nowrap;\n    "])), theme.spacing(1), theme.colors.text.secondary),
        inlineLabelEnabled: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      color: ", ";\n    "], ["\n      color: ", ";\n    "])), theme.colors.text.primary),
    };
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=Switch.js.map