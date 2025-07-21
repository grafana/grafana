import { act, renderHook, waitFor } from '@testing-library/react';

import { TimeRange } from '@grafana/data';

import { DEFAULT_SERIES_LIMIT, EMPTY_SELECTOR, LAST_USED_LABELS_KEY, METRIC_LABEL } from '../../constants';
import { PrometheusDatasource } from '../../datasource';
import { PrometheusLanguageProvider, PrometheusLanguageProviderInterface } from '../../language_provider';
import { getMockTimeRange } from '../../test/mocks/datasource';

import * as selectorBuilderModule from './selectorBuilder';
import { useMetricsLabelsValues } from './useMetricsLabelsValues';

// Test utilities to reduce boilerplate
const setupMocks = () => {
  // Mock the buildSelector module
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
  const mockLanguageProvider: PrometheusLanguageProviderInterface = new PrometheusLanguageProvider({
    seriesLimit: DEFAULT_SERIES_LIMIT,
  } as unknown as PrometheusDatasource);

  mockLanguageProvider.retrieveMetrics = jest.fn().mockReturnValue(['metric1', 'metric2', 'metric3']);
  mockLanguageProvider.retrieveLabelKeys = jest.fn().mockReturnValue(['__name__', 'instance', 'job', 'service']);
  mockLanguageProvider.retrieveMetricsMetadata = jest.fn().mockReturnValue({
    metric1: { type: 'counter', help: 'Test metric 1' },
    metric2: { type: 'gauge', help: 'Test metric 2' },
  });
  mockLanguageProvider.queryLabelValues = jest.fn();
  mockLanguageProvider.queryLabelKeys = jest.fn();

  // Mock standard responses
  (mockLanguageProvider.queryLabelValues as jest.Mock).mockImplementation((_timeRange: TimeRange, label: string) => {
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
  });

  (mockLanguageProvider.queryLabelKeys as jest.Mock).mockImplementation((_timeRange: TimeRange, selector?: string) => {
    if (selector) {
      return Promise.resolve({
        __name__: ['metric1', 'metric2'],
        instance: ['instance1', 'instance2'],
        job: ['job1', 'job2'],
        service: ['service1', 'service2'],
      });
    }
    return Promise.resolve(['__name__', 'instance', 'job', 'service']);
  });

  const mockTimeRange: TimeRange = getMockTimeRange();

  return { mockLanguageProvider, mockTimeRange, localStorageMock };
};

