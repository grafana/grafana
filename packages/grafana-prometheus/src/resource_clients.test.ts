import { dateTime, TimeRange } from '@grafana/data';

import { DEFAULT_SERIES_LIMIT } from './constants';
import { PrometheusDatasource } from './datasource';
import { BaseResourceClient, LabelsApiClient, processSeries, SeriesApiClient } from './resource_clients';
import { PrometheusCacheLevel } from './types';

const mockTimeRange: TimeRange = {
  from: dateTime(1681300292392),
  to: dateTime(1681300293392),
  raw: {
    from: 'now-1s',
    to: 'now',
  },
};

const mockRequest = jest.fn().mockResolvedValue([]);
const mockGetAdjustedInterval = jest.fn().mockReturnValue({
  start: '1681300260',
  end: '1681300320',
});
const mockGetTimeRangeParams = jest.fn().mockReturnValue({
  start: '1681300260',
  end: '1681300320',
});
const mockInterpolateString = jest.fn((str) => str);
const defaultCacheHeaders = { headers: { 'X-Grafana-Cache': 'private, max-age=60' } };

describe('LabelsApiClient', () => {
  let client: LabelsApiClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new LabelsApiClient(mockRequest, {
      cacheLevel: PrometheusCacheLevel.Low,
      seriesLimit: DEFAULT_SERIES_LIMIT,
      getAdjustedInterval: mockGetAdjustedInterval,
      getTimeRangeParams: mockGetTimeRangeParams,
      interpolateString: mockInterpolateString,
    } as unknown as PrometheusDatasource);
  });

  describe('start', () => {
    it('should initialize metrics and label keys', async () => {
      mockRequest.mockResolvedValueOnce(['metric1', 'metric2']).mockResolvedValueOnce(['label1', 'label2']);

      await client.start(mockTimeRange);

      expect(client.metrics).toEqual(['metric1', 'metric2']);
      expect(client.labelKeys).toEqual(['label1', 'label2']);
    });
  });

  describe('queryMetrics', () => {
    it('should fetch metrics and process histogram metrics', async () => {
      mockRequest.mockResolvedValueOnce(['metric1_bucket', 'metric2_sum', 'metric3_count']);

      const result = await client.queryMetrics(mockTimeRange);

      expect(result.metrics).toEqual(['metric1_bucket', 'metric2_sum', 'metric3_count']);
      expect(result.histogramMetrics).toEqual(['metric1_bucket']);
    });
  });

  describe('queryLabelKeys', () => {
    it('should fetch and sort label keys', async () => {
      mockRequest.mockResolvedValueOnce(['label2', 'label1', 'label3']);

      const result = await client.queryLabelKeys(mockTimeRange);

      expect(result).toEqual(['label1', 'label2', 'label3']);
      expect(mockRequest).toHaveBeenCalledWith(
        '/api/v1/labels',
        {
          limit: 40000,
          start: expect.any(String),
          end: expect.any(String),
        },
        defaultCacheHeaders
      );
    });

    it('should include match parameter when provided', async () => {
      mockRequest.mockResolvedValueOnce(['label1', 'label2']);

      await client.queryLabelKeys(mockTimeRange, '{job="grafana"}');

      expect(mockRequest).toHaveBeenCalledWith(
        '/api/v1/labels',
        {
          'match[]': '{job="grafana"}',
          limit: 40000,
          start: expect.any(String),
          end: expect.any(String),
        },
        defaultCacheHeaders
      );
    });
  });

  describe('queryLabelValues', () => {
    it('should fetch label values with proper encoding', async () => {
      mockRequest.mockResolvedValueOnce(['value1', 'value2']);
      mockInterpolateString.mockImplementationOnce((str) => str);

      const result = await client.queryLabelValues(mockTimeRange, 'job');

      expect(result).toEqual(['value1', 'value2']);
      expect(mockRequest).toHaveBeenCalledWith(
        '/api/v1/label/job/values',
        {
          start: expect.any(String),
          end: expect.any(String),
          limit: 40000,
        },
        defaultCacheHeaders
      );
    });

    it('should handle UTF-8 label names', async () => {
      mockRequest.mockResolvedValueOnce(['value1', 'value2']);
      mockInterpolateString.mockImplementationOnce((str) => 'http.status:sum');

      await client.queryLabelValues(mockTimeRange, '"http.status:sum"');

      expect(mockRequest).toHaveBeenCalledWith(
        '/api/v1/label/U__http_2e_status:sum/values',
        {
          start: expect.any(String),
          end: expect.any(String),
          limit: 40000,
        },
        defaultCacheHeaders
      );
    });
  });

  describe('LabelsCache', () => {
    let cache: any; // Using any to access private members for testing

    beforeEach(() => {
      jest.useFakeTimers();
      cache = (client as any)._cache;
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    describe('cache key generation', () => {
      it('should generate different cache keys for keys and values', () => {
        const keyKey = cache.getCacheKey(mockTimeRange, '{job="test"}', '1000', 'key');
        const valueKey = cache.getCacheKey(mockTimeRange, '{job="test"}', '1000', 'value');
        expect(keyKey).not.toEqual(valueKey);
      });

      it('should use cache level from constructor for time range snapping', () => {
        const highLevelCache = new LabelsApiClient(mockRequest, {
          cacheLevel: PrometheusCacheLevel.High,
          getAdjustedInterval: mockGetAdjustedInterval,
          getTimeRangeParams: mockGetTimeRangeParams,
          interpolateString: mockInterpolateString,
        } as unknown as PrometheusDatasource);

        const lowLevelCache = new LabelsApiClient(mockRequest, {
          cacheLevel: PrometheusCacheLevel.Low,
          getAdjustedInterval: mockGetAdjustedInterval,
          getTimeRangeParams: mockGetTimeRangeParams,
          interpolateString: mockInterpolateString,
        } as unknown as PrometheusDatasource);

        const highKey = (highLevelCache as any)._cache.getCacheKey(mockTimeRange, '{job="test"}', '1000', 'key');
        const lowKey = (lowLevelCache as any)._cache.getCacheKey(mockTimeRange, '{job="test"}', '1000', 'key');

        expect(highKey).not.toEqual(lowKey);
      });
    });

    describe('cache size management', () => {
      beforeEach(() => {
        // Start with a clean cache for each test
        cache._cache = {};
        cache._accessTimestamps = {};
      });

      it('should remove oldest entries when max entries limit is reached', () => {
        // Override MAX_CACHE_ENTRIES for testing
        Object.defineProperty(cache, 'MAX_CACHE_ENTRIES', { value: 5 });

        // Add entries up to the limit
        cache.setLabelKeys(mockTimeRange, 'match1', '1000', ['key1']);
        jest.advanceTimersByTime(1000);
        cache.setLabelKeys(mockTimeRange, 'match2', '1000', ['key2']);
        jest.advanceTimersByTime(1000);
        cache.setLabelKeys(mockTimeRange, 'match3', '1000', ['key3']);
        jest.advanceTimersByTime(1000);
        cache.setLabelKeys(mockTimeRange, 'match4', '1000', ['key4']);
        jest.advanceTimersByTime(1000);
        cache.setLabelKeys(mockTimeRange, 'match5', '1000', ['key5']);

        // Access first entry to make it more recently used
        cache.getLabelKeys(mockTimeRange, 'match1', '1000');

        jest.advanceTimersByTime(1000);

        // Add sixth entry - this should trigger cache cleaning
        cache.setLabelKeys(mockTimeRange, 'match6', '1000', ['key6']);

        // Verify cache state - should have removed one entry (match2)
        expect(Object.keys(cache._cache).length).toBe(5);

        // Second entry should be removed (was least recently used)
        expect(cache.getLabelKeys(mockTimeRange, 'match2', '1000')).toBeUndefined();
        // First entry should exist (was accessed recently)
        expect(cache.getLabelKeys(mockTimeRange, 'match1', '1000')).toEqual(['key1']);
        // Third entry should exist
        expect(cache.getLabelKeys(mockTimeRange, 'match3', '1000')).toEqual(['key3']);
        // Fourth entry should exist
        expect(cache.getLabelKeys(mockTimeRange, 'match4', '1000')).toEqual(['key4']);
        // Fifth entry should exist
        expect(cache.getLabelKeys(mockTimeRange, 'match5', '1000')).toEqual(['key5']);
        // Sixth entry should exist (newest)
        expect(cache.getLabelKeys(mockTimeRange, 'match6', '1000')).toEqual(['key6']);
      });

      it('should remove oldest entries when max size limit is reached', () => {
        // Override MAX_CACHE_SIZE_BYTES for testing - set to small value to trigger cleanup
        Object.defineProperty(cache, 'MAX_CACHE_SIZE_BYTES', { value: 10 }); // Very small size to force cleanup

        // Create entries that will exceed the size limit
        const largeArray = Array(5).fill('large_value');

        // Add first large entry
        cache.setLabelKeys(mockTimeRange, 'match1', '1000', largeArray);

        // Verify initial size
        expect(Object.keys(cache._cache).length).toBe(1);
        expect(cache.getCacheSizeInBytes()).toBeGreaterThan(10);

        // Add second large entry - should trigger size-based cleanup
        cache.setLabelKeys(mockTimeRange, 'match2', '1000', largeArray);

        // Verify cache state - should only have the newest entry
        expect(Object.keys(cache._cache).length).toBe(1);
        expect(cache.getLabelKeys(mockTimeRange, 'match1', '1000')).toBeUndefined();
        expect(cache.getLabelKeys(mockTimeRange, 'match2', '1000')).toEqual(largeArray);

        // Add third entry to verify the cleanup continues to work
        cache.setLabelKeys(mockTimeRange, 'match3', '1000', largeArray);
        expect(Object.keys(cache._cache).length).toBe(1);
        expect(cache.getLabelKeys(mockTimeRange, 'match2', '1000')).toBeUndefined();
        expect(cache.getLabelKeys(mockTimeRange, 'match3', '1000')).toEqual(largeArray);
      });

      it('should update access time when getting cached values', () => {
        // Add an entry
        cache.setLabelKeys(mockTimeRange, 'match1', '1000', ['key1']);
        const cacheKey = cache.getCacheKey(mockTimeRange, 'match1', '1000', 'key');
        const initialTimestamp = cache._accessTimestamps[cacheKey];

        // Advance time
        jest.advanceTimersByTime(1000);

        // Access the entry
        cache.getLabelKeys(mockTimeRange, 'match1', '1000');
        const updatedTimestamp = cache._accessTimestamps[cacheKey];

        // Verify timestamp was updated
        expect(updatedTimestamp).toBeGreaterThan(initialTimestamp);
      });
    });

    describe('label values caching', () => {
      it('should cache and retrieve label values', () => {
        const values = ['value1', 'value2'];
        cache.setLabelValues(mockTimeRange, '{job="test"}', '1000', values);

        const cachedValues = cache.getLabelValues(mockTimeRange, '{job="test"}', '1000');
        expect(cachedValues).toEqual(values);
      });

      it('should return undefined for non-existent label values', () => {
        const result = cache.getLabelValues(mockTimeRange, '{job="nonexistent"}', '1000');
        expect(result).toBeUndefined();
      });
    });
  });
});

