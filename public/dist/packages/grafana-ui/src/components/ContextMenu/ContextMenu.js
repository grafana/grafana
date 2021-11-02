import { __read } from "tslib";
import React, { useRef, useState, useLayoutEffect } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { useClickAway } from 'react-use';
import { Portal } from '../Portal/Portal';
import { Menu } from '../Menu/Menu';
export var ContextMenu = React.memo(function (_a) {
    var x = _a.x, y = _a.y, onClose = _a.onClose, renderMenuItems = _a.renderMenuItems, renderHeader = _a.renderHeader;
    var menuRef = useRef(null);
    var _b = __read(useState({}), 2), positionStyles = _b[0], setPositionStyles = _b[1];
    useLayoutEffect(function () {
        var menuElement = menuRef.current;
        if (menuElement) {
            var rect = menuElement.getBoundingClientRect();
            var OFFSET = 5;
            var collisions = {
                right: window.innerWidth < x + rect.width,
                bottom: window.innerHeight < rect.bottom + rect.height + OFFSET,
            };
            setPositionStyles({
                position: 'fixed',
                left: collisions.right ? x - rect.width - OFFSET : x - OFFSET,
                top: collisions.bottom ? y - rect.height - OFFSET : y + OFFSET,
            });
        }
    }, [x, y]);
    useClickAway(menuRef, function () {
        onClose === null || onClose === void 0 ? void 0 : onClose();
    });
    var header = renderHeader === null || renderHeader === void 0 ? void 0 : renderHeader();
    var menuItems = renderMenuItems === null || renderMenuItems === void 0 ? void 0 : renderMenuItems();
    var onOpen = function (setFocusedItem) {
        setFocusedItem(0);
    };
    var onKeyDown = function (e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onClose === null || onClose === void 0 ? void 0 : onClose();
        }
    };
    return (React.createElement(Portal, null,
        React.createElement(Menu, { header: header, ref: menuRef, style: positionStyles, ariaLabel: selectors.components.Menu.MenuComponent('Context'), onOpen: onOpen, onClick: onClose, onKeyDown: onKeyDown }, menuItems)));
});
ContextMenu.displayName = 'ContextMenu';
//# sourceMappingURL=ContextMenu.js.map