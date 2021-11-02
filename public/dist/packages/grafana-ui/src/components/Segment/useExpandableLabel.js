import { __read } from "tslib";
import React, { useState, useRef } from 'react';
export var useExpandableLabel = function (initialExpanded, onExpandedChange) {
    var ref = useRef(null);
    var _a = __read(useState(initialExpanded), 2), expanded = _a[0], setExpanded = _a[1];
    var _b = __read(useState(0), 2), width = _b[0], setWidth = _b[1];
    var setExpandedWrapper = function (expanded) {
        setExpanded(expanded);
        if (onExpandedChange) {
            onExpandedChange(expanded);
        }
    };
    var Label = function (_a) {
        var Component = _a.Component, onClick = _a.onClick, disabled = _a.disabled;
        return (React.createElement("div", { ref: ref, onClick: disabled
                ? undefined
                : function () {
                    setExpandedWrapper(true);
                    if (ref && ref.current) {
                        setWidth(ref.current.clientWidth * 1.25);
                    }
                    if (onClick) {
                        onClick();
                    }
                } }, Component));
    };
    return [Label, width, expanded, setExpandedWrapper];
};
//# sourceMappingURL=useExpandableLabel.js.map