describe('SeriesApiClient', () => {
  let client: SeriesApiClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new SeriesApiClient(mockRequest, {
      cacheLevel: PrometheusCacheLevel.Low,
      getAdjustedInterval: mockGetAdjustedInterval,
      getTimeRangeParams: mockGetTimeRangeParams,
      interpolateString: mockInterpolateString,
    } as unknown as PrometheusDatasource);
  });

  describe('start', () => {
    it('should initialize metrics and histogram metrics', async () => {
      mockRequest.mockResolvedValueOnce([{ __name__: 'metric1_bucket' }, { __name__: 'metric2_sum' }]);

      await client.start(mockTimeRange);

      expect(client.metrics).toEqual(['metric1_bucket', 'metric2_sum']);
      expect(client.histogramMetrics).toEqual(['metric1_bucket']);
    });
  });

  describe('queryMetrics', () => {
    it('should fetch and process series data', async () => {
      mockRequest.mockResolvedValueOnce([
        { __name__: 'metric1', label1: 'value1' },
        { __name__: 'metric2', label2: 'value2' },
      ]);

      const result = await client.queryMetrics(mockTimeRange);

      expect(result.metrics).toEqual(['metric1', 'metric2']);
      expect(client.labelKeys).toEqual(['label1', 'label2']);
    });
  });

  describe('queryLabelKeys', () => {
    it('should use MATCH_ALL_LABELS when no matcher is provided', async () => {
      mockRequest.mockResolvedValueOnce([{ __name__: 'metric1', label1: 'value1', label2: 'value2' }]);

      const result = await client.queryLabelKeys(mockTimeRange);

      expect(mockRequest).toHaveBeenCalledWith(
        '/api/v1/series',
        expect.objectContaining({
          'match[]': '{__name__!=""}',
        }),
        expect.any(Object)
      );
      expect(result).toEqual(['label1', 'label2']);
    });

    it('should use MATCH_ALL_LABELS when empty matcher is provided', async () => {
      mockRequest.mockResolvedValueOnce([{ __name__: 'metric1', label1: 'value1', label2: 'value2' }]);

      const result = await client.queryLabelKeys(mockTimeRange, '{}');

      expect(mockRequest).toHaveBeenCalledWith(
        '/api/v1/series',
        expect.objectContaining({
          'match[]': '{__name__!=""}',
        }),
        expect.any(Object)
      );
      expect(result).toEqual(['label1', 'label2']);
    });

    it('should fetch and process label keys from series', async () => {
      mockRequest.mockResolvedValueOnce([{ __name__: 'metric1', label1: 'value1', label2: 'value2' }]);

      const result = await client.queryLabelKeys(mockTimeRange, '{job="grafana"}');

      expect(result).toEqual(['label1', 'label2']);
    });
  });

  describe('queryLabelValues', () => {
    it('should fetch and process label values from series', async () => {
      mockRequest.mockResolvedValueOnce([
        { __name__: 'metric1', job: 'grafana' },
        { __name__: 'metric2', job: 'prometheus' },
      ]);

      const result = await client.queryLabelValues(mockTimeRange, 'job', '{__name__="metric1"}');

      expect(mockRequest).toHaveBeenCalledWith(
        '/api/v1/series',
        expect.objectContaining({
          'match[]': '{__name__="metric1",job!=""}',
        }),
        expect.any(Object)
      );
      expect(result).toEqual(['grafana', 'prometheus']);
    });

    it('should create matcher with label when no matcher is provided', async () => {
      mockRequest.mockResolvedValueOnce([{ __name__: 'metric1', job: 'grafana' }]);

      await client.queryLabelValues(mockTimeRange, 'job');

      expect(mockRequest).toHaveBeenCalledWith(
        '/api/v1/series',
        expect.objectContaining({
          'match[]': '{job!=""}',
        }),
        expect.any(Object)
      );
    });

    it('should create matcher with label when empty matcher is provided', async () => {
      mockRequest.mockResolvedValueOnce([{ __name__: 'metric1', job: 'grafana' }]);

      await client.queryLabelValues(mockTimeRange, 'job', '{}');

      expect(mockRequest).toHaveBeenCalledWith(
        '/api/v1/series',
        expect.objectContaining({
          'match[]': '{job!=""}',
        }),
        expect.any(Object)
      );
    });

    it('should use cache for subsequent identical queries', async () => {
      // Setup mock response for first call
      mockRequest.mockResolvedValueOnce([
        { __name__: 'metric1', job: 'grafana' },
        { __name__: 'metric2', job: 'prometheus' },
      ]);

      // First query - should hit the backend
      const firstResult = await client.queryLabelValues(mockTimeRange, 'job', '{__name__="metric1"}');
      expect(firstResult).toEqual(['grafana', 'prometheus']);
      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith(
        '/api/v1/series',
        expect.objectContaining({
          'match[]': '{__name__="metric1",job!=""}',
        }),
        expect.any(Object)
      );

      // Reset mock to verify it's not called again
      mockRequest.mockClear();

      // Second query with same parameters - should use cache
      const secondResult = await client.queryLabelValues(mockTimeRange, 'job', '{__name__="metric1"}');
      expect(secondResult).toEqual(['grafana', 'prometheus']);
      expect(mockRequest).not.toHaveBeenCalled();
    });

    it('should create a proper matcher when the given match is a metric name only', async () => {
      mockRequest.mockResolvedValue([
        { __name__: 'metric1', job: 'grafana' },
        { __name__: 'metric2', job: 'prometheus' },
      ]);

      await client.queryLabelValues(mockTimeRange, 'job', 'metric1');

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith(
        '/api/v1/series',
        expect.objectContaining({
          'match[]': '{__name__="metric1",job!=""}',
        }),
        expect.any(Object)
      );
    });

    it('should create a proper matcher when the given match is a query', async () => {
      mockRequest.mockResolvedValue([
        { __name__: 'metric1', job: 'grafana' },
        { __name__: 'metric2', job: 'prometheus' },
      ]);

      await client.queryLabelValues(mockTimeRange, 'job', 'metric1{instance="test"}');

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith(
        '/api/v1/series',
        expect.objectContaining({
          'match[]': '{__name__="metric1",instance="test",job!=""}',
        }),
        expect.any(Object)
      );
    });

    it('should create a proper matcher when the given match is a utf8 query', async () => {
      mockRequest.mockResolvedValue([
        { __name__: 'metric1', job: 'grafana' },
        { __name__: 'metric2', job: 'prometheus' },
      ]);

      await client.queryLabelValues(mockTimeRange, 'job', '{"metric.name", instance="test"}');

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith(
        '/api/v1/series',
        expect.objectContaining({
          'match[]': '{__name__="metric.name",instance="test",job!=""}',
        }),
        expect.any(Object)
      );
    });

    it('should be able make the right request with utf8 label keys and matchers', async () => {
      mockRequest.mockResolvedValue([
        { __name__: 'metric1', job: 'grafana' },
        { __name__: 'metric2', job: 'prometheus' },
      ]);

      await client.queryLabelValues(mockTimeRange, '"label with space"', '{"label with space"="space"}');

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith(
        '/api/v1/series',
        expect.objectContaining({
          'match[]': '{"label with space"="space","label with space"!=""}',
        }),
        expect.any(Object)
      );
    });

    it('should be able to return the right utf8 label key value', async () => {
      mockRequest.mockResolvedValue([
        {
          __name__: 'a.utf8.metric 🤘',
          a_legacy_label: 'legacy',
          'label with space': 'space',
        },
      ]);

      const response = await client.queryLabelValues(
        mockTimeRange,
        '"label with space"',
        '{a_legacy_label="legacy",__name__="a.utf8.metric 🤘"}'
      );

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith(
        '/api/v1/series',
        expect.objectContaining({
          'match[]': '{a_legacy_label="legacy",__name__="a.utf8.metric 🤘","label with space"!=""}',
        }),
        expect.any(Object)
      );
      expect(response).toEqual(['space']);
    });
  });

  describe('SeriesCache', () => {
    let cache: any; // Using any to access private members for testing

    beforeEach(() => {
      jest.useFakeTimers();
      cache = (client as any)._cache;
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    describe('cache key generation', () => {
      it('should generate different cache keys for keys and values', () => {
        const keyKey = cache.getCacheKey(mockTimeRange, '{job="test"}', '1000', 'key');
        const valueKey = cache.getCacheKey(mockTimeRange, '{job="test"}', '1000', 'value');
        expect(keyKey).not.toEqual(valueKey);
      });

      it('should use cache level from constructor for time range snapping', () => {
        const highLevelCache = new SeriesApiClient(mockRequest, {
          cacheLevel: PrometheusCacheLevel.High,
          getAdjustedInterval: mockGetAdjustedInterval,
          getTimeRangeParams: mockGetTimeRangeParams,
        } as unknown as PrometheusDatasource);

        const lowLevelCache = new SeriesApiClient(mockRequest, {
          cacheLevel: PrometheusCacheLevel.Low,
          getAdjustedInterval: mockGetAdjustedInterval,
          getTimeRangeParams: mockGetTimeRangeParams,
        } as unknown as PrometheusDatasource);

        const highKey = (highLevelCache as any)._cache.getCacheKey(mockTimeRange, '{job="test"}', '1000', 'key');
        const lowKey = (lowLevelCache as any)._cache.getCacheKey(mockTimeRange, '{job="test"}', '1000', 'key');

        expect(highKey).not.toEqual(lowKey);
      });
    });

    describe('cache size management', () => {
      beforeEach(() => {
        // Start with a clean cache for each test
        cache._cache = {};
        cache._accessTimestamps = {};
      });

      it('should remove oldest entries when max entries limit is reached', () => {
        // Override MAX_CACHE_ENTRIES for testing
        Object.defineProperty(cache, 'MAX_CACHE_ENTRIES', { value: 5 });

        // Add entries up to the limit
        cache.setLabelKeys(mockTimeRange, 'match1', '1000', ['key1']);
        jest.advanceTimersByTime(1000);
        cache.setLabelKeys(mockTimeRange, 'match2', '1000', ['key2']);
        jest.advanceTimersByTime(1000);
        cache.setLabelKeys(mockTimeRange, 'match3', '1000', ['key3']);
        jest.advanceTimersByTime(1000);
        cache.setLabelKeys(mockTimeRange, 'match4', '1000', ['key4']);
        jest.advanceTimersByTime(1000);
        cache.setLabelKeys(mockTimeRange, 'match5', '1000', ['key5']);

        // Access first entry to make it more recently used
        cache.getLabelKeys(mockTimeRange, 'match1', '1000');

        jest.advanceTimersByTime(1000);

        // Add sixth entry - this should trigger cache cleaning
        // and remove 20% (1 entry) of the oldest entries
        cache.setLabelKeys(mockTimeRange, 'match6', '1000', ['key6']);

        // Verify cache state - should have removed one entry (match2)
        expect(Object.keys(cache._cache).length).toBe(5);

        // Second entry should be removed (was least recently used)
        expect(cache.getLabelKeys(mockTimeRange, 'match2', '1000')).toBeUndefined();
        // First entry should exist (was accessed recently)
        expect(cache.getLabelKeys(mockTimeRange, 'match1', '1000')).toEqual(['key1']);
        // Third entry should exist
        expect(cache.getLabelKeys(mockTimeRange, 'match3', '1000')).toEqual(['key3']);
        // Fourth entry should exist
        expect(cache.getLabelKeys(mockTimeRange, 'match4', '1000')).toEqual(['key4']);
        // Fifth entry should exist
        expect(cache.getLabelKeys(mockTimeRange, 'match5', '1000')).toEqual(['key5']);
        // Sixth entry should exist (newest)
        expect(cache.getLabelKeys(mockTimeRange, 'match6', '1000')).toEqual(['key6']);
      });

      it('should remove oldest entries when max size limit is reached', () => {
        // Override MAX_CACHE_SIZE_BYTES for testing - set to small value to trigger cleanup
        Object.defineProperty(cache, 'MAX_CACHE_SIZE_BYTES', { value: 10 }); // Very small size to force cleanup

        // Create entries that will exceed the size limit
        const largeArray = Array(5).fill('large_value');

        // Add first large entry
        cache.setLabelKeys(mockTimeRange, 'match1', '1000', largeArray);

        // Verify initial size
        expect(Object.keys(cache._cache).length).toBe(1);
        expect(cache.getCacheSizeInBytes()).toBeGreaterThan(10);

        // Add second large entry - should trigger size-based cleanup
        cache.setLabelKeys(mockTimeRange, 'match2', '1000', largeArray);

        // Verify cache state - should only have the newest entry
        expect(Object.keys(cache._cache).length).toBe(1);
        expect(cache.getLabelKeys(mockTimeRange, 'match1', '1000')).toBeUndefined();
        expect(cache.getLabelKeys(mockTimeRange, 'match2', '1000')).toEqual(largeArray);

        // Add third entry to verify the cleanup continues to work
        cache.setLabelKeys(mockTimeRange, 'match3', '1000', largeArray);
        expect(Object.keys(cache._cache).length).toBe(1);
        expect(cache.getLabelKeys(mockTimeRange, 'match2', '1000')).toBeUndefined();
        expect(cache.getLabelKeys(mockTimeRange, 'match3', '1000')).toEqual(largeArray);
      });

      it('should update access time when getting cached values', () => {
        // Add an entry
        cache.setLabelKeys(mockTimeRange, 'match1', '1000', ['key1']);
        const cacheKey = cache.getCacheKey(mockTimeRange, 'match1', '1000', 'key');
        const initialTimestamp = cache._accessTimestamps[cacheKey];

        // Advance time
        jest.advanceTimersByTime(1000);

        // Access the entry
        cache.getLabelKeys(mockTimeRange, 'match1', '1000');
        const updatedTimestamp = cache._accessTimestamps[cacheKey];

        // Verify timestamp was updated
        expect(updatedTimestamp).toBeGreaterThan(initialTimestamp);
      });
    });

    describe('label values caching', () => {
      it('should cache and retrieve label values', () => {
        const values = ['value1', 'value2'];
        cache.setLabelValues(mockTimeRange, '{job="test"}', '1000', values);

        const cachedValues = cache.getLabelValues(mockTimeRange, '{job="test"}', '1000');
        expect(cachedValues).toEqual(values);
      });

      it('should return undefined for non-existent label values', () => {
        const result = cache.getLabelValues(mockTimeRange, '{job="nonexistent"}', '1000');
        expect(result).toBeUndefined();
      });
    });
  });
});

