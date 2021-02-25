import React, { useContext } from 'react';
import uPlot, { AlignedData, Series } from 'uplot';
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

interface PlotPluginsContextType {
  registerPlugin: (plugin: PlotPlugin) => () => void;
}

interface PlotContextType extends PlotPluginsContextType {
  isPlotReady: boolean;
  getPlotInstance: () => uPlot | undefined;
  getSeries: () => Series[];
  getCanvas: () => PlotCanvasContextType;
  canvasRef: any;
  data: AlignedData;
}

export const PlotContext = React.createContext<PlotContextType>({} as PlotContextType);

// Exposes uPlot instance and bounding box of the entire canvas and plot area
export const usePlotContext = (): PlotContextType => {
  return useContext<PlotContextType>(PlotContext);
};

const throwWhenNoContext = (name: string) => {
  throw new Error(`${name} must be used within PlotContext or PlotContext is not ready yet!`);
};

// Exposes API for registering uPlot plugins
export const usePlotPluginContext = (): PlotPluginsContextType => {
  const ctx = useContext(PlotContext);
  if (Object.keys(ctx).length === 0) {
    throwWhenNoContext('usePlotPluginContext');
  }
  return {
    registerPlugin: ctx!.registerPlugin,
  };
};

export const buildPlotContext = (
  isPlotReady: boolean,
  canvasRef: any,
  data: AlignedData,
  registerPlugin: any,
  getPlotInstance: () => uPlot | undefined
): PlotContextType => {
  return {
    isPlotReady,
    canvasRef,
    data,
    registerPlugin,
    getPlotInstance,
    getSeries: () => getPlotInstance()!.series,
    getCanvas: () => {
      const plotInstance = getPlotInstance()!;
      const bbox = plotInstance.bbox;
      const pxRatio = window.devicePixelRatio;
      return {
        width: plotInstance.width,
        height: plotInstance.height,
        plot: {
          width: bbox.width / pxRatio,
          height: bbox.height / pxRatio,
          top: bbox.top / pxRatio,
          left: bbox.left / pxRatio,
        },
      };
    },
  };
};
