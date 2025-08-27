import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useDebounce } from 'react-use';

import { TimeRange } from '@grafana/data';

import { EMPTY_SELECTOR, LAST_USED_LABELS_KEY, METRIC_LABEL } from '../../constants';
import { PrometheusLanguageProviderInterface } from '../../language_provider';

import { Metric } from './MetricsBrowserContext';
import { buildSelector } from './selectorBuilder';

export const useMetricsLabelsValues = (timeRange: TimeRange, languageProvider: PrometheusLanguageProviderInterface) => {
  const timeRangeRef = useRef<TimeRange>(timeRange);
  const lastSeriesLimitRef = useRef(languageProvider.datasource.seriesLimit);
  const isInitializedRef = useRef(false);

  const [seriesLimit, setSeriesLimit] = useState(languageProvider.datasource.seriesLimit);
  const [err, setErr] = useState('');
  const [status, setStatus] = useState('Ready');
  const [validationStatus, setValidationStatus] = useState('');

  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [selectedMetric, setSelectedMetric] = useState('');
  const [labelKeys, setLabelKeys] = useState<string[]>([]);
  const [selectedLabelKeys, setSelectedLabelKeys] = useState<string[]>([]);
  const [lastSelectedLabelKey, setLastSelectedLabelKey] = useState('');
  const [labelValues, setLabelValues] = useState<Record<string, string[]>>({});
  const [selectedLabelValues, setSelectedLabelValues] = useState<Record<string, string[]>>({});
  const [isLoadingLabelKeys, setIsLoadingLabelKeys] = useState(false);
  const [isLoadingLabelValues, setIsLoadingLabelValues] = useState(false);

  // Memoize the effective series limit to use the default when seriesLimit is empty
  const effectiveLimit = useMemo(() => seriesLimit, [seriesLimit]);

  // We don't want to trigger fetching for small amount of time changes.
  // When MetricsBrowser re-renders for any reason we might receive a new timerange.
  // This particularly happens when we have relative time ranges: from: now, to: now-1h
  useEffect(() => {
    if (
      timeRange.to.diff(timeRangeRef.current.to, 'second') >= 5 &&
      timeRange.from.diff(timeRangeRef.current.from, 'second') >= 5
    ) {
      timeRangeRef.current = timeRange;
    }
  }, [timeRange]);

  // Handler for error processing - logs the error and updates UI state
  const handleError = useCallback((e: unknown, msg: string) => {
    if (e instanceof Error) {
      setErr(`${msg}: ${e.message}`);
    } else {
      setErr(`${msg}: Unknown error`);
    }
    setStatus('');
  }, []);

  // Get metadata details for a metric if available
  const getMetricDetails = useCallback(
    (metricName: string) => {
      const meta = languageProvider.retrieveMetricsMetadata();
      return meta && meta[metricName] ? `(${meta[metricName].type}) ${meta[metricName].help}` : undefined;
    },
    [languageProvider]
  );

  // Builds a safe selector string from metric name and label values
  // Prometheus API doesn't allow empty matchers. This is bad => match[]={}
  // Converts EMPTY_SELECTOR to undefined as some API calls need that
  const buildSafeSelector = useCallback((metric: string, labelValues: Record<string, string[]>) => {
    const selector = buildSelector(metric, labelValues);
    return selector === EMPTY_SELECTOR ? undefined : selector;
  }, []);

  // Loads label keys from localStorage and filters them against available labels
  // This ensures we only show label keys that are actually available in the current context
  const loadSelectedLabelsFromStorage = useCallback(
    (availableLabelKeys: string[]) => {
      try {
        const labelKeysInLocalStorageAsString = localStorage.getItem(LAST_USED_LABELS_KEY) || '[]';
        const labelKeysInLocalStorage = JSON.parse(labelKeysInLocalStorageAsString);
        return labelKeysInLocalStorage.filter((slk: string) => availableLabelKeys.includes(slk));
      } catch (e) {
        handleError(e, 'Failed to load saved label keys');
        return [];
      }
    },
    [handleError]
  );

  // Fetches metrics that match the given selector
  // Transforms raw metric strings into Metric objects with metadata
  const fetchMetrics = useCallback(
    async (safeSelector?: string) => {
      try {
        const fetchedMetrics = await languageProvider.queryLabelValues(
          timeRangeRef.current,
          METRIC_LABEL,
          safeSelector,
          effectiveLimit
        );
        return fetchedMetrics.map((m) => ({
          name: m,
          details: getMetricDetails(m),
        }));
      } catch (e) {
        handleError(e, 'Error fetching metrics');
        return [];
      }
    },
    [getMetricDetails, handleError, languageProvider, effectiveLimit]
  );

  // Fetches label keys based on an optional selector
  // Uses different APIs depending on whether a selector is provided
  const fetchLabelKeys = useCallback(
    async (safeSelector?: string) => {
      try {
        return (
          (await languageProvider.queryLabelKeys(timeRangeRef.current, safeSelector || undefined, effectiveLimit)) ?? []
        );
      } catch (e) {
        handleError(e, 'Error fetching labels');
        return [];
      }
    },
    [handleError, languageProvider, effectiveLimit]
  );

  // Fetches values for multiple label keys and also prepares selected values
  const fetchLabelValues = useCallback(
    async (labelKeys: string[], safeSelector?: string) => {
      const transformedLabelValues: Record<string, string[]> = {};
      const newSelectedLabelValues: Record<string, string[]> = {};
      for (const lk of labelKeys) {
        try {
          const values = await languageProvider.queryLabelValues(
            timeRangeRef.current,
            lk,
            safeSelector,
            effectiveLimit
          );
          transformedLabelValues[lk] = values;
          if (selectedLabelValues[lk]) {
            newSelectedLabelValues[lk] = [...selectedLabelValues[lk]];
          }

          setErr('');
        } catch (e) {
          handleError(e, 'Error fetching label values');
        }
      }
      return [transformedLabelValues, newSelectedLabelValues];
    },
    [handleError, languageProvider, selectedLabelValues, effectiveLimit]
  );

  // Initial set up of the Metrics Browser
  // This is called when "Clear" button clicked.
  const initialize = useCallback(
    async (metric: string, labelValues: Record<string, string[]>) => {
      const selector = buildSelector(metric, labelValues);
      const safeSelector = selector === EMPTY_SELECTOR ? undefined : selector;

      // Metrics
      const transformedMetrics: Metric[] = await fetchMetrics(safeSelector);

      // Labels
      setIsLoadingLabelKeys(true);
      setIsLoadingLabelValues(true);
      const transformedLabelKeys: string[] = await fetchLabelKeys(safeSelector);

      // Selected Labels
      const labelKeysInLocalStorage: string[] = loadSelectedLabelsFromStorage(transformedLabelKeys);

      // Selected Labels' Values
      const [transformedLabelValues] = await fetchLabelValues(labelKeysInLocalStorage, safeSelector);

      setMetrics(transformedMetrics);
      setLabelKeys(transformedLabelKeys);
      setIsLoadingLabelKeys(false);
      setSelectedLabelKeys(labelKeysInLocalStorage);
      setLabelValues(transformedLabelValues);
      setIsLoadingLabelValues(false);
    },
    [fetchLabelKeys, fetchLabelValues, fetchMetrics, loadSelectedLabelsFromStorage]
  );

  // Initialize the hook
  useEffect(() => {
    initialize(selectedMetric, selectedLabelValues);
    isInitializedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // We use debounce here to prevent fetching data on every keystroke
  // We also track the seriesLimit change to prevent fetching twice right after the initialization
  useDebounce(
    () => {
      if (isInitializedRef.current && lastSeriesLimitRef.current !== seriesLimit) {
        initialize(selectedMetric, selectedLabelValues);
        lastSeriesLimitRef.current = seriesLimit;
      }
    },
    300,
    [seriesLimit]
  );

  // Handles metric selection changes.
  // If a metric selected it fetches the labels of that metric
  // Otherwise it fetches all the labels.
  // Based on the fetched labels, label value list is updated.
  // If a label key is not present, its values are removed from the list.
  const handleSelectedMetricChange = async (metricName: string) => {
    const newSelectedMetric = selectedMetric !== metricName ? metricName : '';
    const selector = buildSafeSelector(newSelectedMetric, selectedLabelValues);
    try {
      const fetchedMetrics = await fetchMetrics(selector);
      setIsLoadingLabelKeys(true);
      const fetchedLabelKeys = await fetchLabelKeys(selector);
      const newSelectedLabelKeys = selectedLabelKeys.filter((slk) => fetchedLabelKeys.includes(slk));

      setIsLoadingLabelValues(true);
      const [transformedLabelValues, newSelectedLabelValues] = await fetchLabelValues(
        newSelectedLabelKeys,
        newSelectedMetric === '' ? undefined : selector
      );

      setMetrics(fetchedMetrics);
      setSelectedMetric(newSelectedMetric);
      setLabelKeys(fetchedLabelKeys);
      setIsLoadingLabelKeys(false);
      setSelectedLabelKeys(newSelectedLabelKeys);
      setLabelValues(transformedLabelValues);
      setIsLoadingLabelValues(false);
      setSelectedLabelValues(newSelectedLabelValues);
    } catch (e: unknown) {
      handleError(e, 'Error fetching labels');
    }
  };

  // Handles when a label key selection changed
  // If it's a selection, it fetches the values based on the up-to-date selector
  // If it's a de-selection, it clears the values from the list
  const handleSelectedLabelKeyChange = async (labelKey: string) => {
    const newSelectedLabelKeys = [...selectedLabelKeys];
    const lkIdx = newSelectedLabelKeys.indexOf(labelKey);
    const newLabelValues: Record<string, string[]> = { ...labelValues };
    const newSelectedLabelValues: Record<string, string[]> = { ...selectedLabelValues };

    if (lkIdx === -1) {
      // Label key is not in the selectedLabelKeys. Let's add it.
      newSelectedLabelKeys.push(labelKey);
      const safeSelector = buildSafeSelector(selectedMetric, selectedLabelValues);
      setIsLoadingLabelValues(true);
      const [values] = await fetchLabelValues([labelKey], safeSelector);
      newLabelValues[labelKey] = values[labelKey];
    } else {
      // Label key is in the selectedLabelKeys. Removing it and its values.
      newSelectedLabelKeys.splice(lkIdx, 1);
      delete newLabelValues[labelKey];
      delete newSelectedLabelValues[labelKey];
    }

    localStorage.setItem(LAST_USED_LABELS_KEY, JSON.stringify(newSelectedLabelKeys));
    setSelectedLabelKeys(newSelectedLabelKeys);
    setLabelValues(newLabelValues);
    setIsLoadingLabelValues(false);
    setSelectedLabelValues(newSelectedLabelValues);
  };

  // Handle the labelValue click based on isSelected value.
  // If it is false we need to remove it from selected values
  // If it is true then we need to add it to selected values
  // Then we first fetch the values of each selected label key using the up-to-date selector
  // We merged the fetched and existing list for the list we interact.
  // Because we might want to select more labels from the same list.
  // For other value lists we use the intersection of fetched and selected values.
  // Then we fetch the metrics based on new selector we have after value fetch
  // Then we fetch the labels keys of the metrics we fetched.
  const handleSelectedLabelValueChange = async (labelKey: string, labelValue: string, isSelected: boolean) => {
    const newSelectedLabelValues = { ...selectedLabelValues };
    let newLastSelectedLabelKey = lastSelectedLabelKey;
    if (labelKey !== lastSelectedLabelKey) {
      newLastSelectedLabelKey = labelKey;
    }

    // Label value selected
    if (isSelected) {
      if (!newSelectedLabelValues[labelKey]) {
        newSelectedLabelValues[labelKey] = [];
      }
      newSelectedLabelValues[labelKey].push(labelValue);
    } else {
      newSelectedLabelValues[labelKey].splice(newSelectedLabelValues[labelKey].indexOf(labelValue), 1);
      if (newSelectedLabelValues[labelKey].length === 0) {
        delete newSelectedLabelValues[labelKey];
      }
    }

    let safeSelector = buildSafeSelector(selectedMetric, newSelectedLabelValues);

    // Fetch new values
    let newLabelValues: Record<string, string[]> = {};
    if (selectedLabelKeys.length !== 0) {
      setIsLoadingLabelValues(true);
      for (const lk of selectedLabelKeys) {
        try {
          const fetchedLabelValues = await languageProvider.queryLabelValues(
            timeRange,
            lk,
            safeSelector,
            effectiveLimit
          );

          // We don't want to discard values from last selected list.
          // User might want to select more.
          if (newLastSelectedLabelKey === lk) {
            newLabelValues[lk] = Array.from(new Set([...labelValues[lk], ...fetchedLabelValues]));
          } else {
            // If there are already selected values merge them with the fetched values.
            newLabelValues[lk] = fetchedLabelValues;
            // Discard selected label values if they are not in response
            newSelectedLabelValues[lk] = (newSelectedLabelValues[lk] ?? []).filter((item) =>
              fetchedLabelValues.includes(item)
            );
          }

          setErr('');
        } catch (e: unknown) {
          handleError(e, 'Error fetching label values');
        }
      }
    }

    // rebuild the selector based on the new selected label values
    safeSelector = buildSafeSelector(selectedMetric, newSelectedLabelValues);

    // Fetch metrics
    const newMetrics: Metric[] = await fetchMetrics(safeSelector);

    // Fetch label keys
    // If there is no metric or label value selected fetch all the keys instead of creating a selector
    setIsLoadingLabelKeys(true);
    let newLabelKeys: string[] = [];
    if (!safeSelector) {
      newLabelKeys = await fetchLabelKeys(undefined);
    } else {
      const labelKeysSelector = `{${METRIC_LABEL}=~"${newMetrics.map((m) => m.name).join('|')}"}`;
      newLabelKeys = await fetchLabelKeys(labelKeysSelector);
    }
    const newSelectedLabelKeys: string[] = loadSelectedLabelsFromStorage(newLabelKeys);

    setMetrics(newMetrics);
    setLabelKeys(newLabelKeys);
    setIsLoadingLabelKeys(false);
    setSelectedLabelKeys(newSelectedLabelKeys);
    setLastSelectedLabelKey(newLastSelectedLabelKey);
    setLabelValues(newLabelValues);
    setIsLoadingLabelValues(false);
    setSelectedLabelValues(newSelectedLabelValues);
  };

  // Validating if the selections we have can create a valid query
  const handleValidation = async () => {
    const selector = buildSelector(selectedMetric, selectedLabelValues);
    setValidationStatus(`Validating selector ${selector}`);
    setErr('');

    try {
      const results = await languageProvider.queryLabelKeys(timeRangeRef.current, selector, effectiveLimit);
      setValidationStatus(`Selector is valid (${Object.keys(results).length} labels found)`);
    } catch (e) {
      handleError(e, 'Validation failed');
      setValidationStatus('');
    }
  };

  // Clears all the selections even the ones in localStorage
  const handleClear = () => {
    localStorage.setItem(LAST_USED_LABELS_KEY, '[]');

    setSelectedMetric('');
    setSelectedLabelKeys([]);
    setSelectedLabelValues({});

    setErr('');
    setStatus('Ready');
    setValidationStatus('');

    initialize('', {});
  };

  return {
    err,
    setErr,
    status,
    setStatus,
    seriesLimit,
    setSeriesLimit,
    validationStatus,
    metrics,
    labelKeys,
    labelValues,
    isLoadingLabelKeys,
    isLoadingLabelValues,
    selectedMetric,
    selectedLabelKeys,
    selectedLabelValues,
    handleSelectedMetricChange,
    handleSelectedLabelKeyChange,
    handleSelectedLabelValueChange,
    handleValidation,
    handleClear,
    // Helper functions - not part of the public API
    buildSafeSelector,
    loadSelectedLabelsFromStorage,
    fetchMetrics,
    fetchLabelKeys,
    fetchLabelValues,
  };
};
