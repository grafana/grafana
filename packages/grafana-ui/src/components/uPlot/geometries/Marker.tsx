import { css } from 'emotion';
import React from 'react';

interface MarkerProps {
  /** x position relative to plotting area bounding box*/
  x: number;
  /** y position relative to plotting area bounding box*/
  y: number;
}

// An abstraction over a component rendered within a chart canvas.
// Marker is rendered with DOM coords of the chart bounding box.
export const Marker: React.FC<MarkerProps> = ({ x, y, children }) => {
  return (
    <div
      className={css`
        position: absolute;
        top: ${y}px;
        left: ${x}px;
        transform: translate3d(-50%, -50%, 0);
      `}
    >
      {children}
    </div>
  );
};
