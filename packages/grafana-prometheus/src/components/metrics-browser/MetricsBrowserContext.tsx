import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { TimeRange } from '@grafana/data';

import PromQlLanguageProvider from '../../language_provider';

import { DEFAULT_SERIES_LIMIT, METRIC_LABEL } from './types';

interface MetricsBrowserContextType {
  seriesLimit: string;
  setSeriesLimit: (limit: string) => void;
  err: string;
  setErr: (err: string) => void;
  status: string;
  setStatus: (status: string) => void;
  languageProvider: PromQlLanguageProvider;
  onChange: (selector: string) => void;

  metrics: string[];
  selectedMetric: string;
  labelKeys: string[];
  selectedLabelKeys: string[];
  labelValues: Record<string, string[]>;
  selectedLabelValues: string[];
}

const MetricsBrowserContext = createContext<MetricsBrowserContextType | undefined>(undefined);

type MetricsBrowserProviderProps = {
  languageProvider: PromQlLanguageProvider;
  onChange: (selector: string) => void;
  timeRange?: TimeRange;
};

export function MetricsBrowserProvider({
  children,
  languageProvider,
  onChange,
  timeRange,
}: PropsWithChildren<MetricsBrowserProviderProps>) {
  const [labelKeys, setLabelKeys] = useState<string[]>(['__name__']);
  const [labelValues, setLabelValues] = useState<Record<string, string[]>>({});

  const [selectedMetric, setSelectedMetric] = useState('');
  const [selectedLabelKeys, setSelectedLabelKeys] = useState<string[]>([]);
  const [selectedLabelValues, setSelectedLabelValues] = useState<string[]>([]);

  const metrics = useMemo(() => labelValues[METRIC_LABEL], [labelValues]);

  const [seriesLimit, setSeriesLimit] = useState(DEFAULT_SERIES_LIMIT);
  const [status, setStatus] = useState('Ready');
  const [err, setErr] = useState('');

  useEffect(() => {
    async function init() {
      setLabelKeys([...languageProvider.labelKeys]);
      setLabelValues({ [METRIC_LABEL]: [...languageProvider.metrics] });

      setSelectedMetric('');
      setSelectedLabelKeys([]);
      setSelectedLabelValues([]);
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = {
    seriesLimit,
    setSeriesLimit,
    status,
    setStatus,
    err,
    setErr,
    languageProvider,
    onChange,
    metrics,
    labelKeys,
    selectedLabelKeys,
    labelValues,
    selectedLabelValues,
    selectedMetric,
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
