import React from 'react';
import { usePlotContext } from '../context';

interface CanvasProps {
  width?: number;
  height?: number;
}

export const Canvas: React.FC<CanvasProps> = ({ width, height }) => {
  const plot = usePlotContext();
  if (!plot) {
    return null;
  }

  return <div ref={plot.canvasRef} />;
};
