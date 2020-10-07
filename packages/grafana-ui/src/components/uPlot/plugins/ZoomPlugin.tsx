import React from 'react';
import { SelectionPlugin } from './SelectionPlugin';

interface ZoomPluginProps {
  onZoom: (range: { from: number; to: number }) => void;
}

// min px width that triggers zoom
const MIN_ZOOM_DIST = 5;

export const ZoomPlugin: React.FC<ZoomPluginProps> = ({ onZoom }) => {
  return (
    <SelectionPlugin
      id="Zoom"
      /* very time series oriented for now */
      onSelect={selection => {
        if (selection.bbox.width < MIN_ZOOM_DIST) {
          return;
        }
        onZoom({ from: selection.min * 1000, to: selection.max * 1000 });
      }}
    />
  );
};
