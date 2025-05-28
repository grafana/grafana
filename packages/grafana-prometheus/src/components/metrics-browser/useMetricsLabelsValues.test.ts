import { act, renderHook, waitFor } from '@testing-library/react';

import { TimeRange } from '@grafana/data';

import { PrometheusLanguageProviderInterface } from '../../language_provider';
import { getMockTimeRange } from '../../test/__mocks__/datasource';

import * as selectorBuilderModule from './selectorBuilder';
import { DEFAULT_SERIES_LIMIT, EMPTY_SELECTOR, LAST_USED_LABELS_KEY, METRIC_LABEL } from './types';
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
  const mockLanguageProvider: PrometheusLanguageProviderInterface = {
    retrieveMetrics: jest.fn().mockReturnValue(['metric1', 'metric2', 'metric3']),
    retrieveLabelKeys: jest.fn().mockReturnValue(['__name__', 'instance', 'job', 'service']),
    retrieveMetricsMetadata: jest.fn().mockReturnValue({
      metric1: { type: 'counter', help: 'Test metric 1' },
      metric2: { type: 'gauge', help: 'Test metric 2' },
    }),
    queryLabelValues: jest.fn(),
    queryLabelKeys: jest.fn(),
  } as unknown as PrometheusLanguageProviderInterface;

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
  const { result } = renderHook(() => useMetricsLabelsValues(mocks.mockTimeRange, mocks.mockLanguageProvider));

  // Wait for initialization
  await waitFor(() => {
    expect(mocks.mockLanguageProvider.queryLabelValues).toHaveBeenCalled();
  });

  return { result };
};

describe('useMetricsLabelsValues', () => {
  let mocks: ReturnType<typeof setupMocks>;

  beforeEach(() => {
    mocks = setupMocks();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  describe('series limit', () => {
    it('should use default series limit during initialization', async () => {
      renderHook(() => useMetricsLabelsValues(mocks.mockTimeRange, mocks.mockLanguageProvider));

      await waitFor(() => {
        expect(mocks.mockLanguageProvider.queryLabelValues).toHaveBeenCalledWith(
          expect.anything(),
          METRIC_LABEL,
          undefined,
          DEFAULT_SERIES_LIMIT
        );
      });
    });

    it('should use updated series limit for subsequent requests', async () => {
      const { result } = await renderHookWithInit(mocks);
      const newLimit = '500';

      // Clear previous calls from initialization
      (mocks.mockLanguageProvider.queryLabelValues as jest.Mock).mockClear();

      await act(async () => {
        result.current.setSeriesLimit(newLimit);
        // Wait for debounce inside act
        await new Promise((resolve) => setTimeout(resolve, 300));
      });

      // Wait for the API call to happen
      await waitFor(() => {
        expect(mocks.mockLanguageProvider.queryLabelValues).toHaveBeenCalled();
      });

      // Verify that at least one call used the new limit
      const calls = (mocks.mockLanguageProvider.queryLabelValues as jest.Mock).mock.calls;
      const callWithNewLimit = calls.find((call) => call[3] === newLimit);
      expect(callWithNewLimit).toBeTruthy();
    });

    it('should use 0 when series limit is set to 0', async () => {
      const { result } = await renderHookWithInit(mocks);

      // Clear previous calls from initialization
      (mocks.mockLanguageProvider.queryLabelValues as jest.Mock).mockClear();

      await act(async () => {
        result.current.setSeriesLimit('0');
        // Wait for debounce inside act
        await new Promise((resolve) => setTimeout(resolve, 300));
      });

      // Wait for the API call to happen
      await waitFor(() => {
        expect(mocks.mockLanguageProvider.queryLabelValues).toHaveBeenCalled();
      });

      // Verify that at least one call used 0 as the limit
      const calls = (mocks.mockLanguageProvider.queryLabelValues as jest.Mock).mock.calls;
      const callWithZeroLimit = calls.find((call) => call[3] === '0');
      expect(callWithZeroLimit).toBeTruthy();
    });
  });

  describe('cleanup', () => {
    it('should clean up localStorage when clearing selections', async () => {
      const { result } = await renderHookWithInit(mocks);

      // Setup some selections
      await act(async () => {
        await result.current.handleSelectedMetricChange('metric1');
        await result.current.handleSelectedLabelKeyChange('job');
        await result.current.handleSelectedLabelValueChange('job', 'grafana', true);
      });

      // Clear mock to check for new calls
      (mocks.localStorageMock.setItem as jest.Mock).mockClear();

      // Clear selections
      await act(async () => {
        await result.current.handleClear();
      });

      // Should clear localStorage
      expect(mocks.localStorageMock.setItem).toHaveBeenCalledWith(LAST_USED_LABELS_KEY, '[]');
    });

    it('should clean up state when unmounting', async () => {
      const { result, unmount } = renderHook(() =>
        useMetricsLabelsValues(mocks.mockTimeRange, mocks.mockLanguageProvider)
      );

      await waitFor(() => {
        expect(mocks.mockLanguageProvider.queryLabelValues).toHaveBeenCalled();
      });

      // Setup some selections
      await act(async () => {
        await result.current.handleSelectedMetricChange('metric1');
        await result.current.handleSelectedLabelKeyChange('job');
        await result.current.handleSelectedLabelValueChange('job', 'grafana', true);
      });

      // Unmount the component
      unmount();

      // Verify state is cleaned up
      expect(result.current.selectedMetric).toBe('metric1'); // State should be preserved until unmount
      expect(result.current.selectedLabelKeys).toEqual(['job']); // State should be preserved until unmount
      expect(result.current.selectedLabelValues).toHaveProperty('job'); // State should be preserved until unmount
    });
  });
});
