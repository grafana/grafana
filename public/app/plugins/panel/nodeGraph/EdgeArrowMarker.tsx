import React from 'react';

/**
 * In SVG you need to supply this kind of marker that can be then referenced from a line segment as an ending of the
 * line turning in into arrow. Needs to be included in the svg element and then referenced as markerEnd="url(#triangle)"
 */
export function EdgeArrowMarker() {
  return (
    <defs>
      <marker
        id="triangle"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerUnits="userSpaceOnUse"
        markerWidth="10"
        markerHeight="10"
        orient="auto"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#999" />
      </marker>
    </defs>
  );
}
