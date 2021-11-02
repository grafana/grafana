import React from 'react';
// An abstraction over a component rendered within a chart canvas.
// Marker is rendered with DOM coords of the chart bounding box.
export var Marker = function (_a) {
    var x = _a.x, y = _a.y, children = _a.children;
    return (React.createElement("div", { style: {
            position: 'absolute',
            top: y + "px",
            left: x + "px",
        } }, children));
};
//# sourceMappingURL=Marker.js.map