import { usePlotContext } from '../context';
import React from 'react';
import { css } from 'emotion';

interface XYCanvasProps {}

// Renders absolutely positioned element representing bounding box of uPlot's plotting area
export const XYCanvas: React.FC<XYCanvasProps> = ({ children }) => {
  const plotContext = usePlotContext();

  if (!plotContext || !plotContext.u) {
    return null;
  }

  return (
    <div
      className={css`
        position: absolute;
        overflow: visible;
        left: ${plotContext.u.bbox.left / window.devicePixelRatio}px;
        top: ${plotContext.u.bbox.top / window.devicePixelRatio}px;
      `}
    >
      {children}
    </div>
  );
};
