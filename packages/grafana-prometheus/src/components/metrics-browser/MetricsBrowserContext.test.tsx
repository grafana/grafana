import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ReactNode } from 'react';

import { TimeRange } from '@grafana/data';

import { DEFAULT_SERIES_LIMIT, LAST_USED_LABELS_KEY, METRIC_LABEL } from '../../constants';
import { PrometheusDatasource } from '../../datasource';
import { PrometheusLanguageProviderInterface } from '../../language_provider';
import { getMockTimeRange } from '../../test/mocks/datasource';

import { MetricsBrowserProvider, useMetricsBrowser } from './MetricsBrowserContext';

const setupLocalStorageMock = () => {
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
};

const localStorageMock = setupLocalStorageMock();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

/**
 * Setup consistent mock response data for the language provider
 */
const setupLanguageProviderMock = () => {
  const mockTimeRange = getMockTimeRange();
  const mockLanguageProvider = {
    retrieveMetrics: () => ['metric1', 'metric2', 'metric3'],
    retrieveLabelKeys: () => ['__name__', 'instance', 'job', 'service'],
    retrieveMetricsMetadata: () => ({
      metric1: { type: 'counter', help: 'Test metric 1' },
      metric2: { type: 'gauge', help: 'Test metric 2' },
    }),
    queryLabelKeys: jest.fn().mockResolvedValue(['__name__', 'instance', 'job', 'service']),
    queryLabelValues: jest.fn().mockImplementation((_timeRange: TimeRange, label: string) => {
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
    }),
  } as unknown as PrometheusLanguageProviderInterface;

  mockLanguageProvider.datasource = { seriesLimit: DEFAULT_SERIES_LIMIT } as unknown as PrometheusDatasource;

  return { mockTimeRange, mockLanguageProvider };
};

/**
 * Test component that renders context values and provides interaction buttons
 */
const TestComponent = () => {
  const {
    metrics,
    labelKeys,
    selectedMetric,
    selectedLabelKeys,
    onMetricClick,
    onLabelKeyClick,
    onLabelValueClick,
    getSelector,
    onClearClick,
    validationStatus,
    onValidationClick,
  } = useMetricsBrowser();

  return (
    <div>
      <div data-testid="metrics-count">{metrics.length}</div>
      <div data-testid="labels-count">{labelKeys.length}</div>
      <div data-testid="selected-metric">{selectedMetric}</div>
      <div data-testid="selected-label-keys">{selectedLabelKeys.join(',')}</div>
      <div data-testid="selector">{getSelector()}</div>
      <div data-testid="validation-status">{validationStatus}</div>

      <button data-testid="select-metric" onClick={() => onMetricClick('metric1')}>
        Select Metric
      </button>
      <button data-testid="select-label" onClick={() => onLabelKeyClick('job')}>
        Select Label
      </button>
      <button data-testid="select-label-value" onClick={() => onLabelValueClick('job', 'grafana', true)}>
        Select Label Value
      </button>
      <button data-testid="clear" onClick={onClearClick}>
        Clear
      </button>
      <button data-testid="validate" onClick={onValidationClick}>
        Validate
      </button>
    </div>
  );
};

/**
 * Setup function for tests that returns mocks and render utilities
 */
const setupTest = () => {
  const mockOnChange = jest.fn();
  const { mockTimeRange, mockLanguageProvider } = setupLanguageProviderMock();

  const renderWithProvider = (ui: ReactNode) => {
    return render(
      <MetricsBrowserProvider timeRange={mockTimeRange} languageProvider={mockLanguageProvider} onChange={mockOnChange}>
        {ui}
      </MetricsBrowserProvider>
    );
  };

  return {
    mockTimeRange,
    mockLanguageProvider,
    mockOnChange,
    renderWithProvider,
  };
};

