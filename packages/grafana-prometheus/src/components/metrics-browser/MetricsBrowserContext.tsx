import { createContext, PropsWithChildren, useContext, useState } from 'react';

import { DEFAULT_SERIES_LIMIT } from './types';

interface MetricsBrowserContextType {
  // Series limit state
  seriesLimit: string;
  setSeriesLimit: (limit: string) => void;
}

const MetricsBrowserContext = createContext<MetricsBrowserContextType | undefined>(undefined);

export function MetricsBrowserProvider({ children }: PropsWithChildren) {
  const [seriesLimit, setSeriesLimit] = useState(DEFAULT_SERIES_LIMIT);

  const value = {
    seriesLimit,
    setSeriesLimit,
  };

  return <MetricsBrowserContext.Provider value={value}>{children}</MetricsBrowserContext.Provider>;
}

export function useMetricsBrowser() {
  const context = useContext(MetricsBrowserContext);
  if (context === undefined) {
    throw new Error('useMetricsBrowser must be used within a MetricsBrowserProvider');
  }
  return context;
}
