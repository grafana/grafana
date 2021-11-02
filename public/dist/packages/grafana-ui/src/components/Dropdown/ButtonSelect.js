import { __assign, __makeTemplateObject, __read, __rest } from "tslib";
import React, { useState } from 'react';
import { ToolbarButton, ButtonGroup } from '../Button';
import { ClickOutsideWrapper } from '../ClickOutsideWrapper/ClickOutsideWrapper';
import { css } from '@emotion/css';
import { useStyles2 } from '../../themes/ThemeContext';
import { Menu } from '../Menu/Menu';
import { MenuItem } from '../Menu/MenuItem';
/**
 * @internal
 * A temporary component until we have a proper dropdown component
 */
var ButtonSelectComponent = function (props) {
    var className = props.className, options = props.options, value = props.value, onChange = props.onChange, narrow = props.narrow, variant = props.variant, restProps = __rest(props, ["className", "options", "value", "onChange", "narrow", "variant"]);
    var _a = __read(useState(false), 2), isOpen = _a[0], setIsOpen = _a[1];
    var styles = useStyles2(getStyles);
    var onCloseMenu = function () {
        setIsOpen(false);
    };
    var onToggle = function (event) {
        event.stopPropagation();
        event.preventDefault();
        setIsOpen(!isOpen);
    };
    var onChangeInternal = function (item) {
        onChange(item);
        setIsOpen(false);
    };
    return (React.createElement(ButtonGroup, { className: styles.wrapper },
        React.createElement(ToolbarButton, __assign({ className: className, isOpen: isOpen, onClick: onToggle, narrow: narrow, variant: variant }, restProps), (value === null || value === void 0 ? void 0 : value.label) || (value === null || value === void 0 ? void 0 : value.value)),
        isOpen && (React.createElement("div", { className: styles.menuWrapper },
            React.createElement(ClickOutsideWrapper, { onClick: onCloseMenu, parent: document },
                React.createElement(Menu, null, options.map(function (item) { return (React.createElement(MenuItem, { key: "" + item.value, label: (item.label || item.value), onClick: function () { return onChangeInternal(item); }, active: item.value === (value === null || value === void 0 ? void 0 : value.value) })); })))))));
};
ButtonSelectComponent.displayName = 'ButtonSelect';
export var ButtonSelect = React.memo(ButtonSelectComponent);
var getStyles = function (theme) {
    return {
        wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      position: relative;\n      display: inline-flex;\n    "], ["\n      position: relative;\n      display: inline-flex;\n    "]))),
        menuWrapper: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      position: absolute;\n      z-index: ", ";\n      top: ", ";\n      right: 0;\n    "], ["\n      position: absolute;\n      z-index: ", ";\n      top: ", ";\n      right: 0;\n    "])), theme.zIndex.dropdown, theme.spacing(4)),
    };
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=ButtonSelect.js.map