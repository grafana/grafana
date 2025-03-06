import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import PromQlLanguageProvider from '../../language_provider';

import { buildSelector } from './selectorBuilder';
import { DEFAULT_SERIES_LIMIT, EMPTY_SELECTOR, LAST_USED_LABELS_KEY, Metric, METRIC_LABEL } from './types';

/**
 * Context for the Metrics Browser component
 * Provides state and handlers for browsing and selecting Prometheus metrics and labels
 */
interface MetricsBrowserContextType {
  // Error and status state
  err: string;
  setErr: (err: string) => void;
  status: string;
  setStatus: (status: string) => void;

  // Series limit settings
  seriesLimit: string;
  setSeriesLimit: (limit: string) => void;

  // Callback when selector changes
  onChange: (selector: string) => void;

  // Data and selection state
  metrics: Metric[];
  labelKeys: string[];
  labelValues: Record<string, string[]>;
  selectedMetric: string;
  selectedLabelKeys: string[];
  selectedLabelValues: Record<string, string[]>;
  
  // Event handlers
  onMetricClick: (name: string) => void;
  onLabelKeyClick: (name: string) => void;
  onLabelValueClick: (labelKey: string, labelValue: string) => void;
  getSelector: () => string;
  onClearClick: () => void;

  // Validation
  validationStatus: string;
  onValidationClick: () => void;
}

const MetricsBrowserContext = createContext<MetricsBrowserContextType | undefined>(undefined);

type MetricsBrowserProviderProps = {
  languageProvider: PromQlLanguageProvider;
  onChange: (selector: string) => void;
};

/**
 * Filter function to exclude the metric label
 */
const withoutMetricLabel = (ml: string) => ml !== METRIC_LABEL;

/**
 * Provider component for the Metrics Browser context
 * Manages state and data fetching for metrics, labels, and values
 */
