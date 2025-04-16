import { createContext, PropsWithChildren, useCallback, useContext, useMemo } from 'react';

import { TimeRange } from '@grafana/data';

import PromQlLanguageProvider from '../../language_provider';

import { buildSelector } from './selectorBuilder';
import { Metric } from './types';
import { useMetricsLabelsValues } from './useMetricsLabelsValues';

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
  onLabelValueClick: (labelKey: string, labelValue: string, isSelected: boolean) => void;
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
  const {
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
  } = useMetricsLabelsValues(timeRange, languageProvider);

  // Build a Prometheus selector string from the current selections
  const getSelector = useCallback(
    () => buildSelector(selectedMetric, selectedLabelValues),
    [selectedLabelValues, selectedMetric]
  );

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      err,
      setErr,
      status,
      setStatus,
      seriesLimit,
      setSeriesLimit,
      validationStatus,
      onChange,
      getSelector,
      metrics,
      labelKeys,
      labelValues,
      selectedMetric,
      selectedLabelKeys,
      selectedLabelValues,
      onMetricClick: handleSelectedMetricChange,
      onLabelKeyClick: handleSelectedLabelKeyChange,
      onLabelValueClick: handleSelectedLabelValueChange,
      onValidationClick: handleValidation,
      onClearClick: handleClear,
    }),
    [
      err,
      setErr,
      status,
      setStatus,
      seriesLimit,
      setSeriesLimit,
      validationStatus,
      onChange,
      metrics,
      getSelector,
      labelKeys,
      labelValues,
      selectedMetric,
      selectedLabelKeys,
      selectedLabelValues,
      handleSelectedLabelKeyChange,
      handleSelectedLabelValueChange,
      handleSelectedMetricChange,
      handleValidation,
      handleClear,
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
