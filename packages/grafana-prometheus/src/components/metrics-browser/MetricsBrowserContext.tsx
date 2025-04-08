import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { TimeRange } from '@grafana/data';

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
  timeRange: TimeRange;
  languageProvider: PromQlLanguageProvider;
  onChange: (selector: string) => void;
};

/**
 * Provider component for the Metrics Browser context
 * Manages state and data fetching for metrics, labels, and values
 */
export function MetricsBrowserProvider({
  children,
  timeRange,
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
  const [lastSelectedLabelKey, setLastSelectedLabelKey] = useState('');

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

  const showAllMetrics = useCallback(() => {
    setMetrics(
      languageProvider.metrics.map((m) => ({
        name: m,
        details: getMetricDetails(m),
      }))
    );
  }, [getMetricDetails, languageProvider.metrics]);

  const showAllLabelKeys = useCallback(() => {
    setLabelKeys([...languageProvider.labelKeys]);
  }, [languageProvider.labelKeys]);

  /**
   * Set the selected label keys on initialization
   */
  const setSelectedLabelKeysFromLocalStorage = useCallback(() => {
    try {
      const savedLabelsJson = localStorage.getItem(LAST_USED_LABELS_KEY) || '[]';
      const selectedLabelsFromStorage: string[] = JSON.parse(savedLabelsJson);
      setSelectedLabelKeys(Array.isArray(selectedLabelsFromStorage) ? selectedLabelsFromStorage : []);
    } catch (error) {
      console.error('Failed to load saved label keys:', error);
      setSelectedLabelKeys([]);
    }
  }, []);

  // Initialize component with metrics and saved labels
  useEffect(() => {
    showAllMetrics();
    showAllLabelKeys();
    setSelectedLabelKeysFromLocalStorage();

    // We want this to be run only once in the beginning
    // so we keep the dependency array empty
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch label keys when metric selection changes
  useEffect(() => {
    setStatus('Fetching labels...');

    if (selectedMetric === '') {
      showAllMetrics();
      showAllLabelKeys();
      setStatus('Ready');
      return;
    }

    const selector = getSelector();

    languageProvider
      .fetchSeriesLabelsMatch(timeRange, selector, validSeriesLimit(seriesLimit))
      .then((fetchedLabelKeys) => {
        setSelectedLabelKeysFromLocalStorage();
        setLabelKeys(Object.keys(fetchedLabelKeys));
        setStatus('Ready');
      })
      .catch((error) => {
        setErr(`Error fetching labels: ${error.message || 'Unknown error'}`);
        setStatus('');
      });

    // When a selectedMetric changed we should fetch the labels
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [languageProvider, selectedMetric]);

  // Fetch label keys when metrics updated after selecting a label value
  // When we select single/multiple label value without selecting a metric name
  // We get new metrics based on that selection. Based on this we need to re-fetch the label keys
  useEffect(() => {
    if (getSelector() === '{}') {
      showAllLabelKeys();
      return;
    }

    if (metrics.length === 0) {
      setLabelKeys([]);
      return;
    }

    setStatus('Fetching labels...');
    const selector = `{__name__=~"${metrics.map((m) => m.name).join('|')}"}`;
    languageProvider
      .fetchSeriesLabelsMatch(timeRange, selector, validSeriesLimit(seriesLimit))
      .then((fetchedLabelKeysRecord) => {
        const fetchedLabelKeys = Object.keys(fetchedLabelKeysRecord);
        const newSelectedLabelKeys = selectedLabelKeys.filter((slk) => fetchedLabelKeys.includes(slk));
        setSelectedLabelKeys(newSelectedLabelKeys);
        setLabelKeys(fetchedLabelKeys);
        setStatus('Ready');
      })
      .catch((error) => {
        setErr(`Error fetching labels: ${error.message || 'Unknown error'}`);
        setStatus('');
      });

    // We need to fetch values only when metrics list has changed.
    // That means we have new set of metrics and labels so we need to update the values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics]);

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

      for (const lk of selectedLabelKeys) {
        // If the key is not in current labelKey list or if it is hidden
        // we don't even try to fetch its values
        if (!labelKeys.includes(lk)) {
          continue;
        }

        const selector = getSelector();
        const safeSelector = selector === EMPTY_SELECTOR ? undefined : selector;

        try {
          const values = await languageProvider.fetchSeriesValuesWithMatch(
            timeRange,
            lk,
            safeSelector,
            `MetricsBrowser_LV_${lk}`,
            validSeriesLimit(seriesLimit)
          );
          // We don't want to discard values from last selected list.
          // User might want to select more.
          if (lastSelectedLabelKey === lk) {
            newLabelValues[lk] = Array.from(new Set([...labelValues[lk], ...values]));
          } else {
            // If there are already selected values merge them with the fetched values.
            newLabelValues[lk] = Array.from(new Set([...(selectedLabelValues[lk] ?? []), ...values]));
          }
        } catch (error) {
          console.error(`Error fetching values for label ${lk}:`, error);
          newLabelValues[lk] = [];
          hasErrors = true;
        }
      }

      setLabelValues(newLabelValues);

      if (hasErrors) {
        setErr('Some label values could not be loaded');
      } else {
        setStatus('Ready');
      }
    }

    fetchValues();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelKeys, selectedLabelKeys]);

  // Fetch metrics with new selector
  useEffect(() => {
    async function fetchMetrics() {
      const selector = getSelector();
      if (selector === EMPTY_SELECTOR) {
        showAllMetrics();
        return;
      }

      setStatus('Fetching metrics...');

      try {
        const metricsResult = await languageProvider.fetchSeriesValuesWithMatch(
          timeRange,
          METRIC_LABEL,
          selector,
          'MetricsBrowser_M',
          validSeriesLimit(seriesLimit)
        );
        setMetrics(metricsResult.map((m) => ({ name: m, details: getMetricDetails(m) })));
        setStatus('Ready');
      } catch (error) {
        setErr(`Error fetching metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setStatus('');
      }
    }

    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLabelValues]);

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

      if (labelKey !== lastSelectedLabelKey) {
        setLastSelectedLabelKey(labelKey);
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
    [lastSelectedLabelKey, selectedLabelValues]
  );

  /**
   * Validate the current selector by checking how many labels it matches
   */
  const onValidationClick = useCallback(() => {
    const selector = getSelector();
    setValidationStatus(`Validating selector ${selector}`);
    setErr('');

    languageProvider
      .fetchLabelsWithMatch(timeRange, selector)
      .then((results) => {
        setValidationStatus(`Selector is valid (${Object.keys(results).length} labels found)`);
      })
      .catch((error) => {
        setErr(`Validation failed: ${error.message || 'Unknown error'}`);
        setValidationStatus('');
      });
  }, [getSelector, languageProvider, timeRange]);

  /**
   * Clear all selections
   */
  const onClearClick = useCallback(() => {
    localStorage.setItem(LAST_USED_LABELS_KEY, '[]');

    setSelectedMetric('');
    setSelectedLabelKeys([]);
    setSelectedLabelValues({});

    showAllMetrics();
    setSelectedLabelKeysFromLocalStorage();
    showAllLabelKeys();

    setErr('');
    setStatus('Ready');
    setValidationStatus('');
  }, [setSelectedLabelKeysFromLocalStorage, showAllLabelKeys, showAllMetrics]);

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

function validSeriesLimit(seriesLimit: string): number {
  const limit = Number(seriesLimit);
  return isNaN(limit) ? +DEFAULT_SERIES_LIMIT : limit;
}
