import { createContext, PropsWithChildren, useContext, useState } from 'react';

import PromQlLanguageProvider from '../../language_provider';

import { DEFAULT_SERIES_LIMIT } from './types';

interface MetricsBrowserContextType {
  seriesLimit: string;
  setSeriesLimit: (limit: string) => void;
  err: string;
  setErr: (err: string) => void;
  status: string;
  setStatus: (status: string) => void;
  languageProvider: PromQlLanguageProvider;
  onChange: (selector: string) => void;
}

const MetricsBrowserContext = createContext<MetricsBrowserContextType | undefined>(undefined);

type MetricsBrowserProviderProps = {
  languageProvider: PromQlLanguageProvider;
  onChange: (selector: string) => void;
};

export function MetricsBrowserProvider({
  children,
  languageProvider,
  onChange,
}: PropsWithChildren<MetricsBrowserProviderProps>) {
  const [seriesLimit, setSeriesLimit] = useState(DEFAULT_SERIES_LIMIT);
  const [status, setStatus] = useState('Ready');
  const [err, setErr] = useState('');

  const value = {
    seriesLimit,
    setSeriesLimit,
    status,
    setStatus,
    err,
    setErr,
    languageProvider,
    onChange,
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
