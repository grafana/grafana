import { css } from '@emotion/css';
import { useMemo } from 'react';
import * as React from 'react';

interface XYCanvasProps {
  top: number; // css pxls
  left: number; // css pxls
}

/**
 * Renders absolutely positioned element on top of the uPlot's plotting area (axes are not included!).
 * Useful when you want to render some overlay with canvas-independent elements on top of the plot.
 */
export const XYCanvas = ({ children, left, top }: React.PropsWithChildren<XYCanvasProps>) => {
  const className = useMemo(() => {
    return css({
      position: 'absolute',
      overflow: 'visible',
      left: `${left}px`,
      top: `${top}px`,
    });
  }, [left, top]);

  // @todo add to e2e selectors
  return (
    <div data-testid={'xy-canvas'} className={className}>
      {children}
    </div>
  );
};