describe('MetricsBrowserContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  describe('basic functionality', () => {
    it('should initialize and display metrics', async () => {
      const { renderWithProvider } = setupTest();
      renderWithProvider(<TestComponent />);

      // Verify metrics are displayed in the UI
      await waitFor(() => {
        expect(screen.getByTestId('metrics-count').textContent).toBe('3');
      });
    });

    it('should restore selected labels from storage on initialization', async () => {
      // Setup localStorage with saved preference
      localStorageMock.setItem(LAST_USED_LABELS_KEY, JSON.stringify(['job', 'instance']));

      const { renderWithProvider } = setupTest();
      renderWithProvider(<TestComponent />);

      // Verify the saved labels are loaded and displayed
      await waitFor(() => {
        expect(screen.getByTestId('selected-label-keys').textContent).toBe('job,instance');
      });
    });
  });

  describe('user interactions', () => {
    it('should select and deselect metrics', async () => {
      const user = userEvent.setup();
      const { renderWithProvider } = setupTest();
      renderWithProvider(<TestComponent />);

      // Wait for component to be ready
      await waitFor(() => {
        expect(screen.getByTestId('metrics-count').textContent).toBe('3');
      });

      // Initially no metric is selected
      expect(screen.getByTestId('selected-metric').textContent).toBe('');

      // Select a metric
      await user.click(screen.getByTestId('select-metric'));

      // Verify selection in UI
      await waitFor(() => {
        expect(screen.getByTestId('selected-metric').textContent).toBe('metric1');
      });

      // Deselect by clicking the same metric
      await user.click(screen.getByTestId('select-metric'));

      // Verify the deselection in UI
      await waitFor(() => {
        expect(screen.getByTestId('selected-metric').textContent).toBe('');
      });
    });

    it('should select and deselect label keys with persistence', async () => {
      const user = userEvent.setup();
      const { renderWithProvider } = setupTest();
      renderWithProvider(<TestComponent />);

      // Wait for component to be ready
      await waitFor(() => {
        expect(screen.getByTestId('metrics-count').textContent).toBe('3');
      });

      // Initially no label key is selected
      expect(screen.getByTestId('selected-label-keys').textContent).toBe('');

      // Select a label key
      await user.click(screen.getByTestId('select-label'));

      // Verify UI update
      await waitFor(() => {
        expect(screen.getByTestId('selected-label-keys').textContent).toBe('job');
      });

      // Deselect by clicking again
      await user.click(screen.getByTestId('select-label'));

      // Verify UI update
      await waitFor(() => {
        expect(screen.getByTestId('selected-label-keys').textContent).toBe('');
      });

      // Check localStorage was updated (not implementation but outcome)
      const mockCalls = localStorageMock.setItem.mock.calls;
      // Make sure we have calls to setItem
      expect(mockCalls.length).toBeGreaterThan(0);
      // Get the last call's arguments
      const lastCall = mockCalls[mockCalls.length - 1];
      expect(lastCall[0]).toBe(LAST_USED_LABELS_KEY);
      expect(JSON.parse(lastCall[1])).toEqual([]);
    });

    it('should build a selector when selecting label values', async () => {
      const user = userEvent.setup();
      const { renderWithProvider } = setupTest();
      renderWithProvider(<TestComponent />);

      // Wait for component to be ready
      await waitFor(() => {
        expect(screen.getByTestId('metrics-count').textContent).toBe('3');
      });

      // First select a label key
      await user.click(screen.getByTestId('select-label'));
      await waitFor(() => {
        expect(screen.getByTestId('selected-label-keys').textContent).toBe('job');
      });

      // Select a label value
      await user.click(screen.getByTestId('select-label-value'));

      // Verify the selector is updated
      await waitFor(() => {
        expect(screen.getByTestId('selector').textContent).toBe('{job="grafana"}');
      });
    });

    it('should use metric in selector when both metric and labels are selected', async () => {
      const user = userEvent.setup();
      const { renderWithProvider } = setupTest();
      renderWithProvider(<TestComponent />);

      // Wait for component to be ready
      await waitFor(() => {
        expect(screen.getByTestId('metrics-count').textContent).toBe('3');
      });

      // Select a metric first
      await user.click(screen.getByTestId('select-metric'));
      await waitFor(() => {
        expect(screen.getByTestId('selected-metric').textContent).toBe('metric1');
      });

      // Then select a label
      await user.click(screen.getByTestId('select-label'));
      await waitFor(() => {
        expect(screen.getByTestId('selected-label-keys').textContent).toBe('job');
      });

      // Then select a label value
      await user.click(screen.getByTestId('select-label-value'));

      // Verify the selector includes both metric and label
      await waitFor(() => {
        const selector = screen.getByTestId('selector').textContent;
        expect(selector).toContain('metric1');
        expect(selector).toContain('job="grafana"');
      });
    });
  });

  describe('selector operations', () => {
    it('should clear all selections', async () => {
      const user = userEvent.setup();
      const { renderWithProvider, mockLanguageProvider } = setupTest();
      renderWithProvider(<TestComponent />);

      // Wait for initial data load
      await waitFor(() => {
        expect(screen.getByTestId('metrics-count').textContent).toBe('3');
      });

      // Step 1: Select a metric
      await user.click(screen.getByTestId('select-metric'));
      await waitFor(() => {
        expect(mockLanguageProvider.queryLabelKeys).toHaveBeenCalled();
        expect(screen.getByTestId('selected-metric').textContent).toBe('metric1');
      });

      // Step 2: Select a label
      await user.click(screen.getByTestId('select-label'));
      await waitFor(() => {
        expect(mockLanguageProvider.queryLabelValues).toHaveBeenCalledWith(
          expect.anything(),
          'job',
          expect.anything(),
          expect.anything()
        );
        expect(screen.getByTestId('selected-label-keys').textContent).toBe('job');
      });

      // Step 3: Select a label value
      await user.click(screen.getByTestId('select-label-value'));
      await waitFor(() => {
        expect(screen.getByTestId('selector').textContent).toContain('job="grafana"');
      });

      // Step 4: Clear all selections
      await user.click(screen.getByTestId('clear'));

      // Verify everything is cleared
      await waitFor(() => {
        // Check that all selections are cleared
        expect(screen.getByTestId('selected-metric').textContent).toBe('');
        expect(screen.getByTestId('selected-label-keys').textContent).toBe('');
        expect(screen.getByTestId('selector').textContent).toBe('{}');

        // Verify localStorage was cleared
        const mockCalls = localStorageMock.setItem.mock.calls;
        const lastCall = mockCalls[mockCalls.length - 1];
        expect(lastCall[0]).toBe(LAST_USED_LABELS_KEY);
        expect(JSON.parse(lastCall[1])).toEqual([]);
      });
    });

    it('should validate selectors', async () => {
      const user = userEvent.setup();
      const { renderWithProvider } = setupTest();
      renderWithProvider(<TestComponent />);

      // Wait for component to be ready
      await waitFor(() => {
        expect(screen.getByTestId('metrics-count').textContent).toBe('3');
      });

      // Create a valid selector
      await user.click(screen.getByTestId('select-label'));
      await user.click(screen.getByTestId('select-label-value'));

      // Verify the selector is created
      await waitFor(() => {
        expect(screen.getByTestId('selector').textContent).toBe('{job="grafana"}');
      });

      // Trigger validation
      await user.click(screen.getByTestId('validate'));

      // Verify validation result
      await waitFor(() => {
        expect(screen.getByTestId('validation-status').textContent).toContain('Selector is valid');
      });
    });
  });

  describe('complete user workflows', () => {
    it('should handle a full selection -> validation -> clear workflow', async () => {
      const user = userEvent.setup();
      const { renderWithProvider } = setupTest();
      renderWithProvider(<TestComponent />);

      // Wait for component to be ready
      await waitFor(() => {
        expect(screen.getByTestId('metrics-count').textContent).toBe('3');
      });

      // STEP 1: Select a metric
      await user.click(screen.getByTestId('select-metric'));
      await waitFor(() => {
        expect(screen.getByTestId('selected-metric').textContent).toBe('metric1');
      });

      // STEP 2: Add a label
      await user.click(screen.getByTestId('select-label'));
      await waitFor(() => {
        expect(screen.getByTestId('selected-label-keys').textContent).toBe('job');
      });

      // STEP 3: Select a value
      await user.click(screen.getByTestId('select-label-value'));
      await waitFor(() => {
        expect(screen.getByTestId('selector').textContent).toContain('job="grafana"');
      });

      // STEP 4: Validate
      await user.click(screen.getByTestId('validate'));
      await waitFor(() => {
        expect(screen.getByTestId('validation-status').textContent).toContain('Selector is valid');
      });

      // STEP 5: Clear
      await user.click(screen.getByTestId('clear'));
      await waitFor(() => {
        expect(screen.getByTestId('selected-metric').textContent).toBe('');
        expect(screen.getByTestId('selected-label-keys').textContent).toBe('');
        expect(screen.getByTestId('selector').textContent).toBe('{}');
      });
    });
  });

  describe('error handling', () => {
    it('should throw error when hook is used outside provider', () => {
      // Suppress console.error for this test
      jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useMetricsBrowser());
      }).toThrow('useMetricsBrowser must be used within a MetricsBrowserProvider');

      // Restore console.error
      (console.error as jest.Mock).mockRestore();
    });
  });
});
