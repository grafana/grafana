import React, { useContext } from 'react';
import uPlot from 'uplot';

interface PlotContextType {
  getPlot: () => uPlot | undefined;
  getCanvasBoundingBox: () => DOMRect | undefined;
}

/**
 * @alpha
 */
export const PlotContext = React.createContext<PlotContextType>({} as PlotContextType);

// Exposes uPlot instance and bounding box of the entire canvas and plot area
export const usePlotContext = (): PlotContextType => {
  return useContext<PlotContextType>(PlotContext);
};
