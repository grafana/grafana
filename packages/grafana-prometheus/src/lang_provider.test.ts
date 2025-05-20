import { getDefaultTimeRange, TimeRange } from '@grafana/data';

import { PrometheusDatasource } from './datasource';
import {
  buildCacheHeaders,
  getDefaultCacheHeaders,
  isCancelledError,
  populateMatchParamsFromQueries,
  PrometheusLanguageProvider,
  removeQuotesIfExist,
} from './lang_provider';
import * as languageUtils from './language_utils';
import { PrometheusCacheLevel, PromQuery } from './types';

// Mock the dependencies
jest.mock('./querybuilder/parsing', () => ({
  buildVisualQueryFromString: jest.fn((expr) => ({
    query: {
      metric: expr,
      binaryQueries: expr.includes('binary') ? [{ query: { metric: `binary_${expr}` } }] : undefined,
    },
  })),
}));

// Mock language_utils
jest.mock('./language_utils', () => ({
  processHistogramMetrics: jest.fn((metrics: string[]) => metrics.filter((m: string) => m.includes('histogram'))),
  getRangeSnapInterval: jest.fn(() => ({ start: 'start', end: 'end' })),
  getClientCacheDurationInMinutes: jest.fn(() => 1),
  fixSummariesMetadata: jest.fn((data) => data),
  processSeries: jest.fn(() => ({ metrics: ['metric1', 'metric2'], labelKeys: ['label1', 'label2'] })),
}));

// Mock utf8_support
jest.mock('./utf8_support', () => ({
  isValidLegacyName: jest.fn((name) => name !== 'utf8metric'),
  escapeForUtf8Support: jest.fn((name) => name),
}));

