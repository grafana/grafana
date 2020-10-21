import React from 'react';
import { usePlotContext } from './context';

interface CanvasProps {
  width?: number;
  height?: number;
}

// Ref element to render the uPlot canvas to
// This is a required child of Plot component!
export const Canvas: React.FC<CanvasProps> = () => {
  const plotCtx = usePlotContext();
  return <div ref={plotCtx.canvasRef} />;
};

Canvas.displayName = 'Canvas';
