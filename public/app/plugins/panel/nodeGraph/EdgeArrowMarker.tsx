import React from 'react';

import { defaultEdgeColor } from './Edge';

/**
 * In SVG you need to supply this kind of marker that can be then referenced from a line segment as an ending of the
 * line turning in into arrow. Needs to be included in the svg element and then referenced as markerEnd="url(#triangle)"
 */
export function EdgeArrowMarker({
  id = 'triangle',
  fill = defaultEdgeColor,
  headHeight = 10,
}: {
  id?: string;
  fill?: string;
  headHeight?: number;
}) {
  return (
    <defs>
      <marker
        id={id}
        viewBox="0 0 10 10"
        refX="1" // shift the arrow head slightly closer to the center of the line it will be attached to, to ensure no empty space is shown between the line and the arrow head
        refY="5"
        markerUnits="userSpaceOnUse"
        markerWidth={headHeight} // equal to the height just for simplicily
        markerHeight={headHeight}
        orient="auto"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill={fill} />
      </marker>
    </defs>
  );
}
