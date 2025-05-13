import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ReactNode } from 'react';

import { TimeRange } from '@grafana/data';

import PromQlLanguageProvider from '../../language_provider';
import { getMockTimeRange } from '../../test/__mocks__/datasource';

import { MetricsBrowserProvider, useMetricsBrowser } from './MetricsBrowserContext';
import { LAST_USED_LABELS_KEY, METRIC_LABEL } from './types';

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
const mockTimeRange = getMockTimeRange();
const mockLanguageProvider = {
  metrics: ['metric1', 'metric2', 'metric3'],
  labelKeys: ['__name__', 'instance', 'job', 'service'],
  metricsMetadata: {
    metric1: { type: 'counter', help: 'Test metric 1' },
    metric2: { type: 'gauge', help: 'Test metric 2' },
  },
  fetchLabels: jest.fn(),
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

const renderWithProvider = (ui: ReactNode) => {
  return render(
    <MetricsBrowserProvider timeRange={mockTimeRange} languageProvider={mockLanguageProvider} onChange={mockOnChange}>
      {ui}
    </MetricsBrowserProvider>
  );
};

describe('MetricsBrowserContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();

    // Set up consistent mock implementation
    (mockLanguageProvider.fetchLabels as jest.Mock).mockResolvedValue(['__name__', 'instance', 'job', 'service']);

    // Default implementation for fetching metrics
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

    // Mock for fetching label keys for a specific metric
    (mockLanguageProvider.fetchSeriesLabelsMatch as jest.Mock).mockResolvedValue({
      __name__: ['metric1', 'metric2'],
      instance: ['instance1', 'instance2'],
      job: ['job1', 'job2'],
      service: ['service1', 'service2'],
    });

    // Mock for validation
    (mockLanguageProvider.fetchLabelsWithMatch as jest.Mock).mockResolvedValue({
      job: ['job1', 'job2'],
      instance: ['instance1', 'instance2'],
    });
  });

  it('should initialize with metrics from language provider', async () => {
    renderWithProvider(<TestComponent />);

    // Wait for API calls and state update
    await waitFor(
      () => {
        expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalledWith(
          expect.anything(),
          METRIC_LABEL,
          undefined,
          'MetricsBrowser_M',
          '40000'
        );
      },
      { timeout: 5000 }
    );

    // Then check UI update
    await waitFor(
      () => {
        expect(screen.getByTestId('metrics-count').textContent).toBe('3');
      },
      { timeout: 5000 }
    );
  });

  it('should load saved label keys from localStorage on init', async () => {
    // Setup localStorage with saved label keys
    localStorageMock.setItem(LAST_USED_LABELS_KEY, JSON.stringify(['job', 'instance']));

    renderWithProvider(<TestComponent />);

    // First wait for API calls
    await waitFor(
      () => {
        expect(mockLanguageProvider.fetchLabels).toHaveBeenCalled();
        expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
      },
      { timeout: 5000 }
    );

    // Then wait for state update
    await waitFor(
      () => {
        expect(screen.getByTestId('selected-label-keys').textContent).toBe('job,instance');
      },
      { timeout: 5000 }
    );
  });

  it('should select and deselect metrics on click', async () => {
    const user = userEvent.setup();
    renderWithProvider(<TestComponent />);

    // Wait for initialization to complete
    await waitFor(
      () => {
        expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
      },
      { timeout: 5000 }
    );

    // Initially no metric is selected
    expect(screen.getByTestId('selected-metric').textContent).toBe('');

    // Select a metric
    await user.click(screen.getByTestId('select-metric'));

    // Wait for selection to complete and API calls
    await waitFor(
      () => {
        expect(mockLanguageProvider.fetchSeriesLabelsMatch).toHaveBeenCalled();
      },
      { timeout: 5000 }
    );

    // Wait for state update
    await waitFor(
      () => {
        expect(screen.getByTestId('selected-metric').textContent).toBe('metric1');
      },
      { timeout: 5000 }
    );

    // Mock setup for deselection
    jest.clearAllMocks();

    // Click again to deselect
    await user.click(screen.getByTestId('select-metric'));

    // Wait for deselection to complete
    await waitFor(
      () => {
        expect(screen.getByTestId('selected-metric').textContent).toBe('');
      },
      { timeout: 5000 }
    );
  });

  it('should select and deselect label keys on click', async () => {
    const user = userEvent.setup();
    renderWithProvider(<TestComponent />);

    // Wait for initialization to complete
    await waitFor(
      () => {
        expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
      },
      { timeout: 5000 }
    );

    // Initially no label key is selected
    expect(screen.getByTestId('selected-label-keys').textContent).toBe('');

    // Select a label key
    await user.click(screen.getByTestId('select-label'));

    // Wait for selection and API calls
    await waitFor(
      () => {
        expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalledWith(
          expect.anything(),
          'job',
          undefined,
          'MetricsBrowser_LV_job',
          '40000'
        );
      },
      { timeout: 5000 }
    );

    // Wait for state update
    await waitFor(
      () => {
        expect(screen.getByTestId('selected-label-keys').textContent).toBe('job');
      },
      { timeout: 5000 }
    );

    // Reset mocks for deselection test
    jest.clearAllMocks();

    // Click again to deselect
    await user.click(screen.getByTestId('select-label'));

    // Wait for state update
    await waitFor(
      () => {
        expect(screen.getByTestId('selected-label-keys').textContent).toBe('');
      },
      { timeout: 5000 }
    );

    // Verify localStorage update
    expect(localStorageMock.setItem).toHaveBeenCalledWith(LAST_USED_LABELS_KEY, JSON.stringify([]));
  });

  it('should select and deselect label values on click', async () => {
    const user = userEvent.setup();
    renderWithProvider(<TestComponent />);

    // Wait for initialization
    await waitFor(
      () => {
        expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
      },
      { timeout: 5000 }
    );

    // First select the label key to enable label value selection
    await user.click(screen.getByTestId('select-label'));

    // Wait for label key selection to complete
    await waitFor(
      () => {
        expect(screen.getByTestId('selected-label-keys').textContent).toBe('job');
      },
      { timeout: 5000 }
    );

    jest.clearAllMocks();

    // Now select a label value
    await user.click(screen.getByTestId('select-label-value'));

    // Wait for API calls after value selection
    await waitFor(
      () => {
        expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
      },
      { timeout: 5000 }
    );

    // Wait for selector update in UI
    await waitFor(
      () => {
        expect(screen.getByTestId('selector').textContent).toBe('{job="grafana"}');
      },
      { timeout: 5000 }
    );
  });

  it('should fetch label values with the current selector', async () => {
    const user = userEvent.setup();
    renderWithProvider(<TestComponent />);

    // Wait for initialization to complete
    await waitFor(
      () => {
        expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
      },
      { timeout: 5000 }
    );

    // First select a metric to create a non-empty selector
    await user.click(screen.getByTestId('select-metric'));

    // Wait for metric selection to complete
    await waitFor(
      () => {
        expect(screen.getByTestId('selected-metric').textContent).toBe('metric1');
      },
      { timeout: 5000 }
    );

    jest.clearAllMocks();

    // Then select a label
    await user.click(screen.getByTestId('select-label'));

    // Wait for API call with the expected selector
    await waitFor(
      () => {
        // Should call fetchSeriesValuesWithMatch with the current selector
        expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalledWith(
          expect.anything(),
          'job',
          expect.stringContaining('metric1'),
          expect.any(String),
          '40000'
        );
      },
      { timeout: 5000 }
    );
  });

  it('should clear all selections when clear is clicked', async () => {
    const user = userEvent.setup();
    renderWithProvider(<TestComponent />);

    // Wait for initialization
    await waitFor(
      () => {
        expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
      },
      { timeout: 5000 }
    );

    // Set up some selections
    await user.click(screen.getByTestId('select-metric'));

    // Wait for metric selection
    await waitFor(
      () => {
        expect(screen.getByTestId('selected-metric').textContent).toBe('metric1');
      },
      { timeout: 5000 }
    );

    await user.click(screen.getByTestId('select-label'));

    // Wait for label selection
    await waitFor(
      () => {
        expect(screen.getByTestId('selected-label-keys').textContent).toBe('job');
      },
      { timeout: 5000 }
    );

    // Reset mocks before clear
    jest.clearAllMocks();

    // Clear selections
    await user.click(screen.getByTestId('clear'));

    // Wait for clear to trigger API calls
    await waitFor(
      () => {
        expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
      },
      { timeout: 5000 }
    );

    // Verify everything is cleared
    await waitFor(
      () => {
        expect(screen.getByTestId('selected-metric').textContent).toBe('');
        expect(screen.getByTestId('selected-label-keys').textContent).toBe('');
        expect(screen.getByTestId('selector').textContent).toBe('{}');
      },
      { timeout: 5000 }
    );
  });

  it('should validate selectors and show status', async () => {
    const user = userEvent.setup();
    renderWithProvider(<TestComponent />);

    // Wait for initialization
    await waitFor(
      () => {
        expect(mockLanguageProvider.fetchSeriesValuesWithMatch).toHaveBeenCalled();
      },
      { timeout: 5000 }
    );

    // Select a label to enable value selection
    await user.click(screen.getByTestId('select-label'));

    // Wait for label selection
    await waitFor(
      () => {
        expect(screen.getByTestId('selected-label-keys').textContent).toBe('job');
      },
      { timeout: 5000 }
    );

    // Select a value to get a valid selector
    await user.click(screen.getByTestId('select-label-value'));

    // Wait for the value selection
    await waitFor(
      () => {
        expect(screen.getByTestId('selector').textContent).toBe('{job="grafana"}');
      },
      { timeout: 5000 }
    );

    jest.clearAllMocks();

    // Trigger validation
    await user.click(screen.getByTestId('validate'));

    // Wait for validation API call
    await waitFor(
      () => {
        expect(mockLanguageProvider.fetchLabelsWithMatch).toHaveBeenCalledWith(expect.anything(), '{job="grafana"}');
      },
      { timeout: 5000 }
    );

    // Wait for validation status to update
    await waitFor(
      () => {
        expect(screen.getByTestId('validation-status').textContent).toContain('Selector is valid');
      },
      { timeout: 5000 }
    );
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