describe('processSeries', () => {
  it('should extract metrics and label keys from series data', () => {
    const result = processSeries([
      {
        __name__: 'alerts',
        alertname: 'AppCrash',
        alertstate: 'firing',
        instance: 'host.docker.internal:3000',
        job: 'grafana',
        severity: 'critical',
      },
      {
        __name__: 'alerts',
        alertname: 'AppCrash',
        alertstate: 'firing',
        instance: 'prometheus-utf8:9112',
        job: 'prometheus-utf8',
        severity: 'critical',
      },
      {
        __name__: 'counters_logins',
        app: 'backend',
        geohash: '9wvfgzurfzb',
        instance: 'fake-prometheus-data:9091',
        job: 'fake-data-gen',
        server: 'backend-01',
      },
    ]);

    // Check structure
    expect(result).toHaveProperty('metrics');
    expect(result).toHaveProperty('labelKeys');

    // Verify metrics are extracted correctly
    expect(result.metrics).toEqual(['alerts', 'counters_logins']);

    // Verify all metrics are unique
    expect(result.metrics.length).toBe(new Set(result.metrics).size);

    // Verify label keys are extracted correctly and don't include __name__
    expect(result.labelKeys).toContain('instance');
    expect(result.labelKeys).toContain('job');
    expect(result.labelKeys).not.toContain('__name__');

    // Verify all label keys are unique
    expect(result.labelKeys.length).toBe(new Set(result.labelKeys).size);
  });

  it('should handle empty series data', () => {
    const result = processSeries([]);

    expect(result.metrics).toEqual([]);
    expect(result.labelKeys).toEqual([]);
  });

  it('should handle series without __name__ attribute', () => {
    const series = [
      { instance: 'localhost:9090', job: 'prometheus' },
      { instance: 'localhost:9100', job: 'node' },
    ];

    const result = processSeries(series);

    expect(result.metrics).toEqual([]);
    expect(result.labelKeys).toEqual(['instance', 'job']);
  });

  it('should extract label values for a specific key when findValuesForKey is provided', () => {
    const series = [
      {
        __name__: 'alerts',
        instance: 'host.docker.internal:3000',
        job: 'grafana',
        severity: 'critical',
      },
      {
        __name__: 'alerts',
        instance: 'prometheus-utf8:9112',
        job: 'prometheus-utf8',
        severity: 'critical',
      },
      {
        __name__: 'counters_logins',
        instance: 'fake-prometheus-data:9091',
        job: 'fake-data-gen',
        severity: 'warning',
      },
    ];

    // Test finding values for 'job' label
    const jobResult = processSeries(series, 'job');
    expect(jobResult.labelValues).toEqual(['fake-data-gen', 'grafana', 'prometheus-utf8']);

    // Test finding values for 'severity' label
    const severityResult = processSeries(series, 'severity');
    expect(severityResult.labelValues).toEqual(['critical', 'warning']);

    // Test finding values for 'instance' label
    const instanceResult = processSeries(series, 'instance');
    expect(instanceResult.labelValues).toEqual([
      'fake-prometheus-data:9091',
      'host.docker.internal:3000',
      'prometheus-utf8:9112',
    ]);
  });

  it('should return empty labelValues array when findValuesForKey is not provided', () => {
    const series = [
      {
        __name__: 'alerts',
        instance: 'host.docker.internal:3000',
        job: 'grafana',
      },
    ];

    const result = processSeries(series);
    expect(result.labelValues).toEqual([]);
  });

  it('should return empty labelValues array when findValuesForKey does not match any labels', () => {
    const series = [
      {
        __name__: 'alerts',
        instance: 'host.docker.internal:3000',
        job: 'grafana',
      },
    ];

    const result = processSeries(series, 'non_existent_label');
    expect(result.labelValues).toEqual([]);
  });
});

