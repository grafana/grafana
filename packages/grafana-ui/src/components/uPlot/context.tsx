import React, { useContext } from 'react';
import uPlot from 'uplot';
export interface PlotContextType {
  plot: uPlot | null;
  getCanvasBoundingBox: () => DOMRect | null;
}

/**
 * @alpha
 */
export const PlotContext = React.createContext<PlotContextType>({} as PlotContextType);

// Exposes uPlot instance and bounding box of the entire canvas and plot area
export const usePlotContext = (): PlotContextType => {
  return useContext<PlotContextType>(PlotContext);
};
