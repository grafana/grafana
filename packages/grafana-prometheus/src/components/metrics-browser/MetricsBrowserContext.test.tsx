import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ReactNode } from 'react';

import PromQlLanguageProvider from '../../language_provider';

import { MetricsBrowserProvider, useMetricsBrowser } from './MetricsBrowserContext';
import { METRIC_LABEL } from './types';

// Mock the local storage
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
  fetchSeriesLabelsMatch: jest.fn(),
  fetchSeriesValuesWithMatch: jest.fn(),
  fetchLabelsWithMatch: jest.fn(),
} as unknown as PromQlLanguageProvider;

const mockOnChange = jest.fn();

// Test component to render the context
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
      <button data-testid="select-label-value" onClick={() => onLabelValueClick('job', 'grafana')}>
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

const renderWithProvider = (ui: ReactNode) => {
  return render(
    <MetricsBrowserProvider languageProvider={mockLanguageProvider} onChange={mockOnChange}>
      {ui}
    </MetricsBrowserProvider>
  );
};

describe('MetricsBrowserContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();

    // Default implementation of mocked functions
    (mockLanguageProvider.fetchSeriesLabelsMatch as jest.Mock).mockResolvedValue({
      instance: ['instance1', 'instance2'],
      job: ['job1', 'job2'],
    });

    (mockLanguageProvider.fetchSeriesValuesWithMatch as jest.Mock).mockImplementation(
      (label: string, selector: string | undefined) => {
        if (label === 'job') {
          return Promise.resolve(['grafana', 'prometheus']);
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

    (mockLanguageProvider.fetchLabelsWithMatch as jest.Mock).mockResolvedValue({
      job: ['job1', 'job2'],
      instance: ['instance1', 'instance2'],
    });
  });

  it('should initialize with metrics from language provider', async () => {
    renderWithProvider(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('metrics-count').textContent).toBe('3');
    });
  });

  it('should filter out __name__ from label keys', async () => {
    renderWithProvider(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('labels-count').textContent).toBe('3'); // 4 total - __name__
    });
  });

  it('should load saved label keys from localStorage on init', async () => {
    // Setup localStorage with saved label keys
    localStorageMock.setItem('grafana.datasources.prometheus.browser.labels', JSON.stringify(['job', 'instance']));

    renderWithProvider(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('selected-label-keys').textContent).toBe('job,instance');
    });
  });

  it('should select and deselect metrics on click', async () => {
    const user = userEvent.setup();
    renderWithProvider(<TestComponent />);

    // Initially no metric is selected
    expect(screen.getByTestId('selected-metric').textContent).toBe('');

    // Select a metric
    await user.click(screen.getByTestId('select-metric'));
    expect(screen.getByTestId('selected-metric').textContent).toBe('metric1');

    // Click again to deselect
    await user.click(screen.getByTestId('select-metric'));
    expect(screen.getByTestId('selected-metric').textContent).toBe('');
  });

  it('should select and deselect label keys on click', async () => {
    const user = userEvent.setup();
    renderWithProvider(<TestComponent />);

    // Initially no label key is selected
    expect(screen.getByTestId('selected-label-keys').textContent).toBe('');

    // Select a label key
    await user.click(screen.getByTestId('select-label'));
    expect(screen.getByTestId('selected-label-keys').textContent).toBe('job');

    // Click again to deselect
    await user.click(screen.getByTestId('select-label'));
    expect(screen.getByTestId('selected-label-keys').textContent).toBe('');

    // Verify localStorage update
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'grafana.datasources.prometheus.browser.labels',
      JSON.stringify([])
    );
  });

  it('should select and deselect label values on click', async () => {
    const user = userEvent.setup();
    renderWithProvider(<TestComponent />);

    // Select a label value
    await user.click(screen.getByTestId('select-label-value'));

    // Should update the selector
    await waitFor(() => {
      expect(screen.getByTestId('selector').textContent).toBe('{job="grafana"}');
    });
  });

  it('should fetch label values with the current selector', async () => {
    const user = userEvent.setup();
    renderWithProvider(<TestComponent />);

    // First select a metric to create a non-empty selector
    await user.click(screen.getByTestId('select-metric'));

    // Then select a label
    await user.click(screen.getByTestId('select-label'));

    await waitFor(() => {
      // Should call fetchSeriesValuesWithMatch with the current selector
      expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalledWith('job', 'metric1{}');
    });
  });

  it('should pass undefined instead of empty selector when fetching label values', async () => {
    const user = userEvent.setup();
    renderWithProvider(<TestComponent />);

    // Only select a label key (no metric or label values)
    await user.click(screen.getByTestId('select-label'));

    await waitFor(() => {
      // Should call fetchSeriesValuesWithMatch with undefined instead of '{}'
      expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalledWith('job', undefined);
    });
  });

  it('should fetch new labels when a metric is selected', async () => {
    const user = userEvent.setup();
    renderWithProvider(<TestComponent />);

    await user.click(screen.getByTestId('select-metric'));

    await waitFor(() => {
      expect(mockLanguageProvider.fetchSeriesLabelsMatch).toHaveBeenCalledWith('metric1{}');
    });
  });

  it('should clear all selections when clear is clicked', async () => {
    const user = userEvent.setup();
    renderWithProvider(<TestComponent />);

    // Set up some selections
    await user.click(screen.getByTestId('select-metric'));
    await user.click(screen.getByTestId('select-label'));
    await user.click(screen.getByTestId('select-label-value'));

    // Verify selections are made
    expect(screen.getByTestId('selected-metric').textContent).toBe('metric1');
    expect(screen.getByTestId('selected-label-keys').textContent).toBe('job');

    // Clear selections
    await user.click(screen.getByTestId('clear'));

    // Verify everything is cleared
    expect(screen.getByTestId('selected-metric').textContent).toBe('');
    expect(screen.getByTestId('selected-label-keys').textContent).toBe('');
    expect(screen.getByTestId('selector').textContent).toBe('{}');
  });

  it('should validate selectors and show status', async () => {
    const user = userEvent.setup();
    renderWithProvider(<TestComponent />);

    // Make some selections to get a valid selector
    await user.click(screen.getByTestId('select-label'));
    await user.click(screen.getByTestId('select-label-value'));

    // Trigger validation
    await user.click(screen.getByTestId('validate'));

    await waitFor(() => {
      expect(mockLanguageProvider.fetchLabelsWithMatch).toHaveBeenCalledWith('{job="grafana"}');
      expect(screen.getByTestId('validation-status').textContent).toContain('Selector is valid');
    });
  });

  it('should handle validation errors gracefully', async () => {
    const user = userEvent.setup();
    (mockLanguageProvider.fetchLabelsWithMatch as jest.Mock).mockRejectedValueOnce(new Error('Validation error'));

    renderWithProvider(<TestComponent />);

    // Trigger validation
    await user.click(screen.getByTestId('validate'));

    await waitFor(() => {
      expect(screen.getByTestId('validation-status').textContent).toBe('');
    });
  });

  it('should fetch metrics when label values change', async () => {
    const user = userEvent.setup();
    renderWithProvider(<TestComponent />);

    // Add a label value selection to trigger the metrics fetch
    await user.click(screen.getByTestId('select-label-value'));

    await waitFor(() => {
      expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalledWith(METRIC_LABEL, '{job="grafana"}');
    });
  });

  it('should handle errors when fetching metrics', async () => {
    (mockLanguageProvider.fetchSeriesValuesWithMatch as jest.Mock).mockRejectedValueOnce(new Error('Fetch error'));

    const user = userEvent.setup();
    renderWithProvider(<TestComponent />);

    // Trigger metric fetch with an error
    await user.click(screen.getByTestId('select-label-value'));

    // Error should be handled gracefully
    await waitFor(() => {
      expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
    });
  });

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
