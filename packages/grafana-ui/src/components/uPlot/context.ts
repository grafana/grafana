import React, { useContext } from 'react';
import uPlot, { AlignedData, Series } from 'uplot';

/**
 * @alpha
 */
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
  getPlotInstance: () => uPlot | undefined;
  getSeries: () => Series[];
  getCanvas: () => PlotCanvasContextType;
  canvasRef: any;
  data: AlignedData;
}

/**
 * @alpha
 */
export const PlotContext = React.createContext<PlotContextType>({} as PlotContextType);

// Exposes uPlot instance and bounding box of the entire canvas and plot area
export const usePlotContext = (): PlotContextType => {
  return useContext<PlotContextType>(PlotContext);
};

/**
 * @alpha
 */
export const buildPlotContext = (
  canvasRef: any,
  data: AlignedData,
  getPlotInstance: () => uPlot | undefined
): PlotContextType => {
  return {
    canvasRef,
    data,
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
