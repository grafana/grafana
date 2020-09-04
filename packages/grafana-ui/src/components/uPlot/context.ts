import React, { useContext } from 'react';
import uPlot from 'uplot';
import { PlotPlugin } from './types';

interface PlotCanvasContextType {
  // canvas size css pxs
  width: number;
  height: number;
  // plotting area bbox, css pxs
  plot: {
    width: number;
    height: number;
    top: number;
    left: number;
  };
}

interface PlotContextType {
  u: uPlot;
  canvas: PlotCanvasContextType;
}

type PlotPluginsContextType = {
  registerPlugin: (plugin: PlotPlugin) => () => void;
};

export const PlotContext = React.createContext<PlotContextType | null>(null);
export const PlotPluginsContext = React.createContext<PlotPluginsContextType>(null);

// Exposes uPlot instance and bounding box of the entire canvas and plot area
export const usePlotContext = (): PlotContextType | null => {
  return useContext(PlotContext);
};

// Epxoses API for registering uPlot plugins
export const usePlotPluginContext = (): PlotPluginsContextType => {
  return useContext(PlotPluginsContext);
};

// Returns bbox of the plot canvas (only the graph, no axes)
export const usePlotCanvas = (): PlotCanvasContextType | null => {
  const ctx = usePlotContext();
  return ctx?.canvas;
};

export const buildPlotContext = (u?: uPlot): PlotContextType | null => {
  if (!u) {
    return null;
  }

  return {
    u,
    canvas: {
      width: u.width,
      height: u.height,
      plot: {
        width: u.bbox.width / window.devicePixelRatio,
        height: u.bbox.height / window.devicePixelRatio,
        top: u.bbox.top / window.devicePixelRatio,
        left: u.bbox.left / window.devicePixelRatio,
      },
    },
  };
};
