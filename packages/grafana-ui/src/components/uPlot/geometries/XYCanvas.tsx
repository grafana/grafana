import { usePlotContext } from '../context';
import React from 'react';
import { css } from 'emotion';

interface XYCanvasProps {}

/**
 * Renders absolutely positioned element on top of the uPlot's plotting area (axes are not included!).
 * Useful when you want to render some overlay with canvas-independent elements on top of the plot.
 */
export const XYCanvas: React.FC<XYCanvasProps> = ({ children }) => {
  const plotContext = usePlotContext();
  const plotInstance = plotContext.getPlotInstance();

  if (!plotInstance) {
    return null;
  }

  return (
    <div
      className={css`
        position: absolute;
        overflow: visible;
        left: ${plotInstance.bbox.left / window.devicePixelRatio}px;
        top: ${plotInstance.bbox.top / window.devicePixelRatio}px;
      `}
    >
      {children}
    </div>
  );
};
