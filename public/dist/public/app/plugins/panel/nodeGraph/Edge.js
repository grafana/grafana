import React, { memo } from 'react';
import { shortenLine } from './utils';
export var Edge = memo(function Edge(props) {
    var edge = props.edge, onClick = props.onClick, onMouseEnter = props.onMouseEnter, onMouseLeave = props.onMouseLeave, hovering = props.hovering;
    // Not great typing but after we do layout these properties are full objects not just references
    var _a = edge, source = _a.source, target = _a.target;
    // As the nodes have some radius we want edges to end outside of the node circle.
    var line = shortenLine({
        x1: source.x,
        y1: source.y,
        x2: target.x,
        y2: target.y,
    }, 90);
    return (React.createElement("g", { onClick: function (event) { return onClick(event, edge); }, style: { cursor: 'pointer' }, "aria-label": "Edge from: " + edge.source.id + " to: " + edge.target.id },
        React.createElement("line", { strokeWidth: hovering ? 2 : 1, stroke: '#999', x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2, markerEnd: "url(#triangle)" }),
        React.createElement("line", { stroke: 'transparent', x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2, strokeWidth: 20, onMouseEnter: function () {
                onMouseEnter(edge.id);
            }, onMouseLeave: function () {
                onMouseLeave(edge.id);
            } })));
});
//# sourceMappingURL=Edge.js.map