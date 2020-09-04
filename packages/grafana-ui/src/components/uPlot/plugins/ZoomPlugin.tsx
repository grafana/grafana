import React from 'react';
import { SelectionPlugin } from './SelectionPlugin';

interface ZoomPluginProps {
  onZoom: (range: { from: number; to: number }) => void;
}

export const ZoomPlugin: React.FC<ZoomPluginProps> = ({ onZoom }) => {
  return (
    <SelectionPlugin
      id="Zoom"
      /* very time series oriented for now */
      onSelect={selection => onZoom({ from: selection.min * 1000, to: selection.max * 1000 })}
    />
  );
};
