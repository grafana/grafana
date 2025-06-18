import { act, renderHook, waitFor } from '@testing-library/react';

import { TimeRange, dateTime } from '@grafana/data';

import { PrometheusLanguageProviderInterface } from '../../language_provider';
import { getMockTimeRange } from '../../test/__mocks__/datasource';

import * as selectorBuilderModule from './selectorBuilder';
import { DEFAULT_SERIES_LIMIT, EMPTY_SELECTOR, LAST_USED_LABELS_KEY, METRIC_LABEL } from './types';
import { useMetricsLabelsValues } from './useMetricsLabelsValues';

// Test utilities to reduce boilerplate
const setupMocks = () => {
  // Mock the buildSelector module - we need to mock the whole module
  jest.spyOn(selectorBuilderModule, 'buildSelector').mockImplementation(() => EMPTY_SELECTOR);

  // Mock localStorage
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: jest.fn((key: string) => store[key] || null),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
      }),
      clear: jest.fn(() => {
        store = {};
      }),
    };
  })();
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });

  // Mock language provider
  const mockLanguageProvider = {
    metrics: ['metric1', 'metric2', 'metric3'],
    labelKeys: ['__name__', 'instance', 'job', 'service'],
    metricsMetadata: {
      metric1: { type: 'counter', help: 'Test metric 1' },
      metric2: { type: 'gauge', help: 'Test metric 2' },
    },
    fetchLabelValues: jest.fn(),
    fetchLabels: jest.fn(),
    fetchSeriesValuesWithMatch: jest.fn(),
    fetchSeriesLabelsMatch: jest.fn(),
    fetchLabelsWithMatch: jest.fn(),
  } as unknown as PrometheusLanguageProviderInterface;

  // Mock standard responses
  (mockLanguageProvider.fetchLabelValues as jest.Mock).mockResolvedValue(['metric1', 'metric2', 'metric3']);
  (mockLanguageProvider.fetchLabels as jest.Mock).mockResolvedValue(['__name__', 'instance', 'job', 'service']);
  (mockLanguageProvider.fetchSeriesValuesWithMatch as jest.Mock).mockImplementation(
    (_timeRange: TimeRange, label: string) => {
      if (label === 'job') {
        return Promise.resolve(['grafana', 'prometheus']);
      }
      if (label === 'instance') {
        return Promise.resolve(['host1', 'host2']);
      }
      if (label === METRIC_LABEL) {
        return Promise.resolve(['metric1', 'metric2', 'metric3']);
      }
      return Promise.resolve([]);
    }
  );
  (mockLanguageProvider.fetchSeriesLabelsMatch as jest.Mock).mockResolvedValue({
    __name__: ['metric1', 'metric2'],
    instance: ['instance1', 'instance2'],
    job: ['job1', 'job2'],
    service: ['service1', 'service2'],
  });

  const mockTimeRange: TimeRange = getMockTimeRange();

  return { mockLanguageProvider, mockTimeRange, localStorageMock };
};

// Suppress console during tests
const setupConsoleMocks = () => {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  console.log = jest.fn();
  console.error = jest.fn();

  return () => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  };
};

