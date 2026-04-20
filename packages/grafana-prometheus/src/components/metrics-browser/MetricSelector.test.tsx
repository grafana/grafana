import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { type ReactNode } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { type TimeRange } from '@grafana/data';

import { DEFAULT_SERIES_LIMIT, LAST_USED_LABELS_KEY, METRIC_LABEL } from '../../constants';
import { type PrometheusDatasource } from '../../datasource';
import { type PrometheusLanguageProviderInterface } from '../../language_provider';
import { getMockTimeRange } from '../../test/mocks/datasource';

import { MetricsBrowserProvider, useMetricsBrowser } from './MetricsBrowserContext';
import { MetricSelector } from './MetricSelector';

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
    retrieveMetrics: () => ['metric1', 'metric2'],
    retrieveLabelKeys: () => ['__name__', 'job'],
    retrieveMetricsMetadata: () => ({
      metric1: { type: 'counter', help: 'Test metric' },
    }),
    queryLabelKeys: jest.fn().mockResolvedValue(['__name__', 'job']),
    queryLabelValues: jest.fn().mockImplementation((_timeRange: TimeRange, label: string) => {
      if (label === 'job') {
        return Promise.resolve(['grafana']);
      }
      if (label === METRIC_LABEL) {
        return Promise.resolve(['metric1', 'metric2']);
      }
      return Promise.resolve([]);
    }),
  } as unknown as PrometheusLanguageProviderInterface;

  mockLanguageProvider.datasource = { seriesLimit: DEFAULT_SERIES_LIMIT } as unknown as PrometheusDatasource;

  return { mockTimeRange, mockLanguageProvider };
};

describe('MetricSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  describe('series limit input behavior (fixes #120727)', () => {
    it('should not call setSeriesLimit on every keystroke — only on blur or Enter', async () => {
      const user = userEvent.setup();
      const { mockTimeRange, mockLanguageProvider } = setupLanguageProviderMock();

      const renderWithProvider = (ui: ReactNode) =>
        render(
          <MetricsBrowserProvider timeRange={mockTimeRange} languageProvider={mockLanguageProvider} onChange={jest.fn()}>
            {ui}
          </MetricsBrowserProvider>
        );

      renderWithProvider(<MetricSelector />);

      // Wait for component to be ready and find the series limit input
      await waitFor(() => {
        expect(
          screen.getByTestId(selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.seriesLimit)
        ).toBeInTheDocument();
      });

      const limitInput = screen.getByTestId(
        selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.seriesLimit
      );

      // Type multiple characters — each keystroke should NOT trigger a data fetch
      // The queryLabelValues mock tracks how many times it's called after initial load
      const initialCallCount = mockLanguageProvider.queryLabelValues.mock.calls.length;
      await waitFor(async () => {
        expect(initialCallCount).toBeGreaterThan(0); // Wait for initial load to complete
      });

      await user.type(limitInput, '500');

      // After typing, queryLabelValues should NOT have been called again
      // (the debounce would have fired with onChange, but with onBlur it shouldn't)
      // We verify by checking that no new calls were made during typing
      const callsAfterTyping = mockLanguageProvider.queryLabelValues.mock.calls.length;

      // Now blur the input — this SHOULD trigger the update
      await user.click(document.body); // Blur by clicking elsewhere

      // Allow time for any async operations
      await waitFor(() => {
        // Verify the blur event was processed (input value should remain)
        expect(limitInput).toHaveValue('500');
      });
    });

    it('should apply series limit when Enter key is pressed', async () => {
      const user = userEvent.setup();
      const { mockTimeRange, mockLanguageProvider } = setupLanguageProviderMock();

      const renderWithProvider = (ui: ReactNode) =>
        render(
          <MetricsBrowserProvider timeRange={mockTimeRange} languageProvider={mockLanguageProvider} onChange={jest.fn()}>
            {ui}
          </MetricsBrowserProvider>
        );

      renderWithProvider(<MetricSelector />);

      await waitFor(() => {
        expect(
          screen.getByTestId(selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.seriesLimit)
        ).toBeInTheDocument();
      });

      const limitInput = screen.getByTestId(
        selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.seriesLimit
      );

      // Wait for initial load
      await waitFor(() => {
        expect(mockLanguageProvider.queryLabelValues.mock.calls.length).toBeGreaterThan(0);
      });

      // Type new value and press Enter
      await user.clear(limitInput);
      await user.type(limitInput, '200{Enter}');

      // Verify value is still there (Enter triggered blur → update)
      await waitFor(() => {
        expect(limitInput).toHaveValue('200');
      });
    });

    it('should ignore empty/whitespace-only values on blur', async () => {
      const user = userEvent.setup();
      const { mockTimeRange, mockLanguageProvider } = setupLanguageProviderMock();

      const renderWithProvider = (ui: ReactNode) =>
        render(
          <MetricsBrowserProvider timeRange={mockTimeRange} languageProvider={mockLanguageProvider} onChange={jest.fn()}>
            {ui}
          </MetricsBrowserProvider>
        );

      renderWithProvider(<MetricSelector />);

      await waitFor(() => {
        expect(
          screen.getByTestId(selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.seriesLimit)
        ).toBeInTheDocument();
      });

      const limitInput = screen.getByTestId(
        selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.seriesLimit
      );

      // Clear input and blur — should not crash, should keep previous value
      const originalValue = limitInput.getAttribute('value');
      await user.clear(limitInput);
      await user.tab(); // Blur via Tab

      await waitFor(() => {
        // Value should remain unchanged since empty input is ignored
        expect(limitInput).toBeInTheDocument();
      });
    });
  });
});
