import React, { memo } from 'react';
import { nodeR } from './Node';
import { shortenLine } from './utils';
export const Edge = memo(function Edge(props) {
    const { edge, onClick, onMouseEnter, onMouseLeave, hovering } = props;
    // Not great typing but after we do layout these properties are full objects not just references
    const { source, target, sourceNodeRadius, targetNodeRadius } = edge;
    // As the nodes have some radius we want edges to end outside of the node circle.
    const line = shortenLine({
        x1: source.x,
        y1: source.y,
        x2: target.x,
        y2: target.y,
    }, sourceNodeRadius || nodeR, targetNodeRadius || nodeR);
    return (React.createElement("g", { onClick: (event) => onClick(event, edge), style: { cursor: 'pointer' }, "aria-label": `Edge from: ${source.id} to: ${target.id}` },
        React.createElement("line", { strokeWidth: hovering ? 2 : 1, stroke: '#999', x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2, markerEnd: "url(#triangle)" }),
        React.createElement("line", { stroke: 'transparent', x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2, strokeWidth: 20, onMouseEnter: () => {
                onMouseEnter(edge.id);
            }, onMouseLeave: () => {
                onMouseLeave(edge.id);
            } })));
});
//# sourceMappingURL=Edge.js.map