describe('PrometheusLanguageProvider', () => {
  let datasource: PrometheusDatasource;
  let provider: PrometheusLanguageProvider;
  let timeRange: TimeRange;

  beforeEach(() => {
    datasource = {
      metadataRequest: jest.fn().mockResolvedValue({ data: { data: [] } }),
      lookupsDisabled: false,
      hasLabelsMatchAPISupport: jest.fn().mockReturnValue(true),
      getDaysToCacheMetadata: jest.fn().mockReturnValue(1),
      cacheLevel: PrometheusCacheLevel.Low,
      getAdjustedInterval: jest.fn().mockReturnValue({ start: '1', end: '2' }),
      interpolateString: jest.fn((s) => s),
      httpMethod: 'GET',
      getTimeRangeParams: jest.fn().mockReturnValue({ start: 'start', end: 'end' }),
    } as unknown as PrometheusDatasource;

    provider = new PrometheusLanguageProvider(datasource);
    timeRange = getDefaultTimeRange();
  });

  describe('start', () => {
    it('should return empty array if lookups are disabled', async () => {
      datasource.lookupsDisabled = true;
      const result = await provider.start();
      expect(result).toEqual([]);
    });

    it('should fetch metrics, metadata and label keys if labels match API is supported', async () => {
      const mockMetrics = ['metric1', 'metric2', 'histogram_metric_bucket'];

      // Mock the provider methods
      jest.spyOn(provider, 'fetchLabelValues').mockResolvedValue(mockMetrics);
      jest.spyOn(provider, 'fetchMetadata').mockResolvedValue(undefined);
      jest.spyOn(provider, 'fetchLabelKeys').mockResolvedValue(['label1', 'label2']);

      const result = await provider.start(timeRange);

      expect(provider.fetchLabelValues).toHaveBeenCalledWith(timeRange, '__name__');
      expect(provider.metrics).toEqual(mockMetrics);
      expect(provider.histogramMetrics).toContain('histogram_metric_bucket');
      expect(result.length).toBe(2); // Promise.all with 2 promises
    });

    it('should use series endpoint if labels match API is not supported', async () => {
      datasource.hasLabelsMatchAPISupport = jest.fn().mockReturnValue(false);

      // Create a spy for fetchLabelValues
      jest.spyOn(provider, 'fetchLabelValues');

      // Mock the series fetch and process
      const mockSeries = [{ __name__: 'metric1', label1: 'value1' }];
      jest.spyOn(provider, 'fetchSeries').mockResolvedValue(mockSeries);

      // Mock the processSeries function to return specific values
      const processSeriesMock = languageUtils.processSeries as jest.Mock;
      processSeriesMock.mockReturnValue({
        metrics: ['metric1', 'histogram_bucket'],
        labelKeys: ['label1', 'label2'],
      });

      const result = await provider.start(timeRange);

      expect(provider.fetchLabelValues).not.toHaveBeenCalled();
      expect(provider.fetchSeries).toHaveBeenCalledWith(timeRange, '{__name__!=""}', '40000');
      expect(processSeriesMock).toHaveBeenCalledWith(mockSeries);

      // Check that the metrics and labelKeys from processSeries are used
      expect(provider.metrics).toEqual(['metric1', 'histogram_bucket']);
      expect(provider.labelKeys).toEqual(['label1', 'label2']);
      expect(provider.histogramMetrics).toContain('histogram_bucket'); // mock returns metrics with 'histogram' in the name
      expect(result.length).toBe(1); // Promise.all with 1 promise (only fetchMetadata)
    });
  });

  describe('request', () => {
    it('should return data from datasource metadataRequest', async () => {
      const expectedData = { metric: 'value' };
      datasource.metadataRequest = jest.fn().mockResolvedValue({ data: { data: expectedData } });

      const result = await provider.request('/api/test', [], {});

      expect(datasource.metadataRequest).toHaveBeenCalledWith('/api/test', {}, undefined);
      expect(result).toEqual(expectedData);
    });

    it('should return default value on error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const defaultValue = { default: true };
      datasource.metadataRequest = jest.fn().mockRejectedValue(new Error('Test error'));

      const result = await provider.request('/api/test', defaultValue, {});

      expect(result).toEqual(defaultValue);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should not log cancelled errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error');
      datasource.metadataRequest = jest.fn().mockRejectedValue({ cancelled: true });

      await provider.request('/api/test', {}, {});

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('fetchLabelKeys', () => {
    it('should append search params to URL for GET requests', async () => {
      datasource.httpMethod = 'GET';
      jest.spyOn(provider, 'request').mockResolvedValue(['label1', 'label2']);

      await provider.fetchLabelKeys(timeRange);

      const requestArgs = (provider.request as jest.Mock).mock.calls[0];
      expect(requestArgs[0]).toMatch(/^\/api\/v1\/labels\?/);
    });

    it('should not append params to URL for non-GET requests', async () => {
      datasource.httpMethod = 'POST';
      jest.spyOn(provider, 'request').mockResolvedValue(['label1', 'label2']);

      await provider.fetchLabelKeys(timeRange);

      const requestArgs = (provider.request as jest.Mock).mock.calls[0];
      expect(requestArgs[0]).toBe('/api/v1/labels');
    });

    it('should sort and return label keys', async () => {
      jest.spyOn(provider, 'request').mockResolvedValue(['c', 'a', 'b']);

      const result = await provider.fetchLabelKeys(timeRange);

      expect(result).toEqual(['a', 'b', 'c']);
      expect(provider.labelKeys).toEqual(['a', 'b', 'c']);
    });

    it('should return empty array if result is not an array', async () => {
      jest.spyOn(provider, 'request').mockResolvedValue(null);

      const result = await provider.fetchLabelKeys(timeRange);

      expect(result).toEqual([]);
    });
  });

  describe('fetchLabelValues', () => {
    it('should call API with correct parameters', async () => {
      jest.spyOn(provider, 'request').mockResolvedValue(['value1', 'value2']);

      await provider.fetchLabelValues(timeRange, 'labelKey');

      expect(provider.request).toHaveBeenCalledWith(
        '/api/v1/labels/labelKey/values',
        [],
        expect.objectContaining({
          limit: '40000',
        }),
        expect.any(Object)
      );
    });

    it('should handle empty response', async () => {
      jest.spyOn(provider, 'request').mockResolvedValue(null);

      const result = await provider.fetchLabelValues(timeRange, 'labelKey');

      expect(result).toEqual([]);
    });
  });

  describe('fetchMetadata', () => {
    it('should call API with correct parameters', async () => {
      jest.spyOn(provider, 'request').mockResolvedValue({});

      await provider.fetchMetadata();

      expect(provider.request).toHaveBeenCalledWith(
        '/api/v1/metadata',
        {},
        {},
        expect.objectContaining({
          showErrorAlert: false,
          headers: expect.objectContaining({
            'X-Grafana-Cache': expect.stringContaining('private, max-age='),
          }),
        })
      );
    });
  });

  describe('fetchSeries', () => {
    it('should call API with correct parameters', async () => {
      const mockSeriesData = [{ __name__: 'test_metric', instance: 'localhost:9090' }];
      jest.spyOn(provider, 'request').mockResolvedValue(mockSeriesData);

      const result = await provider.fetchSeries(timeRange, 'test_metric');

      expect(provider.request).toHaveBeenCalledWith(
        '/api/v1/series',
        {},
        {
          start: 'start',
          end: 'end',
          'match[]': 'test_metric',
          limit: '40000',
        },
        expect.any(Object)
      );
      expect(result).toEqual(mockSeriesData);
    });

    it('should handle custom limit parameter', async () => {
      jest.spyOn(provider, 'request').mockResolvedValue([]);

      await provider.fetchSeries(timeRange, 'test_metric', '100');

      expect(provider.request).toHaveBeenCalledWith(
        '/api/v1/series',
        {},
        expect.objectContaining({
          limit: '100',
        }),
        expect.any(Object)
      );
    });
  });
});

describe('Utility functions', () => {
  describe('isCancelledError', () => {
    it('should return true for cancelled errors', () => {
      expect(isCancelledError({ cancelled: true })).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isCancelledError(new Error('test'))).toBe(false);
      expect(isCancelledError({ message: 'error' })).toBe(false);
      expect(isCancelledError(null)).toBe(false);
      expect(isCancelledError(undefined)).toBe(false);
    });
  });

  describe('removeQuotesIfExist', () => {
    it('should remove quotes from quoted strings', () => {
      expect(removeQuotesIfExist('"test"')).toBe('test');
    });

    it('should leave unquoted strings unchanged', () => {
      expect(removeQuotesIfExist('test')).toBe('test');
      expect(removeQuotesIfExist('test"')).toBe('test"');
      expect(removeQuotesIfExist('"test')).toBe('"test');
    });
  });

  describe('buildCacheHeaders', () => {
    it('should build correct cache headers', () => {
      const result = buildCacheHeaders(300);
      expect(result).toEqual({
        headers: {
          'X-Grafana-Cache': 'private, max-age=300',
        },
      });
    });
  });

  describe('getDefaultCacheHeaders', () => {
    it('should return cache headers for non-None cache levels', () => {
      const result = getDefaultCacheHeaders(PrometheusCacheLevel.Low);
      expect(result).toEqual(
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Grafana-Cache': expect.stringContaining('private, max-age='),
          }),
        })
      );
    });

    it('should return undefined for None cache level', () => {
      const result = getDefaultCacheHeaders(PrometheusCacheLevel.None);
      expect(result).toBeUndefined();
    });
  });

  describe('populateMatchParamsFromQueries', () => {
    it('should add match params from queries', () => {
      const initialParams = new URLSearchParams();
      const queries: PromQuery[] = [
        { expr: 'metric1', refId: '1' },
        { expr: 'metric2', refId: '2' },
      ];

      const result = populateMatchParamsFromQueries(initialParams, queries);

      const matches = Array.from(result.getAll('match[]'));
      expect(matches).toContain('metric1');
      expect(matches).toContain('metric2');
    });

    it('should handle binary queries', () => {
      const initialParams = new URLSearchParams();
      const queries: PromQuery[] = [{ expr: 'binary', refId: '1' }];

      const result = populateMatchParamsFromQueries(initialParams, queries);

      const matches = Array.from(result.getAll('match[]'));
      expect(matches).toContain('binary');
      expect(matches).toContain('binary_binary');
    });

    it('should handle undefined queries', () => {
      const initialParams = new URLSearchParams({ param: 'value' });

      const result = populateMatchParamsFromQueries(initialParams, undefined);

      expect(result.toString()).toBe('param=value');
    });

    it('should handle UTF8 metrics', () => {
      // Using the mocked isValidLegacyName function from jest.mock setup
      const initialParams = new URLSearchParams();
      const queries: PromQuery[] = [{ expr: 'utf8metric', refId: '1' }];

      const result = populateMatchParamsFromQueries(initialParams, queries);

      const matches = Array.from(result.getAll('match[]'));
      expect(matches).toContain('{"utf8metric"}');
    });
  });
});
