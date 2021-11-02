import { __assign, __read, __rest } from "tslib";
import React, { useCallback, useState } from 'react';
export var PanelHeaderMenuTrigger = function (_a) {
    var children = _a.children, divProps = __rest(_a, ["children"]);
    var _b = __read(useState({ x: 0, y: 0 }), 2), clickCoordinates = _b[0], setClickCoordinates = _b[1];
    var _c = __read(useState(false), 2), panelMenuOpen = _c[0], setPanelMenuOpen = _c[1];
    var onMenuToggle = useCallback(function (event) {
        if (!isClick(clickCoordinates, eventToClickCoordinates(event))) {
            return;
        }
        event.stopPropagation();
        setPanelMenuOpen(!panelMenuOpen);
    }, [clickCoordinates, panelMenuOpen, setPanelMenuOpen]);
    var onMouseDown = useCallback(function (event) {
        setClickCoordinates(eventToClickCoordinates(event));
    }, [setClickCoordinates]);
    return (React.createElement("header", __assign({}, divProps, { className: "panel-title-container", onClick: onMenuToggle, onMouseDown: onMouseDown }), children({ panelMenuOpen: panelMenuOpen, closeMenu: function () { return setPanelMenuOpen(false); } })));
};
function isClick(current, clicked) {
    return clicked.x === current.x && clicked.y === current.y;
}
function eventToClickCoordinates(event) {
    return {
        x: Math.floor(event.clientX),
        y: Math.floor(event.clientY),
    };
}
//# sourceMappingURL=PanelHeaderMenuTrigger.js.map