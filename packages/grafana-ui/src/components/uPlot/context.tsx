import React, { useContext } from 'react';
import uPlot from 'uplot';
import { DashboardCursorSync } from '@grafana/data';

interface PlotContextType {
  getPlot: () => uPlot | undefined;
}

/**
 * @alpha
 */
export const PlotContext = React.createContext<PlotContextType>({} as PlotContextType);

// Exposes uPlot instance and bounding box of the entire canvas and plot area
export const usePlotContext = (): PlotContextType => {
  return useContext<PlotContextType>(PlotContext);
};

export interface PlotSyncConfig {
  key: string;
  sync: DashboardCursorSync;
}

const PlotSyncContext = React.createContext<PlotSyncConfig | null>(null);

interface PlotSyncContextProviderProps {
  config: PlotSyncConfig;
  children: React.ReactNode;
}

export function PlotSyncContextProvider({ config, children }: PlotSyncContextProviderProps) {
  const sync = config.sync !== DashboardCursorSync.Off ? uPlot.sync(config.key) : undefined;
  const value = sync ? { ...config, key: sync.key } : null;
  return <PlotSyncContext.Provider value={value}>{children}</PlotSyncContext.Provider>;
}
export const usePlotSync = () => {
  return useContext(PlotSyncContext);
};
