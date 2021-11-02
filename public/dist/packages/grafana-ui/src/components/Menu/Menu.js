import { __assign, __makeTemplateObject, __read, __rest } from "tslib";
import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { css } from '@emotion/css';
import { useStyles2 } from '../../themes';
import { useEffectOnce } from 'react-use';
var modulo = function (a, n) { return ((a % n) + n) % n; };
var UNFOCUSED = -1;
/** @internal */
export var Menu = React.forwardRef(function (_a, forwardedRef) {
    var header = _a.header, children = _a.children, ariaLabel = _a.ariaLabel, onOpen = _a.onOpen, onKeyDown = _a.onKeyDown, otherProps = __rest(_a, ["header", "children", "ariaLabel", "onOpen", "onKeyDown"]);
    var styles = useStyles2(getStyles);
    var _b = __read(useState(UNFOCUSED), 2), focusedItem = _b[0], setFocusedItem = _b[1];
    var localRef = useRef(null);
    useImperativeHandle(forwardedRef, function () { return localRef.current; });
    useEffect(function () {
        var _a, _b;
        var menuItems = (_a = localRef === null || localRef === void 0 ? void 0 : localRef.current) === null || _a === void 0 ? void 0 : _a.querySelectorAll("[data-role=\"menuitem\"]");
        (_b = menuItems === null || menuItems === void 0 ? void 0 : menuItems[focusedItem]) === null || _b === void 0 ? void 0 : _b.focus();
        menuItems === null || menuItems === void 0 ? void 0 : menuItems.forEach(function (menuItem, i) {
            menuItem.tabIndex = i === focusedItem ? 0 : -1;
        });
    }, [localRef, focusedItem]);
    useEffectOnce(function () {
        var _a;
        var firstMenuItem = (_a = localRef === null || localRef === void 0 ? void 0 : localRef.current) === null || _a === void 0 ? void 0 : _a.querySelector("[data-role=\"menuitem\"]");
        if (firstMenuItem) {
            firstMenuItem.tabIndex = 0;
        }
        onOpen === null || onOpen === void 0 ? void 0 : onOpen(setFocusedItem);
    });
    var handleKeys = function (event) {
        var _a, _b;
        var menuItemsCount = (_b = (_a = localRef === null || localRef === void 0 ? void 0 : localRef.current) === null || _a === void 0 ? void 0 : _a.querySelectorAll('[data-role="menuitem"]').length) !== null && _b !== void 0 ? _b : 0;
        switch (event.key) {
            case 'ArrowUp':
                event.preventDefault();
                event.stopPropagation();
                setFocusedItem(modulo(focusedItem - 1, menuItemsCount));
                break;
            case 'ArrowDown':
                event.preventDefault();
                event.stopPropagation();
                setFocusedItem(modulo(focusedItem + 1, menuItemsCount));
                break;
            case 'Home':
                event.preventDefault();
                event.stopPropagation();
                setFocusedItem(0);
                break;
            case 'End':
                event.preventDefault();
                event.stopPropagation();
                setFocusedItem(menuItemsCount - 1);
                break;
            default:
                break;
        }
        // Forward event to parent
        onKeyDown === null || onKeyDown === void 0 ? void 0 : onKeyDown(event);
    };
    var handleFocus = function () {
        if (focusedItem === UNFOCUSED) {
            setFocusedItem(0);
        }
    };
    return (React.createElement("div", __assign({}, otherProps, { ref: localRef, className: styles.wrapper, role: "menu", "aria-label": ariaLabel, onKeyDown: handleKeys, onFocus: handleFocus }),
        header && React.createElement("div", { className: styles.header }, header),
        children));
});
Menu.displayName = 'Menu';
/** @internal */
var getStyles = function (theme) {
    return {
        header: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      padding: ", ";\n      border-bottom: 1px solid ", ";\n    "], ["\n      padding: ", ";\n      border-bottom: 1px solid ", ";\n    "])), theme.spacing(0.5, 0.5, 1, 0.5), theme.colors.border.weak),
        wrapper: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      background: ", ";\n      box-shadow: ", ";\n      display: inline-block;\n      border-radius: ", ";\n    "], ["\n      background: ", ";\n      box-shadow: ", ";\n      display: inline-block;\n      border-radius: ", ";\n    "])), theme.colors.background.primary, theme.shadows.z3, theme.shape.borderRadius()),
    };
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=Menu.js.map