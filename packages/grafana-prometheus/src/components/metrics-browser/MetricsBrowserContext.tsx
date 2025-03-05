import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useState } from 'react';

import { TimeRange } from '@grafana/data';

import PromQlLanguageProvider from '../../language_provider';

import { DEFAULT_SERIES_LIMIT, LAST_USED_LABELS_KEY, Metric, METRIC_LABEL } from './types';

interface MetricsBrowserContextType {
  err: string;
  setErr: (err: string) => void;
  status: string;
  setStatus: (status: string) => void;

  seriesLimit: string;
  setSeriesLimit: (limit: string) => void;

  languageProvider: PromQlLanguageProvider;
  onChange: (selector: string) => void;

  metrics: Metric[];
  labelKeys: string[];
  labelValues: Record<string, string[]>;
  selectedMetric: string;
  selectedLabelKeys: string[];
  selectedLabelValues: string[];
  onMetricClick: (name: string) => void;
  onLabelKeyClick: (name: string) => void;
  onLabelValueClick: (name: string) => void;
}

const MetricsBrowserContext = createContext<MetricsBrowserContextType | undefined>(undefined);

type MetricsBrowserProviderProps = {
  languageProvider: PromQlLanguageProvider;
  onChange: (selector: string) => void;
  timeRange?: TimeRange;
};

const withoutMetricLabel = (ml: string) => ml !== METRIC_LABEL;

export function MetricsBrowserProvider({
  children,
  languageProvider,
  onChange,
  // FIXME time range changes should reflect on metrics and labels
  timeRange,
}: PropsWithChildren<MetricsBrowserProviderProps>) {
  const [seriesLimit, setSeriesLimit] = useState(DEFAULT_SERIES_LIMIT);
  const [err, setErr] = useState('');
  const [status, setStatus] = useState('Ready');

  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [selectedMetric, setSelectedMetric] = useState('');
  const [labelKeys, setLabelKeys] = useState<string[]>([]);
  const [selectedLabelKeys, setSelectedLabelKeys] = useState<string[]>([]);
  const [labelValues, setLabelValues] = useState<Record<string, string[]>>({});
  const [selectedLabelValues, setSelectedLabelValues] = useState<string[]>([]);

  useEffect(() => {
    const meta = languageProvider.metricsMetadata;

    setMetrics(
      languageProvider.metrics.map((m) => ({
        name: m,
        details: meta && meta[m] ? `(${meta.type}) ${meta.help}` : undefined,
      }))
    );
    setLabelKeys([...languageProvider.labelKeys.filter(withoutMetricLabel)]);
    const selectedLabelsFromStorage: string[] = JSON.parse(localStorage.getItem(LAST_USED_LABELS_KEY) ?? `[]`) ?? [];
    setSelectedLabelKeys(selectedLabelsFromStorage);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch labels
  useEffect(() => {
    if (selectedMetric !== '') {
      // TODO use selector insteadof selectedMetric
      languageProvider.fetchSeriesLabelsMatch(selectedMetric).then((fetchedLabelKeys) => {
        setLabelKeys(Object.keys(fetchedLabelKeys).filter(withoutMetricLabel));
      });
    } else {
      setLabelKeys([...languageProvider.labelKeys.filter(withoutMetricLabel)]);
    }
  }, [languageProvider, selectedMetric]);

  // Fetch label values
  useEffect(() => {
    async function fetchValues() {
      const newLabelValues: Record<string, string[]> = {};

      for (const lk of selectedLabelKeys) {
        const values = await languageProvider.fetchSeriesValuesWithMatch(lk, undefined);
        newLabelValues[lk] = values;
      }

      setLabelValues(newLabelValues);
    }

    fetchValues();
  }, [languageProvider, selectedLabelKeys]);

  const onMetricClick = useCallback(
    (metricName: string) => setSelectedMetric(selectedMetric !== metricName ? metricName : ''),
    [selectedMetric]
  );

  const onLabelKeyClick = useCallback(
    (labelKey: string) => {
      const newSelectedLabelKeys = [...selectedLabelKeys];
      const lkIdx = newSelectedLabelKeys.indexOf(labelKey);
      if (lkIdx === -1) {
        newSelectedLabelKeys.push(labelKey);
      } else {
        newSelectedLabelKeys.splice(lkIdx, 1);
      }
      localStorage.setItem(LAST_USED_LABELS_KEY, JSON.stringify(newSelectedLabelKeys));
      setSelectedLabelKeys(newSelectedLabelKeys);
    },
    [selectedLabelKeys]
  );

  const onLabelValueClick = useCallback(
    (labelValue: string) => {
      const newSelectedLabelValues = [...selectedLabelValues];
      const lvIdx = newSelectedLabelValues.indexOf(labelValue);
      if (lvIdx === -1) {
        newSelectedLabelValues.push(labelValue);
      } else {
        newSelectedLabelValues.splice(lvIdx, 1);
      }
      setSelectedLabelValues(newSelectedLabelValues);
    },
    [selectedLabelValues]
  );

  const value: MetricsBrowserContextType = {
    err,
    setErr,
    status,
    setStatus,

    seriesLimit,
    setSeriesLimit,
    languageProvider,
    onChange,

    metrics,
    labelKeys,
    labelValues,
    selectedMetric,
    selectedLabelKeys,
    selectedLabelValues,
    onMetricClick,
    onLabelKeyClick,
    onLabelValueClick,
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