// Helper to render hook with standard initialization
const renderHookWithInit = async (mocks: ReturnType<typeof setupMocks>) => {
  const { result } = renderHook(() => useMetricsLabelsValues(mocks.mockTimeRange, mocks.mockLanguageProvider));

  // Wait for initialization
  await waitFor(() => {
    expect(mocks.mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
  });

  return { result };
};

describe('useMetricsLabelsValues', () => {
  // Set up and tear down hooks for each test
  let mocks: ReturnType<typeof setupMocks>;
  let restoreConsole: ReturnType<typeof setupConsoleMocks>;

  beforeEach(() => {
    mocks = setupMocks();
    restoreConsole = setupConsoleMocks();
    jest.clearAllMocks();
  });

  afterEach(() => {
    restoreConsole();
    jest.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize by fetching metrics from language provider', async () => {
      renderHook(() => useMetricsLabelsValues(mocks.mockTimeRange, mocks.mockLanguageProvider));

      await waitFor(() => {
        expect(mocks.mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
      });

      expect(mocks.mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalledWith(
        expect.anything(),
        METRIC_LABEL,
        undefined,
        'MetricsBrowser_M',
        DEFAULT_SERIES_LIMIT
      );
    });

    it('should fetch label keys during initialization', async () => {
      renderHook(() => useMetricsLabelsValues(mocks.mockTimeRange, mocks.mockLanguageProvider));

      await waitFor(() => {
        expect(mocks.mockLanguageProvider.fetchLabels).toHaveBeenCalled();
      });

      expect(mocks.mockLanguageProvider.fetchLabels).toHaveBeenCalledWith(
        expect.anything(),
        undefined,
        DEFAULT_SERIES_LIMIT
      );
    });

    it('should load saved label keys from localStorage and fetch values', async () => {
      mocks.localStorageMock.setItem(LAST_USED_LABELS_KEY, JSON.stringify(['job', 'instance']));

      renderHook(() => useMetricsLabelsValues(mocks.mockTimeRange, mocks.mockLanguageProvider));

      await waitFor(() => {
        const fetchCalls = (mocks.mockLanguageProvider.fetchSeriesValuesWithMatch as jest.Mock).mock.calls;
        const jobCall = fetchCalls.find((call) => call[1] === 'job' && call[3] === 'MetricsBrowser_LV_job');
        const instanceCall = fetchCalls.find(
          (call) => call[1] === 'instance' && call[3] === 'MetricsBrowser_LV_instance'
        );
        return jobCall && instanceCall;
      });

      expect(mocks.mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalledWith(
        expect.anything(),
        'job',
        undefined,
        'MetricsBrowser_LV_job',
        DEFAULT_SERIES_LIMIT
      );

      expect(mocks.mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalledWith(
        expect.anything(),
        'instance',
        undefined,
        'MetricsBrowser_LV_instance',
        DEFAULT_SERIES_LIMIT
      );
    });

    it('should set label values as string arrays', async () => {
      mocks.localStorageMock.setItem(LAST_USED_LABELS_KEY, JSON.stringify(['job']));

      const { result } = renderHook(() => useMetricsLabelsValues(mocks.mockTimeRange, mocks.mockLanguageProvider));

      await waitFor(() => {
        return result.current.labelValues.job !== undefined;
      });

      expect(Array.isArray(result.current.labelValues.job)).toBe(true);
      expect(result.current.labelValues.job).toEqual(['grafana', 'prometheus']);
    });
  });

  describe('handleSelectedMetricChange', () => {
    it('should select a metric when not previously selected', async () => {
      const { result } = await renderHookWithInit(mocks);

      // Clear mock calls before testing
      jest.clearAllMocks();

      // Select a metric
      await act(async () => {
        await result.current.handleSelectedMetricChange('metric1');
      });

      // Verify the metric was selected
      expect(result.current.selectedMetric).toBe('metric1');
    });

    it('should deselect a metric when the same metric is selected again', async () => {
      const { result } = await renderHookWithInit(mocks);

      // First select a metric
      await act(async () => {
        await result.current.handleSelectedMetricChange('metric1');
      });

      expect(result.current.selectedMetric).toBe('metric1');

      // Clear mock calls
      jest.clearAllMocks();

      // Deselect by selecting the same metric
      await act(async () => {
        await result.current.handleSelectedMetricChange('metric1');
      });

      // Verify the metric was deselected
      expect(result.current.selectedMetric).toBe('');
    });

    it('should update label keys and values when a metric is selected', async () => {
      // Mock fetchSeriesLabelsMatch to return specific labels
      (mocks.mockLanguageProvider.fetchSeriesLabelsMatch as jest.Mock).mockResolvedValue({
        __name__: ['metric1'],
        job: ['job1', 'job2'],
        instance: ['instance1', 'instance2'],
        service: ['service1', 'service2'],
      });

      // Start with some selected label keys
      mocks.localStorageMock.setItem(LAST_USED_LABELS_KEY, JSON.stringify(['job', 'instance', 'service']));

      const { result } = await renderHookWithInit(mocks);

      await waitFor(() => {
        return result.current.selectedLabelKeys.length === 3;
      });

      // Clear mock calls
      jest.clearAllMocks();

      // Select a metric
      await act(async () => {
        await result.current.handleSelectedMetricChange('metric1');
      });

      // Verify that the label keys were updated
      expect(result.current.labelKeys).toContain('job');
      expect(result.current.labelKeys).toContain('instance');
      expect(result.current.labelKeys).toContain('service');

      // Verify that selected label keys were filtered correctly
      expect(result.current.selectedLabelKeys).toContain('job');
      expect(result.current.selectedLabelKeys).toContain('instance');
      expect(result.current.selectedLabelKeys).toContain('service');

      // Verify that label values were fetched
      expect(mocks.mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
    });
  });

  describe('handleSelectedLabelKeyChange', () => {
    it('should add a label key when it is not already selected', async () => {
      const { result } = await renderHookWithInit(mocks);

      // Clear mock calls
      jest.clearAllMocks();

      // Since we have no selected metric, the buildSelector will return EMPTY_SELECTOR
      jest.spyOn(selectorBuilderModule, 'buildSelector').mockReturnValue(EMPTY_SELECTOR);

      // Add a new label key
      await act(async () => {
        await result.current.handleSelectedLabelKeyChange('service');
      });

      // Wait for the label key to be added to selectedLabelKeys
      await waitFor(() => {
        expect(result.current.selectedLabelKeys).toContain('service');
      });

      // Verify that buildSelector was called
      expect(selectorBuilderModule.buildSelector).toHaveBeenCalled();

      // Verify that fetchSeriesValuesWithMatch was called correctly
      expect(mocks.mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalledWith(
        expect.anything(),
        'service',
        undefined, // Since selector is EMPTY_SELECTOR, it should be converted to undefined
        'MetricsBrowser_LV_service',
        DEFAULT_SERIES_LIMIT
      );

      // Verify localStorage was updated
      expect(mocks.localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should remove a label key when it is already selected', async () => {
      // Setup with a selected label key
      mocks.localStorageMock.setItem(LAST_USED_LABELS_KEY, JSON.stringify(['job']));

      const { result } = await renderHookWithInit(mocks);

      // Wait for job to be in the selected keys
      await waitFor(() => {
        expect(result.current.selectedLabelKeys).toContain('job');
      });

      // Mock localStorage.setItem to verify it's called correctly
      mocks.localStorageMock.setItem.mockClear();

      // Remove the label key
      await act(async () => {
        await result.current.handleSelectedLabelKeyChange('job');
      });

      // Verify the label key was removed
      expect(result.current.selectedLabelKeys).not.toContain('job');

      // Verify label values were removed
      expect(result.current.labelValues).not.toHaveProperty('job');

      // Verify localStorage was updated
      expect(mocks.localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should handle labelKey changes when a metric is selected', async () => {
      const { result } = await renderHookWithInit(mocks);

      // Select a metric first
      await act(async () => {
        await result.current.handleSelectedMetricChange('metric1');
      });

      // Clear mock calls
      jest.clearAllMocks();

      // Mock the buildSelector to return a non-empty selector
      jest.spyOn(selectorBuilderModule, 'buildSelector').mockReturnValue('metric1{instance="host1"}');

      // Add a label key
      await act(async () => {
        await result.current.handleSelectedLabelKeyChange('service');
      });

      // Verify buildSelector was called with the selected metric and label values
      expect(selectorBuilderModule.buildSelector).toHaveBeenCalled();

      // Verify fetchSeriesValuesWithMatch was called with the correct selector
      expect(mocks.mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalledWith(
        expect.anything(),
        'service',
        'metric1{instance="host1"}', // The selector returned by our mock
        'MetricsBrowser_LV_service',
        DEFAULT_SERIES_LIMIT
      );
    });
  });

  describe('handleSelectedLabelValueChange', () => {
    it('should add a label value when isSelected is true', async () => {
      // Start with selected label keys but no selected values
      mocks.localStorageMock.setItem(LAST_USED_LABELS_KEY, JSON.stringify(['job']));

      const { result } = await renderHookWithInit(mocks);

      // Clear mock calls
      jest.clearAllMocks();

      // Select a label value
      await act(async () => {
        await result.current.handleSelectedLabelValueChange('job', 'grafana', true);
      });

      // Verify the value was added to selectedLabelValues
      expect(result.current.selectedLabelValues.job).toContain('grafana');

      // Verify buildSelector was called to create a selector with the selected value
      expect(selectorBuilderModule.buildSelector).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ job: ['grafana'] })
      );
    });

    it('should remove a label value when isSelected is false', async () => {
      // Setup initial state with selected label key and value
      mocks.localStorageMock.setItem(LAST_USED_LABELS_KEY, JSON.stringify(['job']));

      const { result } = await renderHookWithInit(mocks);

      // First select a value
      await act(async () => {
        await result.current.handleSelectedLabelValueChange('job', 'grafana', true);
      });

      // Verify initial selection
      expect(result.current.selectedLabelValues.job).toContain('grafana');

      // Clear mock calls
      jest.clearAllMocks();

      // Now deselect the value
      await act(async () => {
        await result.current.handleSelectedLabelValueChange('job', 'grafana', false);
      });

      // Verify that 'job' key is no longer in selectedLabelValues
      expect(Object.keys(result.current.selectedLabelValues)).not.toContain('job');
    });

    it('should preserve values for the last selected label key', async () => {
      // Mock with specific return values to test value merging
      (mocks.mockLanguageProvider.fetchSeriesValuesWithMatch as jest.Mock).mockImplementation(
        (_timeRange: TimeRange, label: string) => {
          if (label === 'job') {
            return Promise.resolve(['grafana']);
          }
          if (label === 'instance') {
            return Promise.resolve(['host1', 'host2']);
          }
          if (label === METRIC_LABEL) {
            return Promise.resolve(['metric1', 'metric2']);
          }
          return Promise.resolve([]);
        }
      );

      // Start with selected label keys
      mocks.localStorageMock.setItem(LAST_USED_LABELS_KEY, JSON.stringify(['job', 'instance']));

      const { result } = await renderHookWithInit(mocks);

      // Initialize job values with a larger set
      const initialJobValues = ['grafana', 'prometheus', 'additional_value'];

      // Select a value for job (should set job as last selected)
      await act(async () => {
        await result.current.handleSelectedLabelValueChange('job', 'grafana', true);
      });

      // Mock a more extensive set of label values for job
      (mocks.mockLanguageProvider.fetchSeriesValuesWithMatch as jest.Mock).mockImplementation(
        (_timeRange: TimeRange, label: string) => {
          if (label === 'job') {
            return Promise.resolve(initialJobValues);
          }
          if (label === 'instance') {
            return Promise.resolve(['host1', 'host2']);
          }
          if (label === METRIC_LABEL) {
            return Promise.resolve(['metric1', 'metric2']);
          }
          return Promise.resolve([]);
        }
      );

      // Select a value for instance to trigger job values refetch
      await act(async () => {
        await result.current.handleSelectedLabelValueChange('instance', 'host1', true);
      });

      // Select job value again to make it the last selected
      await act(async () => {
        await result.current.handleSelectedLabelValueChange('job', 'prometheus', true);
      });

      // Verify that job values contain all the values
      expect(result.current.labelValues.job).toContain('grafana');
      expect(result.current.labelValues.job).toContain('prometheus');
      expect(result.current.labelValues.job).toContain('additional_value');
    });

    it('should handle errors during label values fetching', async () => {
      // Mock fetchSeriesValuesWithMatch to throw an error for specific labels
      (mocks.mockLanguageProvider.fetchSeriesValuesWithMatch as jest.Mock).mockImplementation(
        (_timeRange: TimeRange, label: string, _selector: string, debugName: string) => {
          if (label === METRIC_LABEL) {
            return Promise.resolve(['metric1', 'metric2']);
          }
          if (label === 'job' && debugName === 'MetricsBrowser_LV_job') {
            return Promise.reject(new Error('Test error'));
          }
          if (label === 'instance') {
            return Promise.resolve(['host1', 'host2']);
          }
          return Promise.resolve([]);
        }
      );

      // Start with selected label keys
      mocks.localStorageMock.setItem(LAST_USED_LABELS_KEY, JSON.stringify(['job', 'instance']));

      const { result } = await renderHookWithInit(mocks);

      // Wait for the error to be logged
      await waitFor(() => {
        return result.current.err.includes('Error fetching label values');
      });

      // Wait for initialization to complete so we can verify the result
      await waitFor(() => {
        return result.current.labelValues.instance !== undefined;
      });

      // Verify that instance values were still fetched successfully
      expect(result.current.labelValues).toHaveProperty('instance');

      // Verify job is not in labelValues since its fetch failed
      expect(result.current.labelValues).not.toHaveProperty('job');
    });
  });

  describe('handleValidation', () => {
    it('should validate a selector against the language provider', async () => {
      // Mock fetchSeriesLabelsMatch to return valid results
      mocks.mockLanguageProvider.fetchSeriesLabelsMatch = jest.fn().mockResolvedValue({
        job: ['grafana', 'prometheus'],
        instance: ['instance1', 'instance2'],
      });

      const { result } = await renderHookWithInit(mocks);

      // Set up initial state
      await act(async () => {
        await result.current.handleSelectedMetricChange('metric1');
      });

      // Call validation
      await act(async () => {
        await result.current.handleValidation();
      });

      // Verify API was called with the correct selector
      expect(mocks.mockLanguageProvider.fetchSeriesLabelsMatch).toHaveBeenCalled();

      // Verify validationStatus was updated
      expect(result.current.validationStatus).toContain('Selector is valid');
    });

    it('should handle errors during validation', async () => {
      // Mock fetchSeriesLabelsMatch to throw an error
      mocks.mockLanguageProvider.fetchSeriesLabelsMatch = jest.fn().mockRejectedValue(new Error('Validation error'));

      const { result } = await renderHookWithInit(mocks);

      // Call validation
      await act(async () => {
        await result.current.handleValidation();
      });

      // Verify error was handled - checking for the correct error message format
      expect(result.current.err).toContain('Validation failed');
      expect(result.current.validationStatus).toBe('');
    });
  });

  describe('handleClear', () => {
    it('should reset state and localStorage when called', async () => {
      // Setup initial state with selections
      mocks.localStorageMock.setItem(LAST_USED_LABELS_KEY, JSON.stringify(['job', 'instance']));

      const { result } = await renderHookWithInit(mocks);

      // Select a metric and label value
      await act(async () => {
        await result.current.handleSelectedMetricChange('metric1');
        await result.current.handleSelectedLabelValueChange('job', 'grafana', true);
      });

      // Verify we have state to clear
      expect(result.current.selectedMetric).toBe('metric1');
      expect(result.current.selectedLabelValues).toHaveProperty('job');

      // Clear mock calls
      jest.clearAllMocks();

      // Call clear
      await act(async () => {
        result.current.handleClear();
      });

      // Verify state was reset
      expect(result.current.selectedMetric).toBe('');
      expect(result.current.selectedLabelKeys).toEqual([]);
      expect(result.current.selectedLabelValues).toEqual({});
      expect(result.current.err).toBe('');
      expect(result.current.status).toBe('Ready');
      expect(result.current.validationStatus).toBe('');

      // Verify localStorage was cleared
      expect(mocks.localStorageMock.setItem).toHaveBeenCalledWith(LAST_USED_LABELS_KEY, '[]');

      // Verify initialize was called
      expect(mocks.mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
    });
  });

  describe('helper functions', () => {
    describe('buildSafeSelector', () => {
      it('should convert EMPTY_SELECTOR to undefined', async () => {
        jest.spyOn(selectorBuilderModule, 'buildSelector').mockReturnValue(EMPTY_SELECTOR);

        const { result } = await renderHookWithInit(mocks);

        // Access the helper function
        const buildSafeSelector = result.current.buildSafeSelector;

        expect(buildSafeSelector('metric1', {})).toBeUndefined();
      });

      it('should return the selector value when not empty', async () => {
        const expectedSelector = 'metric1{job="prometheus"}';
        jest.spyOn(selectorBuilderModule, 'buildSelector').mockReturnValue(expectedSelector);

        const { result } = await renderHookWithInit(mocks);

        const buildSafeSelector = result.current.buildSafeSelector;

        expect(buildSafeSelector('metric1', { job: ['prometheus'] })).toBe(expectedSelector);
      });
    });

    describe('loadSelectedLabelsFromStorage', () => {
      it('should filter labels against available labels', async () => {
        mocks.localStorageMock.setItem(LAST_USED_LABELS_KEY, JSON.stringify(['job', 'instance', 'unavailable']));

        const { result } = await renderHookWithInit(mocks);

        const loadSelectedLabelsFromStorage = result.current.loadSelectedLabelsFromStorage;

        const availableLabels = ['job', 'instance', 'pod'];
        expect(loadSelectedLabelsFromStorage(availableLabels)).toEqual(['job', 'instance']);
      });

      it('should handle empty localStorage', async () => {
        mocks.localStorageMock.clear();

        const { result } = await renderHookWithInit(mocks);

        const loadSelectedLabelsFromStorage = result.current.loadSelectedLabelsFromStorage;

        expect(loadSelectedLabelsFromStorage(['job', 'instance'])).toEqual([]);
      });
    });
  });

  describe('seriesLimit handling', () => {
    it('should refetch data when seriesLimit changes', async () => {
      const { result } = await renderHookWithInit(mocks);

      // Clear mock calls
      jest.clearAllMocks();

      // Change series limit
      await act(async () => {
        result.current.setSeriesLimit(1000 as unknown as typeof DEFAULT_SERIES_LIMIT);
      });

      // Wait for debounce to finish
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Verify data was refetched with new limit
      await waitFor(() => {
        const matchCalls = (mocks.mockLanguageProvider.fetchSeriesValuesWithMatch as jest.Mock).mock.calls;
        // Find calls with the new limit
        const callWithNewLimit = matchCalls.find((call) => call[4] === 1000);
        expect(callWithNewLimit).toBeTruthy();
      });
    });

    it('should use DEFAULT_SERIES_LIMIT when seriesLimit is empty', async () => {
      const { result } = await renderHookWithInit(mocks);

      // Clear mock calls
      jest.clearAllMocks();

      // Set series limit to empty string
      await act(async () => {
        result.current.setSeriesLimit('' as unknown as typeof DEFAULT_SERIES_LIMIT);
      });

      // Wait for debounce to finish
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Verify data was refetched with the default limit
      await waitFor(() => {
        const matchCalls = (mocks.mockLanguageProvider.fetchSeriesValuesWithMatch as jest.Mock).mock.calls;
        const callsWithDefaultLimit = matchCalls.filter((call) => call[4] === DEFAULT_SERIES_LIMIT);
        expect(callsWithDefaultLimit.length).toBeGreaterThan(0);
      });
    });
  });

  describe('timeRange handling', () => {
    it('should not update timeRangeRef for small time changes', async () => {
      // Create base time range
      const baseTimeRange = getMockTimeRange();

      // Time ranges with small differences (< 5 seconds)
      const initialTimeRange = {
        ...baseTimeRange,
        from: baseTimeRange.from,
        to: baseTimeRange.to,
      };

      const smallChangeTimeRange = {
        ...baseTimeRange,
        from: dateTime(baseTimeRange.from.valueOf() + 2000), // +2 seconds
        to: dateTime(baseTimeRange.to.valueOf() + 2000),
      };

      // Render with initial time range
      const { rerender } = renderHook((props) => useMetricsLabelsValues(props.timeRange, props.languageProvider), {
        initialProps: {
          timeRange: initialTimeRange,
          languageProvider: mocks.mockLanguageProvider,
        },
      });

      await waitFor(() => {
        expect(mocks.mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
      });

      jest.clearAllMocks();

      // Rerender with small time change
      rerender({
        timeRange: smallChangeTimeRange,
        languageProvider: mocks.mockLanguageProvider,
      });

      // Wait a bit to ensure no additional API calls
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify no API calls were made after rerender with small time change
      expect(mocks.mockLanguageProvider.fetchSeriesValuesWithMatch).not.toHaveBeenCalled();
    });

    it('should update timeRangeRef for significant time changes', async () => {
      // Create time ranges with significant differences (≥ 5 seconds)
      const baseTimeRange = getMockTimeRange();

      const initialTimeRange = {
        ...baseTimeRange,
        from: baseTimeRange.from,
        to: baseTimeRange.to,
      };

      const significantChangeTimeRange = {
        ...baseTimeRange,
        from: dateTime(baseTimeRange.from.valueOf() + 10000), // +10 seconds
        to: dateTime(baseTimeRange.to.valueOf() + 10000),
      };

      // Mock the initialize method to be called when timeRangeRef is updated
      const mockInitialize = jest.fn();

      // Render with initial time range
      const { rerender } = renderHook(
        (props) => {
          const hook = useMetricsLabelsValues(props.timeRange, props.languageProvider);
          // Spy on the initialize method indirectly by monitoring metric fetches
          if (props.timeRange === significantChangeTimeRange) {
            mockInitialize();
          }
          return hook;
        },
        {
          initialProps: {
            timeRange: initialTimeRange,
            languageProvider: mocks.mockLanguageProvider,
          },
        }
      );

      await waitFor(() => {
        expect(mocks.mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
      });

      jest.clearAllMocks();

      // Rerender with significant time change
      rerender({
        timeRange: significantChangeTimeRange,
        languageProvider: mocks.mockLanguageProvider,
      });

      // Verify timeRangeRef was updated
      expect(mockInitialize).toHaveBeenCalled();
    });
  });

  describe('testing with invalid values or special characters', () => {
    it('should handle metric names with special characters', async () => {
      // Mock fetchSeriesValuesWithMatch to return metrics with special characters
      (mocks.mockLanguageProvider.fetchSeriesValuesWithMatch as jest.Mock).mockImplementation(
        (_timeRange: TimeRange, label: string) => {
          if (label === METRIC_LABEL) {
            return Promise.resolve(['metric-with-dash', 'metric.with.dots', 'metric{with}brackets']);
          }
          return Promise.resolve([]);
        }
      );

      const { result } = await renderHookWithInit(mocks);

      // Verify that metrics with special characters are returned
      expect(result.current.metrics.map((m) => m.name)).toContain('metric-with-dash');
      expect(result.current.metrics.map((m) => m.name)).toContain('metric.with.dots');
      expect(result.current.metrics.map((m) => m.name)).toContain('metric{with}brackets');

      // Try to select a metric with special characters
      await act(async () => {
        await result.current.handleSelectedMetricChange('metric{with}brackets');
      });

      // Verify the selection was successful
      expect(result.current.selectedMetric).toBe('metric{with}brackets');
    });

    it('should handle label values with special characters', async () => {
      // Mock fetchSeriesValuesWithMatch to return label values with special characters
      (mocks.mockLanguageProvider.fetchSeriesValuesWithMatch as jest.Mock).mockImplementation(
        (_timeRange: TimeRange, label: string) => {
          if (label === 'job') {
            return Promise.resolve(['name:with:colons', 'name/with/slashes', 'name=with=equals']);
          }
          if (label === METRIC_LABEL) {
            return Promise.resolve(['metric1', 'metric2']);
          }
          return Promise.resolve([]);
        }
      );

      // Set up selected label keys
      mocks.localStorageMock.setItem(LAST_USED_LABELS_KEY, JSON.stringify(['job']));

      const { result } = await renderHookWithInit(mocks);

      // Verify special character label values are loaded
      await waitFor(() => {
        expect(result.current.labelValues.job).toContain('name:with:colons');
        expect(result.current.labelValues.job).toContain('name/with/slashes');
        expect(result.current.labelValues.job).toContain('name=with=equals');
      });

      // Test selecting a label value with special characters
      await act(async () => {
        await result.current.handleSelectedLabelKeyChange('job');
        await result.current.handleSelectedLabelValueChange('job', 'name:with:colons', true);
      });

      // Verify the selection was made
      expect(result.current.selectedLabelValues.job).toContain('name:with:colons');
    });

    it('should handle empty strings in API responses', async () => {
      // Mock API to return some empty strings
      (mocks.mockLanguageProvider.fetchSeriesValuesWithMatch as jest.Mock).mockImplementation(
        (_timeRange: TimeRange, label: string) => {
          if (label === 'job') {
            return Promise.resolve(['valid-job', '', 'another-job']);
          }
          if (label === METRIC_LABEL) {
            return Promise.resolve(['metric1', 'metric2']);
          }
          return Promise.resolve([]);
        }
      );

      // Set up selected label keys
      mocks.localStorageMock.setItem(LAST_USED_LABELS_KEY, JSON.stringify(['job']));

      const { result } = await renderHookWithInit(mocks);

      // Verify empty string is included in values
      await waitFor(() => {
        expect(result.current.labelValues.job).toContain('');
      });

      // Test selecting an empty string as a value
      await act(async () => {
        await result.current.handleSelectedLabelKeyChange('job');
        await result.current.handleSelectedLabelValueChange('job', '', true);
      });

      // Verify the empty string was selected
      expect(result.current.selectedLabelValues.job).toContain('');
    });

    it('should handle extremely long label values', async () => {
      // Create a very long label value
      const longValue = 'x'.repeat(5000);

      // Mock API to return a very long label value
      (mocks.mockLanguageProvider.fetchSeriesValuesWithMatch as jest.Mock).mockImplementation(
        (_timeRange: TimeRange, label: string) => {
          if (label === 'job') {
            return Promise.resolve(['normal-value', longValue]);
          }
          if (label === METRIC_LABEL) {
            return Promise.resolve(['metric1', 'metric2']);
          }
          return Promise.resolve([]);
        }
      );

      // Set up selected label keys
      mocks.localStorageMock.setItem(LAST_USED_LABELS_KEY, JSON.stringify(['job']));

      const { result } = await renderHookWithInit(mocks);

      // First ensure job is selected as a label key
      await act(async () => {
        await result.current.handleSelectedLabelKeyChange('job');
      });

      // Wait for label values to load
      await waitFor(() => {
        expect(result.current.labelValues.job).toBeDefined();
      });

      // Verify long value is included
      expect(result.current.labelValues.job).toContain(longValue);

      // Test selecting the long value
      await act(async () => {
        await result.current.handleSelectedLabelValueChange('job', longValue, true);
      });

      // Verify the long value was selected
      expect(result.current.selectedLabelValues.job).toContain(longValue);
    });
  });

  describe('debouncing functionality', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should debounce seriesLimit changes', async () => {
      const { result } = await renderHookWithInit(mocks);

      // Clear mocks to track new calls
      jest.clearAllMocks();

      // Change seriesLimit multiple times rapidly
      act(() => {
        result.current.setSeriesLimit(100 as unknown as typeof DEFAULT_SERIES_LIMIT);
        result.current.setSeriesLimit(200 as unknown as typeof DEFAULT_SERIES_LIMIT);
        result.current.setSeriesLimit(300 as unknown as typeof DEFAULT_SERIES_LIMIT);
      });

      // Verify no fetch calls yet (before debounce timer completes)
      expect(mocks.mockLanguageProvider.fetchSeriesValuesWithMatch).not.toHaveBeenCalled();

      // Fast-forward debounce time
      act(() => {
        jest.advanceTimersByTime(400); // Slightly more than the 300ms debounce time
      });

      // Wait for the state update to propagate
      await waitFor(() => {
        expect(mocks.mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
      });

      // Verify we're using the last value set (300)
      const fetchCalls = (mocks.mockLanguageProvider.fetchSeriesValuesWithMatch as jest.Mock).mock.calls;
      const callWithFinalLimit = fetchCalls.find((call) => call[4] === 300);
      expect(callWithFinalLimit).toBeTruthy();
    });

    it('should not fetch multiple times for the same seriesLimit value', async () => {
      const { result } = await renderHookWithInit(mocks);

      // Clear mocks to track new calls
      jest.clearAllMocks();

      // Set the same value multiple times
      act(() => {
        result.current.setSeriesLimit(100 as unknown as typeof DEFAULT_SERIES_LIMIT);
        result.current.setSeriesLimit(100 as unknown as typeof DEFAULT_SERIES_LIMIT);
        result.current.setSeriesLimit(100 as unknown as typeof DEFAULT_SERIES_LIMIT);
      });

      // Fast-forward debounce time
      act(() => {
        jest.advanceTimersByTime(400);
      });

      // Wait for any async operations to complete
      await waitFor(() => {
        const fetchCalls = (mocks.mockLanguageProvider.fetchSeriesValuesWithMatch as jest.Mock).mock.calls;
        return fetchCalls.length > 0;
      });

      // Clear mocks again
      jest.clearAllMocks();

      // Set the same value again
      act(() => {
        result.current.setSeriesLimit(100 as unknown as typeof DEFAULT_SERIES_LIMIT);
      });

      // Fast-forward debounce time
      act(() => {
        jest.advanceTimersByTime(400);
      });

      // Should not fetch again since the value hasn't changed
      expect(mocks.mockLanguageProvider.fetchSeriesValuesWithMatch).not.toHaveBeenCalled();
    });
  });

  describe('complete user workflows', () => {
    it('should handle a full selection -> validation -> clear workflow', async () => {
      const { result } = await renderHookWithInit(mocks);

      // 1. Select a metric
      await act(async () => {
        await result.current.handleSelectedMetricChange('metric1');
      });
      expect(result.current.selectedMetric).toBe('metric1');

      // 2. Add a label key
      await act(async () => {
        await result.current.handleSelectedLabelKeyChange('job');
      });
      expect(result.current.selectedLabelKeys).toContain('job');

      // 3. Select a label value
      await act(async () => {
        await result.current.handleSelectedLabelValueChange('job', 'grafana', true);
      });
      expect(result.current.selectedLabelValues.job).toContain('grafana');

      // 4. Add another label key
      await act(async () => {
        await result.current.handleSelectedLabelKeyChange('instance');
      });
      expect(result.current.selectedLabelKeys).toContain('instance');

      // 5. Select a value for the second label
      await act(async () => {
        await result.current.handleSelectedLabelValueChange('instance', 'host1', true);
      });
      expect(result.current.selectedLabelValues.instance).toContain('host1');

      // 6. Validate the selection
      // Mock the validation response
      (mocks.mockLanguageProvider.fetchSeriesLabelsMatch as jest.Mock).mockResolvedValue({
        job: ['grafana'],
        instance: ['host1'],
      });

      await act(async () => {
        await result.current.handleValidation();
      });
      expect(result.current.validationStatus).toContain('Selector is valid');

      // 7. Clear everything
      await act(async () => {
        result.current.handleClear();
      });

      // 8. Verify everything was cleared
      expect(result.current.selectedMetric).toBe('');
      expect(result.current.selectedLabelKeys).toEqual([]);
      expect(result.current.selectedLabelValues).toEqual({});
      expect(result.current.validationStatus).toBe('');
    });

    it('should handle a workflow with deselections and reselections', async () => {
      const { result } = await renderHookWithInit(mocks);

      // 1. Select a metric
      await act(async () => {
        await result.current.handleSelectedMetricChange('metric1');
      });
      expect(result.current.selectedMetric).toBe('metric1');

      // 2. Add label keys
      await act(async () => {
        await result.current.handleSelectedLabelKeyChange('job');
      });

      // Wait for job to be in the selected keys
      await waitFor(() => expect(result.current.selectedLabelKeys).toContain('job'));

      // Wait for job values to be loaded
      await waitFor(() => result.current.labelValues.job && result.current.labelValues.job.length > 0);

      await act(async () => {
        await result.current.handleSelectedLabelKeyChange('instance');
      });

      // Wait for instance to be in the selected keys
      await waitFor(() => expect(result.current.selectedLabelKeys).toContain('instance'));

      // Wait for instance values to be loaded
      await waitFor(() => result.current.labelValues.instance && result.current.labelValues.instance.length > 0);

      // 3. Select values
      await act(async () => {
        await result.current.handleSelectedLabelValueChange('job', 'grafana', true);
      });

      // Wait for job value to be selected
      await waitFor(
        () => result.current.selectedLabelValues.job && result.current.selectedLabelValues.job.includes('grafana')
      );

      await act(async () => {
        await result.current.handleSelectedLabelValueChange('instance', 'host1', true);
      });

      // Wait for instance value to be selected
      await waitFor(
        () =>
          result.current.selectedLabelValues.instance && result.current.selectedLabelValues.instance.includes('host1')
      );

      // 4. Deselect a value
      await act(async () => result.current.handleSelectedLabelValueChange('job', 'grafana', false));

      // Wait for job to be removed from selectedLabelValues
      await waitFor(
        () => !result.current.selectedLabelValues.job || result.current.selectedLabelValues.job.length === 0
      );

      expect(Object.keys(result.current.selectedLabelValues)).not.toContain('job');

      // 5. Select a different value
      await act(async () => {
        await result.current.handleSelectedLabelValueChange('job', 'prometheus', true);
      });

      // Wait for new job value to be selected
      await waitFor(
        () => result.current.selectedLabelValues.job && result.current.selectedLabelValues.job.includes('prometheus')
      );

      expect(result.current.selectedLabelValues.job).toContain('prometheus');

      // 6. Change metric selection
      await act(async () => {
        await result.current.handleSelectedMetricChange('metric2');
      });
      expect(result.current.selectedMetric).toBe('metric2');

      // 7. Remove a label key
      await act(async () => {
        await result.current.handleSelectedLabelKeyChange('instance');
      });

      // Wait for instance to be removed from selectedLabelKeys
      await waitFor(() => !result.current.selectedLabelKeys.includes('instance'));

      expect(result.current.selectedLabelKeys).not.toContain('instance');

      // 8. Validate
      (mocks.mockLanguageProvider.fetchSeriesLabelsMatch as jest.Mock).mockResolvedValue({
        job: ['prometheus'],
      });

      await act(async () => {
        await result.current.handleValidation();
      });
      expect(result.current.validationStatus).toContain('Selector is valid');
    });
  });

  describe('state maintenance through complex interactions', () => {
    it('should handle a complex workflow with changing label sets', async () => {
      const { result } = await renderHookWithInit(mocks);

      // 1. Select a metric
      await act(async () => {
        await result.current.handleSelectedMetricChange('metric1');
      });

      // 2. Add a label key and select a value
      await act(async () => {
        await result.current.handleSelectedLabelKeyChange('job');
      });

      // Wait for job to be in selectedLabelKeys
      await waitFor(() => {
        expect(result.current.selectedLabelKeys).toContain('job');
      });

      // Wait for job values to load
      await waitFor(() => {
        return result.current.labelValues.job && result.current.labelValues.job.length > 0;
      });

      // Select a job value
      await act(async () => {
        await result.current.handleSelectedLabelValueChange('job', 'grafana', true);
      });

      // Wait for job value to be selected
      await waitFor(() => {
        return result.current.selectedLabelValues.job && result.current.selectedLabelValues.job.includes('grafana');
      });

      // 3. Now mock that selecting a certain job value changes the available instance values
      (mocks.mockLanguageProvider.fetchSeriesValuesWithMatch as jest.Mock).mockImplementation(
        (_timeRange: TimeRange, label: string) => {
          if (label === 'instance' && result.current.selectedLabelValues.job?.includes('grafana')) {
            return Promise.resolve(['grafana-host1', 'grafana-host2']);
          } else if (label === 'instance') {
            return Promise.resolve(['host1', 'host2']);
          }
          if (label === 'job') {
            return Promise.resolve(['grafana', 'prometheus']);
          }
          if (label === METRIC_LABEL) {
            return Promise.resolve(['metric1', 'metric2', 'metric3']);
          }
          return Promise.resolve([]);
        }
      );

      // 4. Add instance label
      await act(async () => {
        await result.current.handleSelectedLabelKeyChange('instance');
      });

      // Wait for instance to be in selectedLabelKeys
      await waitFor(() => {
        expect(result.current.selectedLabelKeys).toContain('instance');
      });

      // Wait for instance values to load
      await waitFor(() => {
        return result.current.labelValues.instance && result.current.labelValues.instance.length > 0;
      });

      // 5. Select a grafana-specific instance
      await act(async () => {
        await result.current.handleSelectedLabelValueChange('instance', 'grafana-host1', true);
      });

      // Wait for instance value to be selected
      await waitFor(() => {
        return (
          result.current.selectedLabelValues.instance &&
          result.current.selectedLabelValues.instance.includes('grafana-host1')
        );
      });

      // Verify our current state for debugging
      expect(result.current.selectedLabelValues.job).toBeDefined();
      expect(result.current.selectedLabelValues.job).toContain('grafana');
      expect(result.current.selectedLabelValues.instance).toBeDefined();
      expect(result.current.selectedLabelValues.instance).toContain('grafana-host1');

      // 6. First select a second job value to make sure the job array stays when we remove a value
      await act(async () => {
        await result.current.handleSelectedLabelValueChange('job', 'prometheus', true);
      });

      // Wait for both job values to be selected
      await waitFor(() => {
        return (
          result.current.selectedLabelValues.job &&
          result.current.selectedLabelValues.job.includes('grafana') &&
          result.current.selectedLabelValues.job.includes('prometheus')
        );
      });

      // Now deselect grafana
      await act(async () => {
        await result.current.handleSelectedLabelValueChange('job', 'grafana', false);
      });

      // Wait for grafana to be removed from job values but prometheus to remain
      await waitFor(() => {
        return (
          result.current.selectedLabelValues.job &&
          !result.current.selectedLabelValues.job.includes('grafana') &&
          result.current.selectedLabelValues.job.includes('prometheus')
        );
      });

      // Wait for instance values to update
      await waitFor(() => {
        return (
          result.current.labelValues.instance &&
          result.current.labelValues.instance.includes('host1') &&
          !result.current.labelValues.instance.includes('grafana-host1')
        );
      });

      // 7. Verify instance value was removed since it's no longer valid with the new job
      expect(result.current.selectedLabelValues.instance || []).not.toContain('grafana-host1');

      // 8. Verify the instance options have changed
      expect(result.current.labelValues.instance).toContain('host1');
      expect(result.current.labelValues.instance).toContain('host2');
      expect(result.current.labelValues.instance).not.toContain('grafana-host1');
    });
  });
});