describe('BaseResourceClient', () => {
  const mockRequest = jest.fn();
  const mockGetTimeRangeParams = jest.fn();
  const mockDatasource = {
    cacheLevel: PrometheusCacheLevel.Low,
    seriesLimit: DEFAULT_SERIES_LIMIT,
    getTimeRangeParams: mockGetTimeRangeParams,
  } as unknown as PrometheusDatasource;

  class TestBaseResourceClient extends BaseResourceClient {
    constructor() {
      super(mockRequest, mockDatasource);
    }

    // Expose protected method for testing
    public testGetEffectiveLimit(limit?: number): number {
      return this.getEffectiveLimit(limit);
    }
  }

  let client: TestBaseResourceClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new TestBaseResourceClient();
  });

  describe('getEffectiveLimit', () => {
    it('should return the provided limit when a number is given', () => {
      expect(client.testGetEffectiveLimit(1000)).toBe(1000);
      expect(client.testGetEffectiveLimit(500)).toBe(500);
      expect(client.testGetEffectiveLimit(100000)).toBe(100000);
    });

    it('should return 0 when limit is 0 (valid for unlimited)', () => {
      expect(client.testGetEffectiveLimit(0)).toBe(0);
    });

    it('should return datasource seriesLimit when limit is undefined', () => {
      expect(client.testGetEffectiveLimit(undefined)).toBe(DEFAULT_SERIES_LIMIT);
    });

    it('should return datasource seriesLimit when no limit is provided', () => {
      expect(client.testGetEffectiveLimit()).toBe(DEFAULT_SERIES_LIMIT);
    });
  });

  describe('querySeries', () => {
    const mockTimeRange = {
      from: dateTime(1681300292392),
      to: dateTime(1681300293392),
      raw: {
        from: 'now-1s',
        to: 'now',
      },
    };

    beforeEach(() => {
      mockGetTimeRangeParams.mockReturnValue({ start: '1681300260', end: '1681300320' });
    });

    it('should make request with correct parameters', async () => {
      mockRequest.mockResolvedValueOnce([{ __name__: 'metric1' }]);

      const result = await client.querySeries(mockTimeRange, '{job="grafana"}', DEFAULT_SERIES_LIMIT);

      expect(mockRequest).toHaveBeenCalledWith(
        '/api/v1/series',
        {
          start: '1681300260',
          end: '1681300320',
          'match[]': '{job="grafana"}',
          limit: 40000,
        },
        { headers: { 'X-Grafana-Cache': 'private, max-age=60' } }
      );
      expect(result).toEqual([{ __name__: 'metric1' }]);
    });

    it('should use custom limit when provided', async () => {
      mockRequest.mockResolvedValueOnce([]);

      await client.querySeries(mockTimeRange, '{job="grafana"}', 1000);

      expect(mockRequest).toHaveBeenCalledWith(
        '/api/v1/series',
        {
          start: '1681300260',
          end: '1681300320',
          'match[]': '{job="grafana"}',
          limit: 1000,
        },
        { headers: { 'X-Grafana-Cache': 'private, max-age=60' } }
      );
    });

    it('should handle empty response', async () => {
      mockRequest.mockResolvedValueOnce(null);

      const result = await client.querySeries(mockTimeRange, '{job="grafana"}', DEFAULT_SERIES_LIMIT);

      expect(result).toEqual([]);
    });

    it('should handle non-array response', async () => {
      mockRequest.mockResolvedValueOnce({ error: 'invalid response' });

      const result = await client.querySeries(mockTimeRange, '{job="grafana"}', DEFAULT_SERIES_LIMIT);

      expect(result).toEqual([]);
    });
  });
});
