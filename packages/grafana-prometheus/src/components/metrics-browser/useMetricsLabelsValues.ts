import { useCallback, useEffect, useRef, useState } from 'react';

import { TimeRange } from '@grafana/data';

import PromQlLanguageProvider from '../../language_provider';

import { buildSelector } from './selectorBuilder';
import { DEFAULT_SERIES_LIMIT, EMPTY_SELECTOR, LAST_USED_LABELS_KEY, Metric, METRIC_LABEL } from './types';

export const useMetricsLabelsValues = (
  timeRange: TimeRange,
  languageProvider: PromQlLanguageProvider,
) => {
  const timeRangeRef = useRef<TimeRange>(timeRange);
  const [initTrigger, setInitTrigger] = useState(Date.now());

  const [seriesLimit, setSeriesLimit] = useState(DEFAULT_SERIES_LIMIT);
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

  // We don't want to trigger fetching for small amount of time changes.
  // When MetricsBrowser re-renders for any reason we might receive a new timerange.
  // This particularly happens when we have relative time ranges: from: now, to: now-1h
  // To prevent re-fetching everything just because of this small timestamp change we have the following caution.
  useEffect(() => {
    if (
      !timeRangeRef.current ||
      (timeRange.to.diff(timeRangeRef.current.to, 'seconds') >= 5 &&
        timeRange.from.diff(timeRangeRef.current.from, 'seconds') >= 5)
    ) {
      timeRangeRef.current = timeRange;
      setInitTrigger(Date.now());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

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
      const meta = languageProvider.metricsMetadata;
      return meta && meta[metricName] ? `(${meta[metricName].type}) ${meta[metricName].help}` : undefined;
    },
    [languageProvider.metricsMetadata]
  );

  // Helper function to build a selector and convert empty selectors to undefined
  const buildSafeSelector = useCallback((metric: string, labelValues: Record<string, string[]>) => {
    const selector = buildSelector(metric, labelValues);
    return selector === EMPTY_SELECTOR ? undefined : selector;
  }, []);

  // Helper function to load and filter label keys from localStorage
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

  // Initial set up of the Metrics Browser
  useEffect(() => {
    async function initialize() {
      const selector = buildSelector(selectedMetric, selectedLabelValues);
      const safeSelector = selector === EMPTY_SELECTOR ? undefined : selector;

      // Metrics
      let transformedMetrics: Metric[] = [];
      try {
        const fetchedMetrics = await languageProvider.fetchSeriesValuesWithMatch(
          timeRangeRef.current,
          METRIC_LABEL,
          safeSelector,
          'MetricsBrowser_M',
          seriesLimit
        );
        transformedMetrics = fetchedMetrics.map((m) => ({
          name: m,
          details: getMetricDetails(m),
        }));
      } catch (e) {
        handleError(e, 'Error fetching metrics');
      }

      // Labels
      let transformedLabelKeys: string[] = [];
      try {
        if (safeSelector) {
          transformedLabelKeys = Object.keys(
            await languageProvider.fetchSeriesLabelsMatch(timeRangeRef.current, selector, seriesLimit)
          );
        } else {
          transformedLabelKeys =
            (await languageProvider.fetchLabels(timeRangeRef.current, undefined, seriesLimit)) || [];
        }
      } catch (e) {
        handleError(e, 'Error fetching labels');
      }

      // Selected Labels
      const labelKeysInLocalStorage: string[] = loadSelectedLabelsFromStorage(transformedLabelKeys);

      // Selected Labels' Values
      const transformedLabelValues: Record<string, string[]> = {};
      for (const lk of labelKeysInLocalStorage) {
        try {
          const values = await languageProvider.fetchSeriesValuesWithMatch(
            timeRangeRef.current,
            lk,
            undefined,
            `MetricsBrowser_LV_${lk}`,
            seriesLimit
          );
          transformedLabelValues[lk] = values;
        } catch (e) {
          handleError(e, 'Error fetching label values');
        }
      }

      setMetrics(transformedMetrics);
      setLabelKeys(transformedLabelKeys);
      setSelectedLabelKeys(labelKeysInLocalStorage);
      setLabelValues(transformedLabelValues);
    }

    initialize();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initTrigger, getMetricDetails, languageProvider, seriesLimit, selectedMetric]);

  const handleSelectedMetricChange = async (metricName: string) => {
    const newSelectedMetric = selectedMetric !== metricName ? metricName : '';
    setSelectedMetric(newSelectedMetric);

    if (newSelectedMetric === '') {
      return;
    }

    const selector = buildSelector(newSelectedMetric, selectedLabelValues);
    try {
      const fetchedLabelKeys = Object.keys(
        await languageProvider.fetchSeriesLabelsMatch(timeRangeRef.current, selector, seriesLimit)
      );
      const newSelectedLabelKeys = selectedLabelKeys.filter((slk) => fetchedLabelKeys.includes(slk));

      const transformedLabelValues: Record<string, string[]> = {};
      const newSelectedLabelValues: Record<string, string[]> = {};
      for (const lk of newSelectedLabelKeys) {
        try {
          const values = await languageProvider.fetchSeriesValuesWithMatch(
            timeRangeRef.current,
            lk,
            undefined,
            `MetricsBrowser_LV_${lk}`,
            seriesLimit
          );
          transformedLabelValues[lk] = values;
          newSelectedLabelValues[lk] = [...selectedLabelValues[lk]];
        } catch (e: unknown) {
          handleError(e, 'Error fetching label values');
        }
      }

      setLabelKeys(fetchedLabelKeys);
      setSelectedLabelKeys(newSelectedLabelKeys);
      setLabelValues(transformedLabelValues);
      setSelectedLabelValues(newSelectedLabelValues);
    } catch (e: unknown) {
      handleError(e, 'Error fetching labels');
    }
  };

  const handleSelectedLabelKeyChange = async (labelKey: string) => {
    const newSelectedLabelKeys = [...selectedLabelKeys];
    const lkIdx = newSelectedLabelKeys.indexOf(labelKey);

    const newLabelValues: Record<string, string[]> = { ...labelValues };
    const newSelectedLabelValues: Record<string, string[]> = { ...selectedLabelValues };

    if (lkIdx === -1) {
      newSelectedLabelKeys.push(labelKey);
      const safeSelector = buildSafeSelector(selectedMetric, selectedLabelValues);
      try {
        const values = await languageProvider.fetchSeriesValuesWithMatch(
          timeRangeRef.current,
          labelKey,
          safeSelector,
          `MetricsBrowser_LV_${labelKey}`,
          seriesLimit
        );
        newLabelValues[labelKey] = values;
      } catch (e: unknown) {
        handleError(e, 'Error fetching label values');
      }
    } else {
      newSelectedLabelKeys.splice(lkIdx, 1);
      delete newLabelValues[labelKey];
      delete newSelectedLabelValues[labelKey];
    }
    localStorage.setItem(LAST_USED_LABELS_KEY, JSON.stringify(newSelectedLabelKeys));

    setSelectedLabelKeys(newSelectedLabelKeys);
    setLabelValues(newLabelValues);
    setSelectedLabelValues(newSelectedLabelValues);
  };

  // Handle the labelValue click based on isSelected value.
  // If it is false we need to remove it from selected values
  // If it is true then we need to add it to selected values
  // The change should effect metrics list and label keys
  // TODO if user clicks to fast to the values how this will affect the flow?
  const handleSelectedLabelValueChange = async (labelKey: string, labelValue: string, isSelected: boolean) => {
    const newSelectedLabelValues = { ...selectedLabelValues };
    let newLastSelectedLabelKey = lastSelectedLabelKey;
    if (labelKey !== lastSelectedLabelKey) {
      newLastSelectedLabelKey = labelKey;
    }

    // Label selected
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

    const safeSelector = buildSafeSelector(selectedMetric, newSelectedLabelValues);

    // Fetch metrics
    setStatus('Fetching metrics...');
    let newMetrics: Metric[] = [];
    try {
      const fetchedMetrics = await languageProvider.fetchSeriesValuesWithMatch(
        timeRangeRef.current,
        METRIC_LABEL,
        safeSelector,
        'MetricsBrowser_M',
        seriesLimit
      );
      newMetrics = fetchedMetrics.map((m) => ({ name: m, details: getMetricDetails(m) }));
    } catch (e: unknown) {
      handleError(e, 'Error fetching label values');
    }

    // Fetch label keys
    setStatus('Fetching labels...');
    let newLabelKeys: string[] = [];
    const labelKeysSelector = `{${METRIC_LABEL}=~"${newMetrics.map((m) => m.name).join('|')}"}`;
    try {
      const fetchedLabelKeysRecord = await languageProvider.fetchSeriesLabelsMatch(
        timeRange,
        labelKeysSelector,
        seriesLimit
      );
      newLabelKeys = Object.keys(fetchedLabelKeysRecord);
    } catch (e: unknown) {
      handleError(e, 'Error fetching labels');
    }

    const newSelectedLabelKeys: string[] = loadSelectedLabelsFromStorage(newLabelKeys);

    // adjust the label values
    let newLabelValues: Record<string, string[]> = {};
    if (newSelectedLabelKeys.length !== 0) {
      const safeSelector = buildSafeSelector(selectedMetric, newSelectedLabelValues);
      for (const lk of newSelectedLabelKeys) {
        try {
          const fetchedLabelValues = await languageProvider.fetchSeriesValuesWithMatch(
            timeRange,
            lk,
            safeSelector,
            `MetricsBrowser_LV_${lk}`,
            seriesLimit
          );

          // We don't want to discard values from last selected list.
          // User might want to select more.
          if (newLastSelectedLabelKey === lk) {
            newLabelValues[lk] = Array.from(new Set([...labelValues[lk], ...fetchedLabelValues]));
          } else {
            // If there are already selected values merge them with the fetched values.
            newLabelValues[lk] = Array.from(new Set([...(selectedLabelValues[lk] ?? []), ...fetchedLabelValues]));
          }
        } catch (e: unknown) {
          handleError(e, 'Error fetching label values');
        }
      }
    }

    setMetrics(newMetrics);
    setLabelKeys(newLabelKeys);
    setSelectedLabelKeys(newSelectedLabelKeys);
    setLastSelectedLabelKey(newLastSelectedLabelKey);
    setLabelValues(newLabelValues);
    setSelectedLabelValues(newSelectedLabelValues);
  };

  const handleValidation = async () => {
    const selector = buildSelector(selectedMetric, selectedLabelValues);
    setValidationStatus(`Validating selector ${selector}`);
    setErr('');

    try {
      const results = await languageProvider.fetchLabelsWithMatch(timeRangeRef.current, selector);
      setValidationStatus(`Selector is valid (${Object.keys(results).length} labels found)`);
    } catch (e) {
      handleError(e, 'Validation failed');
      setValidationStatus('');
    }
  };

  const handleClear = () => {
    localStorage.setItem(LAST_USED_LABELS_KEY, '[]');

    setSelectedMetric('');
    setSelectedLabelKeys([]);
    setSelectedLabelValues({});

    setErr('');
    setStatus('Ready');
    setValidationStatus('');

    setInitTrigger(Date.now());
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
    selectedMetric,
    selectedLabelKeys,
    selectedLabelValues,
    handleSelectedMetricChange,
    handleSelectedLabelKeyChange,
    handleSelectedLabelValueChange,
    handleValidation,
    handleClear,
  };
};