// Helper to render hook with standard initialization
const renderHookWithInit = async (mocks: ReturnType<typeof setupMocks>) => {
  const hookResult = renderHook(() => useMetricsLabelsValues(mocks.mockTimeRange, mocks.mockLanguageProvider));

  // Wait for initialization
  await act(async () => {
    await waitFor(() => {
      expect(mocks.mockLanguageProvider.queryLabelValues).toHaveBeenCalled();
    });
    // Wait for any additional state updates
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  return hookResult;
};

describe('useMetricsLabelsValues', () => {
  let mocks: ReturnType<typeof setupMocks>;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    mocks = setupMocks();
    jest.clearAllMocks();
    // Spy on console.error to handle React warnings
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    // Cleanup any pending state updates
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    consoleSpy.mockRestore();
    jest.restoreAllMocks();
  });

  // Helper function to wait for all state updates
  const waitForStateUpdates = async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  // Helper function to wait for debounce
  const waitForDebounce = async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
  };

  describe('initialization', () => {
    it('should initialize by fetching metrics', async () => {
      renderHook(() => useMetricsLabelsValues(mocks.mockTimeRange, mocks.mockLanguageProvider));

      await waitFor(() => {
        expect(mocks.mockLanguageProvider.queryLabelValues).toHaveBeenCalled();
      });

      expect(mocks.mockLanguageProvider.queryLabelValues).toHaveBeenCalledWith(
        expect.anything(),
        METRIC_LABEL,
        undefined,
        DEFAULT_SERIES_LIMIT
      );
    });

    it('should fetch label keys during initialization', async () => {
      renderHook(() => useMetricsLabelsValues(mocks.mockTimeRange, mocks.mockLanguageProvider));

      await waitFor(() => {
        expect(mocks.mockLanguageProvider.queryLabelKeys).toHaveBeenCalled();
      });

      expect(mocks.mockLanguageProvider.queryLabelKeys).toHaveBeenCalledWith(
        expect.anything(),
        undefined,
        DEFAULT_SERIES_LIMIT
      );
    });

    it('should load saved label keys from localStorage and fetch values', async () => {
      mocks.localStorageMock.setItem(LAST_USED_LABELS_KEY, JSON.stringify(['job', 'instance']));

      renderHook(() => useMetricsLabelsValues(mocks.mockTimeRange, mocks.mockLanguageProvider));

      await waitFor(() => {
        const fetchCalls = (mocks.mockLanguageProvider.queryLabelValues as jest.Mock).mock.calls;
        const jobCall = fetchCalls.find((call) => call[1] === 'job');
        const instanceCall = fetchCalls.find((call) => call[1] === 'instance');
        return jobCall && instanceCall;
      });

      expect(mocks.mockLanguageProvider.queryLabelValues).toHaveBeenCalledWith(
        expect.anything(),
        'job',
        undefined,
        DEFAULT_SERIES_LIMIT
      );

      expect(mocks.mockLanguageProvider.queryLabelValues).toHaveBeenCalledWith(
        expect.anything(),
        'instance',
        undefined,
        DEFAULT_SERIES_LIMIT
      );
    });
  });

  describe('metric selection', () => {
    it('should handle metric selection', async () => {
      const { result } = await renderHookWithInit(mocks);

      await act(async () => {
        await result.current.handleSelectedMetricChange('metric1');
      });

      expect(result.current.selectedMetric).toBe('metric1');
      expect(mocks.mockLanguageProvider.queryLabelKeys).toHaveBeenCalledWith(
        expect.anything(),
        undefined,
        DEFAULT_SERIES_LIMIT
      );
    });

    it('should clear metric selection when selecting same metric', async () => {
      const { result } = await renderHookWithInit(mocks);

      await act(async () => {
        await result.current.handleSelectedMetricChange('metric1');
      });

      expect(result.current.selectedMetric).toBe('metric1');

      await act(async () => {
        await result.current.handleSelectedMetricChange('metric1');
      });

      expect(result.current.selectedMetric).toBe('');
    });

    it('should update label keys when metric is selected', async () => {
      const { result } = await renderHookWithInit(mocks);

      await act(async () => {
        await result.current.handleSelectedMetricChange('metric1');
      });

      expect(mocks.mockLanguageProvider.queryLabelKeys).toHaveBeenCalled();
      expect(result.current.labelKeys).toEqual(['__name__', 'instance', 'job', 'service']);
    });
  });

  describe('label key selection', () => {
    it('should handle label key selection', async () => {
      const { result } = await renderHookWithInit(mocks);

      await act(async () => {
        await result.current.handleSelectedLabelKeyChange('job');
      });

      expect(result.current.selectedLabelKeys).toContain('job');
      expect(mocks.mockLanguageProvider.queryLabelValues).toHaveBeenCalledWith(
        expect.anything(),
        'job',
        undefined,
        DEFAULT_SERIES_LIMIT
      );
    });

    it('should handle label key deselection', async () => {
      const { result } = await renderHookWithInit(mocks);

      await act(async () => {
        await result.current.handleSelectedLabelKeyChange('job');
      });

      expect(result.current.selectedLabelKeys).toContain('job');

      await act(async () => {
        await result.current.handleSelectedLabelKeyChange('job');
      });

      expect(result.current.selectedLabelKeys).not.toContain('job');
      expect(result.current.labelValues['job']).toBeUndefined();
    });

    it('should save selected label keys to localStorage', async () => {
      const { result } = await renderHookWithInit(mocks);

      await act(async () => {
        await result.current.handleSelectedLabelKeyChange('job');
      });

      expect(mocks.localStorageMock.setItem).toHaveBeenCalledWith(LAST_USED_LABELS_KEY, JSON.stringify(['job']));
    });

    it('should fetch label values when label key is selected', async () => {
      const { result } = await renderHookWithInit(mocks);

      await act(async () => {
        await result.current.handleSelectedLabelKeyChange('job');
      });

      expect(mocks.mockLanguageProvider.queryLabelValues).toHaveBeenCalledWith(
        expect.anything(),
        'job',
        undefined,
        DEFAULT_SERIES_LIMIT
      );
      expect(result.current.labelValues['job']).toEqual(['grafana', 'prometheus']);
    });
  });

  describe('label value selection', () => {
    it('should handle label value selection', async () => {
      const { result } = await renderHookWithInit(mocks);

      await act(async () => {
        await result.current.handleSelectedLabelKeyChange('job');
        await result.current.handleSelectedLabelValueChange('job', 'grafana', true);
      });

      expect(result.current.selectedLabelValues['job']).toContain('grafana');
      expect(mocks.mockLanguageProvider.queryLabelValues).toHaveBeenCalled();
    });

    it('should handle label value deselection', async () => {
      const { result } = await renderHookWithInit(mocks);

      await act(async () => {
        await result.current.handleSelectedLabelKeyChange('job');
        await result.current.handleSelectedLabelValueChange('job', 'grafana', true);
      });

      expect(result.current.selectedLabelValues['job']).toContain('grafana');

      await act(async () => {
        await result.current.handleSelectedLabelValueChange('job', 'grafana', false);
      });

      expect(result.current.selectedLabelValues['job']).toBeUndefined();
    });

    it('should update metrics when label value is selected', async () => {
      const { result } = await renderHookWithInit(mocks);

      // Clear previous calls from initialization
      (mocks.mockLanguageProvider.queryLabelValues as jest.Mock).mockClear();

      await act(async () => {
        await result.current.handleSelectedLabelKeyChange('job');
        await result.current.handleSelectedLabelValueChange('job', 'grafana', true);
      });

      // Get all calls to queryLabelValues after our actions
      const calls = (mocks.mockLanguageProvider.queryLabelValues as jest.Mock).mock.calls;

      // Find the call that fetches metrics (__name__)
      const metricsCall = calls.find((call) => call[1] === METRIC_LABEL);
      expect(metricsCall).toBeTruthy();
      expect(metricsCall![1]).toBe(METRIC_LABEL);
      expect(metricsCall![3]).toBe(DEFAULT_SERIES_LIMIT);
    });

    it('should update other label values when a value is selected', async () => {
      const { result } = await renderHookWithInit(mocks);

      // Clear previous calls from initialization
      (mocks.mockLanguageProvider.queryLabelValues as jest.Mock).mockClear();

      await act(async () => {
        await result.current.handleSelectedLabelKeyChange('job');
        await result.current.handleSelectedLabelKeyChange('instance');
        await result.current.handleSelectedLabelValueChange('job', 'grafana', true);
      });

      // Get all calls to queryLabelValues after our actions
      const calls = (mocks.mockLanguageProvider.queryLabelValues as jest.Mock).mock.calls;

      // Find the call that fetches metrics (__name__)
      const metricsCall = calls.find((call) => call[1] === 'instance');
      expect(metricsCall).toBeTruthy();
      expect(metricsCall![1]).toBe('instance');
      expect(metricsCall![3]).toBe(DEFAULT_SERIES_LIMIT);
    });
  });

  describe('validation', () => {
    it('should validate selector', async () => {
      const { result } = await renderHookWithInit(mocks);

      await act(async () => {
        await result.current.handleSelectedMetricChange('metric1');
        await result.current.handleSelectedLabelKeyChange('job');
        await result.current.handleSelectedLabelValueChange('job', 'grafana', true);
        await result.current.handleValidation();
      });

      expect(result.current.validationStatus).toContain('Selector is valid');
      expect(mocks.mockLanguageProvider.queryLabelKeys).toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      const { result } = await renderHookWithInit(mocks);

      (mocks.mockLanguageProvider.queryLabelKeys as jest.Mock).mockRejectedValueOnce(new Error('Test error'));

      await act(async () => {
        await result.current.handleValidation();
      });

      expect(result.current.err).toContain('Test error');
      expect(result.current.validationStatus).toBe('');
    });
  });

  describe('clear functionality', () => {
    it('should clear all selections', async () => {
      const { result } = await renderHookWithInit(mocks);

      await act(async () => {
        await result.current.handleSelectedMetricChange('metric1');
        await result.current.handleSelectedLabelKeyChange('job');
        await result.current.handleSelectedLabelValueChange('job', 'grafana', true);
      });

      await act(async () => {
        await result.current.handleClear();
      });

      expect(result.current.selectedMetric).toBe('');
      expect(result.current.selectedLabelKeys).toEqual([]);
      expect(result.current.selectedLabelValues).toEqual({});
      expect(result.current.err).toBe('');
      expect(result.current.status).toBe('Ready');
      expect(result.current.validationStatus).toBe('');
      expect(mocks.localStorageMock.setItem).toHaveBeenCalledWith(LAST_USED_LABELS_KEY, '[]');
    });
  });

  describe('error handling', () => {
    it('should handle errors during metric fetch', async () => {
      (mocks.mockLanguageProvider.queryLabelValues as jest.Mock).mockRejectedValueOnce(new Error('Metric fetch error'));

      const { result } = await renderHookWithInit(mocks);

      expect(result.current.err).toContain('Metric fetch error');
    });

    it('should handle errors during label value fetch', async () => {
      const { result } = await renderHookWithInit(mocks);

      (mocks.mockLanguageProvider.queryLabelValues as jest.Mock).mockRejectedValueOnce(
        new Error('Label value fetch error')
      );

      await act(async () => {
        await result.current.handleSelectedLabelKeyChange('job');
      });

      expect(result.current.err).toContain('Label value fetch error');
    });

    it('should clear error state when new operation succeeds', async () => {
      const { result } = await renderHookWithInit(mocks);

      // Mock first call to fail
      (mocks.mockLanguageProvider.queryLabelValues as jest.Mock)
        .mockRejectedValueOnce(new Error('Test error'))
        // Mock subsequent calls to succeed
        .mockResolvedValue(['value1', 'value2']);

      await act(async () => {
        await result.current.handleSelectedLabelKeyChange('job');
      });

      expect(result.current.err).toContain('Test error');

      await act(async () => {
        await result.current.handleSelectedLabelKeyChange('instance');
      });

      // The error should be cleared by the successful operation
      expect(result.current.err).toBe('');
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
      const { result, unmount } = renderHook(() =>
        useMetricsLabelsValues(mocks.mockTimeRange, mocks.mockLanguageProvider)
      );

      // Wait for initial state updates
      await waitForStateUpdates();

      // Clear mock calls
      jest.clearAllMocks();

      // Change series limit
      await act(async () => {
        result.current.setSeriesLimit(1000 as unknown as typeof DEFAULT_SERIES_LIMIT);
        await waitForDebounce();
      });

      // Verify data was refetched with new limit
      await waitFor(() => {
        const matchCalls = (mocks.mockLanguageProvider.queryLabelKeys as jest.Mock).mock.calls;
        const callWithNewLimit = matchCalls.find((call) => call[2] === 1000);
        expect(callWithNewLimit).toBeTruthy();
      });

      // Cleanup
      unmount();
      await waitForStateUpdates();
    });

    it('should use DEFAULT_SERIES_LIMIT when seriesLimit is empty', async () => {});
  });

  describe('timeRange handling', () => {
    it('should not update timeRangeRef for small time changes', async () => {});

    it('should update timeRangeRef for significant time changes', async () => {});
  });

  describe('testing with invalid values or special characters', () => {
    it('should handle metric names with special characters', async () => {
      (mocks.mockLanguageProvider.queryLabelValues as jest.Mock).mockImplementation(
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
      (mocks.mockLanguageProvider.queryLabelValues as jest.Mock).mockImplementation(
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
      (mocks.mockLanguageProvider.queryLabelValues as jest.Mock).mockImplementation(
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
      (mocks.mockLanguageProvider.queryLabelValues as jest.Mock).mockResolvedValue(['grafana', 'host1']);

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
      (mocks.mockLanguageProvider.queryLabelValues as jest.Mock).mockResolvedValue(['prometheus']);

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
      (mocks.mockLanguageProvider.queryLabelValues as jest.Mock).mockImplementation(
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
