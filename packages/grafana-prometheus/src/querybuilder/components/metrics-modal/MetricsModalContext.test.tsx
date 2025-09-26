import { act, render, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';

import { TimeRange } from '@grafana/data';

import { PrometheusLanguageProviderInterface } from '../../../language_provider';

import { DEFAULT_RESULTS_PER_PAGE, MetricsModalContextProvider, useMetricsModal } from './MetricsModalContext';
import { generateMetricData } from './helpers';

// Mock dependencies
jest.mock('./helpers', () => ({
  generateMetricData: jest.fn(),
}));

const mockGenerateMetricData = generateMetricData as jest.MockedFunction<typeof generateMetricData>;

// Mock language provider
const mockLanguageProvider: PrometheusLanguageProviderInterface = {
  queryMetricsMetadata: jest.fn(),
  queryLabelValues: jest.fn(),
  retrieveMetricsMetadata: jest.fn(),
} as unknown as PrometheusLanguageProviderInterface;

// Helper to create wrapper component
const createWrapper = (languageProvider = mockLanguageProvider) => {
  return ({ children }: { children: ReactNode }) => (
    <MetricsModalContextProvider languageProvider={languageProvider}>{children}</MetricsModalContextProvider>
  );
};

// Sample time range for tests
const defaultTimeRange: TimeRange = {
  from: 'now-1h' as unknown as TimeRange['from'],
  to: 'now' as unknown as TimeRange['to'],
  raw: {
    from: 'now-1h',
    to: 'now',
  },
};

describe('MetricsModalContext', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console.error to suppress React act() warnings
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Default mock implementations
    mockGenerateMetricData.mockImplementation((metric) => ({
      value: metric,
      type: 'counter',
      description: 'Test metric',
    }));
    (mockLanguageProvider.queryMetricsMetadata as jest.Mock).mockResolvedValue({
      test_metric: { type: 'counter', help: 'Test metric' },
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('useMetricsModal hook', () => {
    it('should throw error when used outside provider', () => {
      expect(() => {
        renderHook(() => useMetricsModal());
      }).toThrow('useMetricsModal must be used within a MetricsModalContextProvider');
    });

    it('should provide context value when used within provider', () => {
      const { result } = renderHook(() => useMetricsModal(), {
        wrapper: createWrapper(),
      });

      expect(result.current).toBeDefined();
      expect(result.current.isLoading).toBe(true); // Initially loading
      expect(result.current.filteredMetricsData).toEqual([]);
      expect(result.current.pagination).toEqual({
        pageNum: 1,
        totalPageNum: 1,
        resultsPerPage: DEFAULT_RESULTS_PER_PAGE,
      });
      expect(result.current.selectedTypes).toEqual([]);
      expect(result.current.searchedText).toBe('');
    });
  });

  describe('State management', () => {
    it('should update pagination', () => {
      const { result } = renderHook(() => useMetricsModal(), {
        wrapper: createWrapper(),
      });

      const expectedPagination = { pageNum: 1, resultsPerPage: 50, totalPageNum: 1 };

      act(() => {
        result.current.setPagination({ pageNum: 2, resultsPerPage: 50, totalPageNum: 3 });
      });

      expect(result.current.pagination).toEqual(expectedPagination);
    });

    it('should update selected types', () => {
      const { result } = renderHook(() => useMetricsModal(), {
        wrapper: createWrapper(),
      });

      const newTypes = [{ value: 'counter', label: 'Counter' }];

      act(() => {
        result.current.setSelectedTypes(newTypes);
      });

      expect(result.current.selectedTypes).toEqual(newTypes);
    });

    it('should update searched text', () => {
      const { result } = renderHook(() => useMetricsModal(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSearchedText('test_metric');
      });

      expect(result.current.searchedText).toBe('test_metric');
    });

    it('should update loading state', () => {
      const { result } = renderHook(() => useMetricsModal(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setIsLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Metadata fetching', () => {
    it('should load initial metadata on mount', async () => {
      const mockMetadata = {
        cpu_usage: { type: 'gauge', help: 'CPU usage percentage' },
        memory_usage: { type: 'gauge', help: 'Memory usage bytes' },
      };

      (mockLanguageProvider.queryMetricsMetadata as jest.Mock).mockResolvedValue(mockMetadata);

      const { result } = renderHook(() => useMetricsModal(), {
        wrapper: createWrapper(),
      });

      // Wait for metadata to load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockLanguageProvider.queryMetricsMetadata).toHaveBeenCalledWith(1000);
      expect(mockGenerateMetricData).toHaveBeenCalledWith('cpu_usage', mockLanguageProvider);
      expect(mockGenerateMetricData).toHaveBeenCalledWith('memory_usage', mockLanguageProvider);
      expect(result.current.filteredMetricsData).toHaveLength(2);
    });

    it('should handle empty metadata response', async () => {
      (mockLanguageProvider.queryMetricsMetadata as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useMetricsModal(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.filteredMetricsData).toEqual([]);
    });

    it('should handle metadata fetch error', async () => {
      (mockLanguageProvider.queryMetricsMetadata as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useMetricsModal(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.filteredMetricsData).toEqual([]);
    });
  });

  describe('Backend search', () => {
    it('should perform backend search with results', async () => {
      (mockLanguageProvider.queryLabelValues as jest.Mock).mockResolvedValue(['test_metric', 'other_metric']);

      const { result } = renderHook(() => useMetricsModal(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.debouncedBackendSearch(defaultTimeRange, 'test');
      });

      expect(mockLanguageProvider.queryLabelValues).toHaveBeenCalledWith(
        defaultTimeRange,
        '__name__',
        '{__name__=~"(?i).*test.*"}'
      );
      expect(result.current.filteredMetricsData).toHaveLength(1);
    });

    it('should handle backend search error', async () => {
      (mockLanguageProvider.queryLabelValues as jest.Mock).mockRejectedValue(new Error('Search failed'));

      const { result } = renderHook(() => useMetricsModal(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.debouncedBackendSearch(defaultTimeRange, 'test');
      });

      expect(result.current.filteredMetricsData).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Filtering logic', () => {
    it('should return all metrics when no types are selected', async () => {
      mockGenerateMetricData.mockImplementation((metric) => ({
        value: metric,
        type: 'counter',
        description: 'Test metric',
      }));

      (mockLanguageProvider.queryMetricsMetadata as jest.Mock).mockResolvedValue({
        test_metric: { type: 'counter', help: 'Test metric' },
      });

      const { result } = renderHook(() => useMetricsModal(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.filteredMetricsData).toHaveLength(1);
      expect(result.current.selectedTypes).toEqual([]);
    });

    it('should filter metrics by selected type', async () => {
      mockGenerateMetricData.mockImplementation((metric) => ({
        value: metric,
        type: metric === 'counter_metric' ? 'counter' : 'gauge',
        description: 'Test metric',
      }));

      (mockLanguageProvider.queryMetricsMetadata as jest.Mock).mockResolvedValue({
        counter_metric: { type: 'counter', help: 'Counter metric' },
        gauge_metric: { type: 'gauge', help: 'Gauge metric' },
      });

      const { result } = renderHook(() => useMetricsModal(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setSelectedTypes([{ value: 'counter', label: 'Counter' }]);
      });

      expect(result.current.filteredMetricsData).toHaveLength(1);
      expect(result.current.filteredMetricsData[0].value).toBe('counter_metric');
    });

    it('should handle metrics without type when "no type" is selected', async () => {
      mockGenerateMetricData.mockImplementation((metric) => ({
        value: metric,
        type: metric === 'no_type_metric' ? undefined : 'counter',
        description: 'Test metric',
      }));

      (mockLanguageProvider.queryMetricsMetadata as jest.Mock).mockResolvedValue({
        counter_metric: { type: 'counter', help: 'Counter metric' },
        no_type_metric: { help: 'Metric without type' },
      });

      const { result } = renderHook(() => useMetricsModal(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setSelectedTypes([{ value: 'no type', label: 'No Type' }]);
      });

      expect(result.current.filteredMetricsData).toHaveLength(1);
      expect(result.current.filteredMetricsData[0].value).toBe('no_type_metric');
    });
  });

  describe('Component integration', () => {
    it('should render provider without errors', () => {
      const TestComponent = () => {
        return <div data-testid="test">frontend</div>;
      };

      const { getByTestId } = render(
        <MetricsModalContextProvider languageProvider={mockLanguageProvider}>
          <TestComponent />
        </MetricsModalContextProvider>
      );

      expect(getByTestId('test')).toHaveTextContent('frontend');
    });
  });
});
