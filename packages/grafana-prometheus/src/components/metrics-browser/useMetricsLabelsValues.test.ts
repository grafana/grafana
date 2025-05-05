import { renderHook, waitFor, act } from '@testing-library/react';

import { TimeRange } from '@grafana/data';

import PromQlLanguageProvider from '../../language_provider';
import { getMockTimeRange } from '../../test/__mocks__/datasource';

import { buildSelector } from './selectorBuilder';
import { LAST_USED_LABELS_KEY, DEFAULT_SERIES_LIMIT, EMPTY_SELECTOR, METRIC_LABEL } from './types';
import { useMetricsLabelsValues } from './useMetricsLabelsValues';

// Mock buildSelector
jest.mock('./selectorBuilder', () => ({
  buildSelector: jest.fn().mockImplementation(() => '{}'),
  EMPTY_SELECTOR: '{}',
}));

// Mock local storage
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

// Mock console methods to suppress logging during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe('useMetricsLabelsValues', () => {
  // Mock dependencies
  const mockTimeRange: TimeRange = getMockTimeRange();
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
  } as unknown as PromQlLanguageProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    (buildSelector as jest.Mock).mockClear();

    // Suppress console output during tests
    console.log = jest.fn();
    console.error = jest.fn();

    // Mock fetchLabelValues (for metrics)
    (mockLanguageProvider.fetchLabelValues as jest.Mock).mockResolvedValue(['metric1', 'metric2', 'metric3']);

    // Mock fetchLabels for label keys
    (mockLanguageProvider.fetchLabels as jest.Mock).mockResolvedValue(['__name__', 'instance', 'job', 'service']);

    // Default implementation for fetchSeriesValuesWithMatch
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

    // Mock fetchSeriesLabelsMatch
    (mockLanguageProvider.fetchSeriesLabelsMatch as jest.Mock).mockResolvedValue({
      __name__: ['metric1', 'metric2'],
      instance: ['instance1', 'instance2'],
      job: ['job1', 'job2'],
      service: ['service1', 'service2'],
    });
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  it('should initialize by fetching metrics from language provider', async () => {
    renderHook(() => useMetricsLabelsValues(mockTimeRange, mockLanguageProvider));

    // Wait for the metrics to be populated from the mock
    await waitFor(() => {
      expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
    });

    expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalledWith(
      expect.anything(),
      METRIC_LABEL,
      undefined,
      'MetricsBrowser_M',
      DEFAULT_SERIES_LIMIT
    );
  });

  it('should fetch label keys during initialization', async () => {
    renderHook(() => useMetricsLabelsValues(mockTimeRange, mockLanguageProvider));

    // Wait for the fetchLabels to be called
    await waitFor(() => {
      expect(mockLanguageProvider.fetchLabels).toHaveBeenCalled();
    });

    expect(mockLanguageProvider.fetchLabels).toHaveBeenCalledWith(expect.anything(), undefined, DEFAULT_SERIES_LIMIT);
  });

  it('should load saved label keys from localStorage and fetch values', async () => {
    // Set up localStorage with saved label keys
    localStorageMock.setItem(LAST_USED_LABELS_KEY, JSON.stringify(['job', 'instance']));

    renderHook(() => useMetricsLabelsValues(mockTimeRange, mockLanguageProvider));

    // Wait for the fetchSeriesValuesWithMatch to be called for both job and instance
    await waitFor(() => {
      const fetchCalls = (mockLanguageProvider.fetchSeriesValuesWithMatch as jest.Mock).mock.calls;
      const jobCall = fetchCalls.find((call) => call[1] === 'job' && call[3] === 'MetricsBrowser_LV_job');
      const instanceCall = fetchCalls.find(
        (call) => call[1] === 'instance' && call[3] === 'MetricsBrowser_LV_instance'
      );
      return jobCall && instanceCall;
    });

    // Verify that fetchSeriesValuesWithMatch was called with the expected parameters for job
    expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalledWith(
      expect.anything(),
      'job',
      undefined,
      'MetricsBrowser_LV_job',
      DEFAULT_SERIES_LIMIT
    );

    // Verify that fetchSeriesValuesWithMatch was called with the expected parameters for instance
    expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalledWith(
      expect.anything(),
      'instance',
      undefined,
      'MetricsBrowser_LV_instance',
      DEFAULT_SERIES_LIMIT
    );
  });

  it('should set label values as string arrays', async () => {
    // Set up localStorage with saved label keys
    localStorageMock.setItem(LAST_USED_LABELS_KEY, JSON.stringify(['job']));

    const { result } = renderHook(() => useMetricsLabelsValues(mockTimeRange, mockLanguageProvider));

    // Wait for the label values to be set
    await waitFor(() => {
      return result.current.labelValues.job !== undefined;
    });

    // Verify label values are stored as string arrays
    expect(Array.isArray(result.current.labelValues.job)).toBe(true);
    expect(result.current.labelValues.job).toEqual(['grafana', 'prometheus']);
  });

  it('should update timeRange reference for significant changes', async () => {
    const { rerender } = renderHook(({ timeRange, provider }) => useMetricsLabelsValues(timeRange, provider), {
      initialProps: {
        timeRange: mockTimeRange,
        provider: mockLanguageProvider,
      },
    });

    // Wait for initial fetch to complete
    await waitFor(() => {
      expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
    });

    // Clear mock calls
    jest.clearAllMocks();

    // Update with new time range that is 10 seconds different (above 5 second threshold)
    const significantChangedTimeRange = {
      ...mockTimeRange,
      from: mockTimeRange.from.add(10, 'seconds'),
      to: mockTimeRange.to.add(10, 'seconds'),
    };

    rerender({
      timeRange: significantChangedTimeRange,
      provider: mockLanguageProvider,
    });

    // The timeRangeRef is updated but shouldn't trigger a refetch
    expect(mockLanguageProvider.fetchSeriesValuesWithMatch).not.toHaveBeenCalled();
  });

  describe('handleSelectedMetricChange', () => {
    it('should select a metric when not previously selected', async () => {
      const { result } = renderHook(() => useMetricsLabelsValues(mockTimeRange, mockLanguageProvider));

      // Wait for initialization
      await waitFor(() => {
        expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
      });

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
      const { result } = renderHook(() => useMetricsLabelsValues(mockTimeRange, mockLanguageProvider));

      // Wait for initialization
      await waitFor(() => {
        expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
      });

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
      (mockLanguageProvider.fetchSeriesLabelsMatch as jest.Mock).mockResolvedValue({
        __name__: ['metric1'],
        job: ['job1', 'job2'],
        instance: ['instance1', 'instance2'],
        service: ['service1', 'service2'],
      });

      // Start with some selected label keys
      localStorageMock.setItem(LAST_USED_LABELS_KEY, JSON.stringify(['job', 'instance', 'service']));

      const { result } = renderHook(() => useMetricsLabelsValues(mockTimeRange, mockLanguageProvider));

      // Wait for initialization
      await waitFor(() => {
        expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
      });

      await waitFor(() => {
        return result.current.selectedLabelKeys.length === 3;
      });

      // Clear mock calls
      jest.clearAllMocks();

      // Select a metric
      await act(async () => {
        await result.current.handleSelectedMetricChange('metric1');
      });

      // Verify that the label keys were updated to those returned by fetchSeriesLabelsMatch
      expect(result.current.labelKeys).toContain('job');
      expect(result.current.labelKeys).toContain('instance');
      expect(result.current.labelKeys).toContain('service');

      // Verify that selected label keys were filtered to only include those available for the metric
      expect(result.current.selectedLabelKeys).toContain('job');
      expect(result.current.selectedLabelKeys).toContain('instance');
      expect(result.current.selectedLabelKeys).toContain('service');

      // Verify that label values were fetched
      expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
    });
  });

  describe('handleSelectedLabelKeyChange', () => {
    it('should add a label key when it is not already selected', async () => {
      // Start with an empty selected label keys array
      const { result } = renderHook(() => useMetricsLabelsValues(mockTimeRange, mockLanguageProvider));

      // Wait for initialization
      await waitFor(() => {
        expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
      });

      // Clear mock calls before testing handleSelectedLabelKeyChange
      jest.clearAllMocks();

      // Since we have no selected metric, the buildSelector will return EMPTY_SELECTOR
      // and the hook will use undefined instead of the selector
      (buildSelector as jest.Mock).mockReturnValue(EMPTY_SELECTOR);

      // Add a new label key
      await act(async () => {
        await result.current.handleSelectedLabelKeyChange('service');
      });

      // Verify the label key was added
      expect(result.current.selectedLabelKeys).toContain('service');

      // Verify that buildSelector was called
      expect(buildSelector).toHaveBeenCalled();

      // Verify that fetchSeriesValuesWithMatch was called to get values for the new label key
      // with undefined in place of the EMPTY_SELECTOR
      expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalledWith(
        expect.anything(),
        'service',
        undefined, // Since selector is EMPTY_SELECTOR, it should be converted to undefined
        'MetricsBrowser_LV_service',
        DEFAULT_SERIES_LIMIT
      );

      // Verify localStorage was updated
      expect(localStorageMock.setItem).toHaveBeenCalledWith(LAST_USED_LABELS_KEY, JSON.stringify(['service']));
    });

    it('should set selected label key from localStorage', async () => {
      // Clear everything first
      jest.clearAllMocks();
      localStorageMock.clear();

      // Mock fetchLabels to ensure it returns 'job' in the available labels
      // This is critical because the hook filters localStorage labels against these values
      (mockLanguageProvider.fetchLabels as jest.Mock).mockResolvedValue(['job', 'instance']);

      // IMPORTANT: set up localStorage before the hook is initialized
      localStorageMock.setItem(LAST_USED_LABELS_KEY, JSON.stringify(['job']));

      // Render the hook
      const { result } = renderHook(() => useMetricsLabelsValues(mockTimeRange, mockLanguageProvider));

      // Wait for the async initialization to complete
      await waitFor(() => {
        // Wait until fetchLabels has been called - this indicates the initialization started
        expect(mockLanguageProvider.fetchLabels).toHaveBeenCalled();
        // And wait until selectedLabelKeys includes 'job' - this indicates state was updated
        return result.current.selectedLabelKeys.includes('job');
      });

      // Now verify the state after initialization
      expect(result.current.selectedLabelKeys).toEqual(['job']);
    });

    it('should remove a label key when it is already selected', async () => {
      // Clear everything first
      jest.clearAllMocks();
      localStorageMock.clear();

      // IMPORTANT: set up localStorage before the hook is initialized
      localStorageMock.setItem(LAST_USED_LABELS_KEY, JSON.stringify(['job']));

      // Mock fetchLabels to specifically include 'job' in the returned keys
      // This is critical because the hook filters localStorage labels against these values
      (mockLanguageProvider.fetchLabels as jest.Mock).mockImplementation(() => {
        return Promise.resolve(['job']);
      });

      // Simple mock for fetchSeriesValuesWithMatch
      (mockLanguageProvider.fetchSeriesValuesWithMatch as jest.Mock).mockImplementation((_, label) => {
        if (label === 'job') {
          return Promise.resolve(['job-value']);
        }
        if (label === METRIC_LABEL) {
          return Promise.resolve(['metric1']);
        }
        return Promise.resolve(['value1']);
      });

      // Render the hook
      const { result } = renderHook(() => useMetricsLabelsValues(mockTimeRange, mockLanguageProvider));

      // Wait for initialization to complete
      await waitFor(
        () => {
          // Wait until fetchLabels has been called - this indicates the initialization started
          expect(mockLanguageProvider.fetchLabels).toHaveBeenCalled();
          // And wait until selectedLabelKeys includes 'job' - this indicates state was updated
          return result.current.selectedLabelKeys.includes('job');
        },
        { timeout: 5000 }
      );

      // Verify the initial state
      expect(result.current.selectedLabelKeys).toEqual(['job']);

      // Mock localStorage.setItem to verify it's called correctly
      localStorageMock.setItem.mockClear();

      // Use a simplified approach - just call handleSelectedLabelKeyChange directly
      await act(async () => {
        await result.current.handleSelectedLabelKeyChange('job');
      });

      // Skip the waitFor and directly verify the state was updated
      expect(result.current.selectedLabelKeys).not.toContain('job');
      expect(result.current.selectedLabelKeys).toEqual([]);

      // Verify label values were removed
      expect(result.current.labelValues).not.toHaveProperty('job');

      // Verify localStorage was updated
      expect(localStorageMock.setItem).toHaveBeenCalledWith(LAST_USED_LABELS_KEY, JSON.stringify([]));
    });

    it('should handle labelKey changes when a metric is selected', async () => {
      // Setup with a selected metric
      const { result } = renderHook(() => useMetricsLabelsValues(mockTimeRange, mockLanguageProvider));

      // Wait for initialization
      await waitFor(() => {
        expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
      });

      // Select a metric first
      await act(async () => {
        await result.current.handleSelectedMetricChange('metric1');
      });

      // Clear mock calls
      jest.clearAllMocks();

      // Mock the buildSelector to return a non-empty selector
      (buildSelector as jest.Mock).mockReturnValue('metric1{instance="host1"}');

      // Add a label key
      await act(async () => {
        await result.current.handleSelectedLabelKeyChange('service');
      });

      // Verify buildSelector was called with the selected metric and label values
      expect(buildSelector).toHaveBeenCalled();

      // Verify fetchSeriesValuesWithMatch was called with the correct selector
      expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalledWith(
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
      localStorageMock.setItem(LAST_USED_LABELS_KEY, JSON.stringify(['job']));

      const { result } = renderHook(() => useMetricsLabelsValues(mockTimeRange, mockLanguageProvider));

      // Wait for initialization
      await waitFor(() => {
        expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
      });

      // Clear mock calls
      jest.clearAllMocks();

      // Select a label value
      await act(async () => {
        await result.current.handleSelectedLabelValueChange('job', 'grafana', true);
      });

      // Verify the value was added to selectedLabelValues
      expect(result.current.selectedLabelValues.job).toContain('grafana');

      // Verify buildSelector was called to create a selector with the selected value
      expect(buildSelector).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ job: ['grafana'] }));

      // Verify metrics were fetched with the new selector
      expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalledWith(
        expect.anything(),
        METRIC_LABEL,
        `metric1{instance="host1"}`,
        'MetricsBrowser_M',
        DEFAULT_SERIES_LIMIT
      );

      // Verify label keys were fetched for the filtered metrics
      expect(mockLanguageProvider.fetchSeriesLabelsMatch).toHaveBeenCalled();
    });

    it('should remove a label value when isSelected is false', async () => {
      // Setup initial state with selected label key and value
      localStorageMock.setItem(LAST_USED_LABELS_KEY, JSON.stringify(['job']));

      const { result } = renderHook(() => useMetricsLabelsValues(mockTimeRange, mockLanguageProvider));

      // Wait for initialization
      await waitFor(() => {
        expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
      });

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
      (mockLanguageProvider.fetchSeriesValuesWithMatch as jest.Mock).mockImplementation(
        (_timeRange: TimeRange, label: string) => {
          if (label === 'job') {
            // Return a smaller set of values on refetch
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
      localStorageMock.setItem(LAST_USED_LABELS_KEY, JSON.stringify(['job', 'instance']));

      const { result } = renderHook(() => useMetricsLabelsValues(mockTimeRange, mockLanguageProvider));

      // Wait for initialization
      await waitFor(() => {
        expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
      });

      // Initialize job values with a larger set
      const initialJobValues = ['grafana', 'prometheus', 'additional_value'];

      // Select a value for job (should set job as last selected)
      await act(async () => {
        await result.current.handleSelectedLabelValueChange('job', 'grafana', true);
      });

      // Mock a more extensive set of label values for job
      (mockLanguageProvider.fetchSeriesValuesWithMatch as jest.Mock).mockImplementation(
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

    it('should only update selected values for non-last-selected keys', async () => {
      // Setup mock to return different values for initial and subsequent calls
      let callCount = 0;
      (mockLanguageProvider.fetchSeriesValuesWithMatch as jest.Mock).mockImplementation(
        (_timeRange: TimeRange, label: string) => {
          if (label === 'job') {
            return Promise.resolve(['grafana', 'prometheus']);
          }
          if (label === 'instance') {
            // Return different values on first vs subsequent calls
            callCount++;
            if (callCount === 1) {
              return Promise.resolve(['host1', 'host2']);
            } else {
              return Promise.resolve(['host3']);
            }
          }
          if (label === METRIC_LABEL) {
            return Promise.resolve(['metric1', 'metric2']);
          }
          return Promise.resolve([]);
        }
      );

      // Start with selected label keys
      localStorageMock.setItem(LAST_USED_LABELS_KEY, JSON.stringify(['job', 'instance']));

      const { result } = renderHook(() => useMetricsLabelsValues(mockTimeRange, mockLanguageProvider));

      // Wait for initialization
      await waitFor(() => {
        expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
      });

      // First set a selected value for instance
      await act(async () => {
        await result.current.handleSelectedLabelValueChange('instance', 'host1', true);
      });

      // Verify initial selection
      expect(result.current.selectedLabelValues.instance).toContain('host1');

      // Clear mock calls
      jest.clearAllMocks();

      // Now select a value for job (instance is not last selected anymore)
      await act(async () => {
        await result.current.handleSelectedLabelValueChange('job', 'grafana', true);
      });

      // Check that newly fetched instance values were intersected with selected values
      expect(result.current.labelValues.instance).toContain('host3');
    });

    it('should handle errors during label values fetching', async () => {
      // Mock fetchSeriesValuesWithMatch to throw an error for specific labels
      (mockLanguageProvider.fetchSeriesValuesWithMatch as jest.Mock).mockImplementation(
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
      localStorageMock.setItem(LAST_USED_LABELS_KEY, JSON.stringify(['job', 'instance']));

      const { result } = renderHook(() => useMetricsLabelsValues(mockTimeRange, mockLanguageProvider));

      // Wait for the error to be logged
      await waitFor(() => {
        // Use a loop to find console.error calls with our test error
        const errorCalls = (console.error as jest.Mock).mock.calls;
        return errorCalls.some((call) => call[0] instanceof Error && call[0].message === 'Test error');
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

  describe('helper functions', () => {
    describe('buildSafeSelector', () => {
      beforeEach(() => {
        jest.clearAllMocks();
      });

      it('should convert EMPTY_SELECTOR to undefined', async () => {
        (buildSelector as jest.Mock).mockReturnValue(EMPTY_SELECTOR);

        const { result } = renderHook(() => useMetricsLabelsValues(mockTimeRange, mockLanguageProvider));

        // We need to access the helper function in a test-friendly way
        const buildSafeSelector = result.current.buildSafeSelector;

        expect(buildSafeSelector('metric1', {})).toBeUndefined();
      });

      it('should return the selector value when not empty', async () => {
        const expectedSelector = 'metric1{job="prometheus"}';
        (buildSelector as jest.Mock).mockReturnValue(expectedSelector);

        const { result } = renderHook(() => useMetricsLabelsValues(mockTimeRange, mockLanguageProvider));

        const buildSafeSelector = result.current.buildSafeSelector;

        expect(buildSafeSelector('metric1', { job: ['prometheus'] })).toBe(expectedSelector);
      });
    });

    describe('loadSelectedLabelsFromStorage', () => {
      it('should filter labels against available labels', async () => {
        localStorageMock.setItem(LAST_USED_LABELS_KEY, JSON.stringify(['job', 'instance', 'unavailable']));

        const { result } = renderHook(() => useMetricsLabelsValues(mockTimeRange, mockLanguageProvider));

        const loadSelectedLabelsFromStorage = result.current.loadSelectedLabelsFromStorage;

        const availableLabels = ['job', 'instance', 'pod'];
        expect(loadSelectedLabelsFromStorage(availableLabels)).toEqual(['job', 'instance']);
      });

      it('should handle empty localStorage', async () => {
        localStorageMock.clear();

        const { result } = renderHook(() => useMetricsLabelsValues(mockTimeRange, mockLanguageProvider));

        const loadSelectedLabelsFromStorage = result.current.loadSelectedLabelsFromStorage;

        expect(loadSelectedLabelsFromStorage(['job', 'instance'])).toEqual([]);
      });
    });

    describe('fetchMetrics', () => {
      beforeEach(() => {
        jest.clearAllMocks();
      });

      it('should fetch metrics with the provided selector', async () => {
        const { result } = renderHook(() => useMetricsLabelsValues(mockTimeRange, mockLanguageProvider));

        // Clear previous calls
        jest.clearAllMocks();

        const fetchMetrics = result.current.fetchMetrics;

        await act(async () => {
          await fetchMetrics('selector');
        });

        expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalledWith(
          expect.anything(),
          METRIC_LABEL,
          'selector',
          'MetricsBrowser_M',
          DEFAULT_SERIES_LIMIT
        );
      });
    });

    describe('fetchLabelKeys', () => {
      beforeEach(() => {
        jest.clearAllMocks();
      });

      it('should fetch label keys with no selector', async () => {
        const { result } = renderHook(() => useMetricsLabelsValues(mockTimeRange, mockLanguageProvider));

        // Clear previous calls
        jest.clearAllMocks();

        const fetchLabelKeys = result.current.fetchLabelKeys;

        await act(async () => {
          await fetchLabelKeys();
        });

        expect(mockLanguageProvider.fetchLabels).toHaveBeenCalledWith(
          expect.anything(),
          undefined,
          DEFAULT_SERIES_LIMIT
        );
      });

      it('should fetch label keys with a selector', async () => {
        const { result } = renderHook(() => useMetricsLabelsValues(mockTimeRange, mockLanguageProvider));

        // Clear previous calls
        jest.clearAllMocks();

        const fetchLabelKeys = result.current.fetchLabelKeys;

        await act(async () => {
          await fetchLabelKeys('selector');
        });

        expect(mockLanguageProvider.fetchSeriesLabelsMatch).toHaveBeenCalledWith(
          expect.anything(),
          'selector',
          DEFAULT_SERIES_LIMIT
        );
      });

      it('should handle errors during fetching', async () => {
        (mockLanguageProvider.fetchLabels as jest.Mock).mockRejectedValueOnce(new Error('Test error'));

        const { result } = renderHook(() => useMetricsLabelsValues(mockTimeRange, mockLanguageProvider));

        const fetchLabelKeys = result.current.fetchLabelKeys;

        let labelKeys;
        await act(async () => {
          labelKeys = await fetchLabelKeys();
        });

        expect(labelKeys).toEqual([]);
        expect(result.current.err).toContain('Error fetching labels');
      });
    });

    describe('fetchLabelValues', () => {
      it('should fetch values for multiple label keys', async () => {
        const { result } = renderHook(() => useMetricsLabelsValues(mockTimeRange, mockLanguageProvider));

        // Clear previous calls
        jest.clearAllMocks();

        const fetchLabelValues = result.current.fetchLabelValues;

        await act(async () => {
          await fetchLabelValues(['job', 'instance']);
        });

        // Verify calls for both label keys
        expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalledWith(
          expect.anything(),
          'job',
          undefined,
          'MetricsBrowser_LV_job',
          DEFAULT_SERIES_LIMIT
        );

        expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalledWith(
          expect.anything(),
          'instance',
          undefined,
          'MetricsBrowser_LV_instance',
          DEFAULT_SERIES_LIMIT
        );
      });

      it('should handle errors for individual label keys', async () => {
        (mockLanguageProvider.fetchSeriesValuesWithMatch as jest.Mock).mockImplementation((_timeRange, label) => {
          if (label === 'job') {
            return Promise.reject(new Error('Test error'));
          }
          return Promise.resolve(['value1', 'value2']);
        });

        const { result } = renderHook(() => useMetricsLabelsValues(mockTimeRange, mockLanguageProvider));

        const fetchLabelValues = result.current.fetchLabelValues;

        let values;
        await act(async () => {
          const response = await fetchLabelValues(['job', 'instance']);
          if (response) {
            [values] = response;
            // Should contain values for instance but not for job
            expect(values).not.toHaveProperty('job');
            expect(values).toHaveProperty('instance');
          }
        });

        expect(result.current.err).toContain('Error fetching label values');
      });
    });
  });
});
