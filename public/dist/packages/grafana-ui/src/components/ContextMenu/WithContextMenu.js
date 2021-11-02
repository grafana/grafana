import { __read } from "tslib";
import React, { useState } from 'react';
import { ContextMenu } from '../ContextMenu/ContextMenu';
export var WithContextMenu = function (_a) {
    var children = _a.children, renderMenuItems = _a.renderMenuItems;
    var _b = __read(useState(false), 2), isMenuOpen = _b[0], setIsMenuOpen = _b[1];
    var _c = __read(useState({ x: 0, y: 0 }), 2), menuPosition = _c[0], setMenuPosition = _c[1];
    return (React.createElement(React.Fragment, null,
        children({
            openMenu: function (e) {
                setIsMenuOpen(true);
                setMenuPosition({
                    x: e.pageX,
                    y: e.pageY,
                });
            },
        }),
        isMenuOpen && (React.createElement(ContextMenu, { onClose: function () { return setIsMenuOpen(false); }, x: menuPosition.x, y: menuPosition.y, renderMenuItems: renderMenuItems }))));
};
//# sourceMappingURL=WithContextMenu.js.map