export function MetricsBrowserProvider({
  children,
  languageProvider,
  onChange,
}: PropsWithChildren<MetricsBrowserProviderProps>) {
  // State for UI settings and messages
  const [seriesLimit, setSeriesLimit] = useState(DEFAULT_SERIES_LIMIT);
  const [err, setErr] = useState('');
  const [status, setStatus] = useState('Ready');
  const [validationStatus, setValidationStatus] = useState('');

  // State for metrics and labels data
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [selectedMetric, setSelectedMetric] = useState('');
  const [labelKeys, setLabelKeys] = useState<string[]>([]);
  const [selectedLabelKeys, setSelectedLabelKeys] = useState<string[]>([]);
  const [labelValues, setLabelValues] = useState<Record<string, string[]>>({});
  const [selectedLabelValues, setSelectedLabelValues] = useState<Record<string, string[]>>({});

  /**
   * Build a Prometheus selector string from the current selections
   */
  const getSelector = useCallback(
    () => buildSelector(selectedMetric, selectedLabelValues),
    [selectedLabelValues, selectedMetric]
  );

  /**
   * Get metadata details for a metric if available
   */
  const getMetricDetails = useCallback(
    (metricName: string) => {
      const meta = languageProvider.metricsMetadata;
      return meta && meta[metricName] ? `(${meta[metricName].type}) ${meta[metricName].help}` : undefined;
    },
    [languageProvider.metricsMetadata]
  );

  /**
   * Validate the current selector by checking how many labels it matches
   */
  const onValidationClick = useCallback(() => {
    const selector = getSelector();
    setValidationStatus(`Validating selector ${selector}`);
    setErr('');
    
    languageProvider.fetchLabelsWithMatch(selector)
      .then((results) => {
        setValidationStatus(`Selector is valid (${Object.keys(results).length} labels found)`);
      })
      .catch((error) => {
        setErr(`Validation failed: ${error.message || 'Unknown error'}`);
        setValidationStatus('');
      });
  }, [getSelector, languageProvider]);

  const showAllMetrics = useCallback(() => {
    setMetrics(
      languageProvider.metrics.map((m) => ({
        name: m,
        details: getMetricDetails(m),
      }))
    );
  }, [getMetricDetails, languageProvider.metrics]);

  // Initialize component with metrics and saved labels
  useEffect(() => {
    showAllMetrics();

    setLabelKeys([...languageProvider.labelKeys.filter(withoutMetricLabel)]);
    
    try {
      const savedLabelsJson = localStorage.getItem(LAST_USED_LABELS_KEY) || '[]';
      const selectedLabelsFromStorage: string[] = JSON.parse(savedLabelsJson);
      setSelectedLabelKeys(Array.isArray(selectedLabelsFromStorage) ? selectedLabelsFromStorage : []);
    } catch (error) {
      console.error('Failed to load saved label keys:', error);
      setSelectedLabelKeys([]);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch label keys when metric selection changes
  useEffect(() => {
    setStatus('Fetching labels...');
    
    if (selectedMetric !== '') {
      const selector = buildSelector(selectedMetric, selectedLabelValues);
      
      languageProvider.fetchSeriesLabelsMatch(selector)
        .then((fetchedLabelKeys) => {
          setLabelKeys(Object.keys(fetchedLabelKeys).filter(withoutMetricLabel));
          setStatus('Ready');
        })
        .catch((error) => {
          setErr(`Error fetching labels: ${error.message || 'Unknown error'}`);
          setStatus('');
        });
    } else {
      showAllMetrics();
      setLabelKeys([...languageProvider.labelKeys.filter(withoutMetricLabel)]);
      setStatus('Ready');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [languageProvider, selectedMetric]);

  // Fetch label values for selected label keys
  useEffect(() => {
    async function fetchValues() {
      if (selectedLabelKeys.length === 0) {
        setLabelValues({});
        return;
      }

      setStatus('Fetching label values...');
      const newLabelValues: Record<string, string[]> = {};
      let hasErrors = false;

      try {
        for (const lk of selectedLabelKeys) {
          if (labelKeys.includes(lk)) {
            try {
              const selector = getSelector();
              const safeSelector = selector === EMPTY_SELECTOR ? undefined : selector;
              const values = await languageProvider.fetchSeriesValuesWithMatch(lk, safeSelector);
              newLabelValues[lk] = values;
            } catch (error) {
              console.error(`Error fetching values for label ${lk}:`, error);
              newLabelValues[lk] = [];
              hasErrors = true;
            }
          }
        }

        setLabelValues(newLabelValues);

        if (hasErrors) {
          setErr('Some label values could not be loaded');
        } else {
          setStatus('Ready');
        }
      } catch (error) {
        setErr(`Error fetching label values: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    fetchValues();
  }, [getSelector, labelKeys, languageProvider, selectedLabelKeys]);

  // Fetch metrics with new selector
  useEffect(() => {
    async function fetchMetrics() {
      const selector = buildSelector(selectedMetric, selectedLabelValues);
      if (selector === EMPTY_SELECTOR) {
        showAllMetrics();
        return;
      }
      
      setStatus('Fetching metrics...');
      
      try {
        const metricsResult = await languageProvider.fetchSeriesValuesWithMatch(METRIC_LABEL, selector);
        setMetrics(metricsResult.map((m) => ({ name: m, details: getMetricDetails(m) })));
        setStatus('Ready');
      } catch (error) {
        setErr(`Error fetching metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setStatus('');
      }
    }

    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [languageProvider, selectedLabelValues]);

  /**
   * Handle click on a metric name to toggle selection
   */
  const onMetricClick = useCallback(
    (metricName: string) => setSelectedMetric(selectedMetric !== metricName ? metricName : ''),
    [selectedMetric]
  );

  /**
   * Handle click on a label key to toggle selection
   */
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

  /**
   * Handle click on a label value to toggle selection
   */
  const onLabelValueClick = useCallback(
    (labelKey: string, labelValue: string) => {
      const newSelectedLabelValues = { ...selectedLabelValues };
      
      // Initialize array if it doesn't exist
      if (!newSelectedLabelValues[labelKey]) {
        newSelectedLabelValues[labelKey] = [];
      }
      
      const lvIdx = newSelectedLabelValues[labelKey].indexOf(labelValue);
      
      if (lvIdx === -1) {
        newSelectedLabelValues[labelKey].push(labelValue);
      } else {
        newSelectedLabelValues[labelKey].splice(lvIdx, 1);
      }
      
      // Remove empty arrays
      if (newSelectedLabelValues[labelKey].length === 0) {
        delete newSelectedLabelValues[labelKey];
      }
      
      setSelectedLabelValues(newSelectedLabelValues);
    },
    [selectedLabelValues]
  );

  /**
   * Clear all selections
   */
  const onClearClick = useCallback(() => {
    setSelectedMetric('');
    setSelectedLabelKeys([]);
    setSelectedLabelValues({});
    setErr('');
    setStatus('Ready');
    setValidationStatus('');
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
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
    }),
    [
      err,
      status,
      seriesLimit,
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
    ]
  );

  return <MetricsBrowserContext.Provider value={value}>{children}</MetricsBrowserContext.Provider>;
}

/**
 * Hook to access the MetricsBrowser context
 * Must be used within a MetricsBrowserProvider
 */
export function useMetricsBrowser() {
  const context = useContext(MetricsBrowserContext);
  if (context === undefined) {
    throw new Error('useMetricsBrowser must be used within a MetricsBrowserProvider');
  }
  return context;
}
