import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useState } from 'react';

import PromQlLanguageProvider from '../../language_provider';

import { buildSelector } from './selectorBuilder';
import { DEFAULT_SERIES_LIMIT, EMPTY_SELECTOR, LAST_USED_LABELS_KEY, Metric, METRIC_LABEL } from './types';

interface MetricsBrowserContextType {
  err: string;
  setErr: (err: string) => void;
  status: string;
  setStatus: (status: string) => void;

  seriesLimit: string;
  setSeriesLimit: (limit: string) => void;

  onChange: (selector: string) => void;

  metrics: Metric[];
  labelKeys: string[];
  labelValues: Record<string, string[]>;
  selectedMetric: string;
  selectedLabelKeys: string[];
  selectedLabelValues: Record<string, string[]>;
  onMetricClick: (name: string) => void;
  onLabelKeyClick: (name: string) => void;
  onLabelValueClick: (labelKey: string, labelValue: string) => void;
  getSelector: () => string;
  onClearClick: () => void;

  validationStatus: string;
  onValidationClick: () => void;
}

const MetricsBrowserContext = createContext<MetricsBrowserContextType | undefined>(undefined);

type MetricsBrowserProviderProps = {
  languageProvider: PromQlLanguageProvider;
  onChange: (selector: string) => void;
};

const withoutMetricLabel = (ml: string) => ml !== METRIC_LABEL;

export function MetricsBrowserProvider({
  children,
  languageProvider,
  onChange,
}: PropsWithChildren<MetricsBrowserProviderProps>) {
  const [seriesLimit, setSeriesLimit] = useState(DEFAULT_SERIES_LIMIT);
  const [err, setErr] = useState('');
  const [status, setStatus] = useState('Ready');
  const [validationStatus, setValidationStatus] = useState('');

  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [selectedMetric, setSelectedMetric] = useState('');
  const [labelKeys, setLabelKeys] = useState<string[]>([]);
  const [selectedLabelKeys, setSelectedLabelKeys] = useState<string[]>([]);
  const [labelValues, setLabelValues] = useState<Record<string, string[]>>({});
  const [selectedLabelValues, setSelectedLabelValues] = useState<Record<string, string[]>>({});

  const getSelector = useCallback(
    () => buildSelector(selectedMetric, selectedLabelValues),
    [selectedLabelValues, selectedMetric]
  );

  const getMetricDetails = useCallback(
    (metricName: string) => {
      const meta = languageProvider.metricsMetadata;
      return meta && meta[metricName] ? `(${meta[metricName].type}) ${meta[metricName].help}` : undefined;
    },
    [languageProvider.metricsMetadata]
  );

  const onValidationClick = useCallback(() => {
    const selector = getSelector();
    setValidationStatus(`Validating selector ${selector}`);
    setErr('');
    languageProvider.fetchLabelsWithMatch(selector).then((results) => {
      setValidationStatus(`Selector is valid (${Object.keys(results).length} labels found)`);
    });
  }, [getSelector, languageProvider]);

  useEffect(() => {
    setMetrics(
      languageProvider.metrics.map((m) => ({
        name: m,
        details: getMetricDetails(m),
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
      const selector = buildSelector(selectedMetric, selectedLabelValues);
      languageProvider.fetchSeriesLabelsMatch(selector).then((fetchedLabelKeys) => {
        setLabelKeys(Object.keys(fetchedLabelKeys).filter(withoutMetricLabel));
      });
    } else {
      setLabelKeys([...languageProvider.labelKeys.filter(withoutMetricLabel)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [languageProvider, selectedMetric]);

  // Fetch label values
  useEffect(() => {
    async function fetchValues() {
      const newLabelValues: Record<string, string[]> = {};

      for (const lk of selectedLabelKeys) {
        if (labelKeys.includes(lk)) {
          const values = await languageProvider.fetchSeriesValuesWithMatch(lk, undefined);
          newLabelValues[lk] = values;
        } else {
          delete newLabelValues[lk];
        }
      }

      setLabelValues(newLabelValues);
    }

    fetchValues();
  }, [labelKeys, languageProvider, selectedLabelKeys]);

  // Fetch metrics with new selector
  useEffect(() => {
    async function fetchMetrics() {
      const selector = buildSelector(selectedMetric, selectedLabelValues);
      if (selector === EMPTY_SELECTOR) {
        return;
      }
      const metrics = await languageProvider.fetchSeriesValuesWithMatch(METRIC_LABEL, selector);
      setMetrics(metrics.map((m) => ({ name: m, details: getMetricDetails(m) })));
    }

    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [languageProvider, selectedLabelValues]);

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
    (labelKey: string, labelValue: string) => {
      console.log({ labelKey, labelValue });
      const newSelectedLabelValues = { ...selectedLabelValues };
      newSelectedLabelValues[labelKey] ??= [];
      const lvIdx = newSelectedLabelValues[labelKey].indexOf(labelValue) ?? -1;
      if (lvIdx === -1) {
        newSelectedLabelValues[labelKey].push(labelValue);
      } else {
        newSelectedLabelValues[labelKey].splice(lvIdx, 1);
      }
      setSelectedLabelValues(newSelectedLabelValues);
    },
    [selectedLabelValues]
  );

  const onClearClick = useCallback(() => {
    setSelectedMetric('');
    setSelectedLabelKeys([]);
    setSelectedLabelValues({});
  }, []);

  const value: MetricsBrowserContextType = {
    err,
    setErr,
    status,
    setStatus,

    seriesLimit,
    setSeriesLimit,
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
    getSelector,
    onClearClick,

    validationStatus,
    onValidationClick,
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
