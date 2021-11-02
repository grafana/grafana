import { __assign, __makeTemplateObject } from "tslib";
import React from 'react';
import { useTheme2 } from '../../themes/ThemeContext';
import { sharedInputStyle } from '../Forms/commonStyles';
import { getInputStyles } from '../Input/Input';
import { css, cx } from '@emotion/css';
import { stylesFactory } from '../../themes';
import { focusCss } from '../../themes/mixins';
import { components } from 'react-select';
export var SelectContainer = function (props) {
    var isDisabled = props.isDisabled, isFocused = props.isFocused, children = props.children, prefix = props.selectProps.prefix;
    var theme = useTheme2();
    var styles = getSelectContainerStyles(theme, isFocused, isDisabled, !!prefix);
    return (React.createElement(components.SelectContainer, __assign({}, props, { className: cx(styles.wrapper, props.className) }), children));
};
var getSelectContainerStyles = stylesFactory(function (theme, focused, disabled, withPrefix) {
    var styles = getInputStyles({ theme: theme, invalid: false });
    return {
        wrapper: cx(styles.wrapper, sharedInputStyle(theme, false), focused && css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n            ", "\n          "], ["\n            ", "\n          "])), focusCss(theme.v1)), disabled && styles.inputDisabled, css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n          position: relative;\n          box-sizing: border-box;\n          display: flex;\n          flex-direction: row;\n          flex-wrap: wrap;\n          align-items: center;\n          justify-content: space-between;\n\n          min-height: 32px;\n          height: auto;\n          max-width: 100%;\n\n          /* Input padding is applied to the InputControl so the menu is aligned correctly */\n          padding: 0;\n          cursor: ", ";\n        "], ["\n          position: relative;\n          box-sizing: border-box;\n          display: flex;\n          flex-direction: row;\n          flex-wrap: wrap;\n          align-items: center;\n          justify-content: space-between;\n\n          min-height: 32px;\n          height: auto;\n          max-width: 100%;\n\n          /* Input padding is applied to the InputControl so the menu is aligned correctly */\n          padding: 0;\n          cursor: ", ";\n        "])), disabled ? 'not-allowed' : 'pointer'), withPrefix && css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n            padding-left: 0;\n          "], ["\n            padding-left: 0;\n          "])))),
    };
});
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=SelectContainer.js.map