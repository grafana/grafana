import { dateTime, TimeRange } from '@grafana/data';

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
          limit: '40000',
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
          limit: '40000',
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
          limit: '40000',
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
          limit: '40000',
        },
        defaultCacheHeaders
      );
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
    it('should throw error if match parameter is not provided', async () => {
      await expect(client.queryLabelKeys(mockTimeRange)).rejects.toThrow(
        'Series endpoint always expects at least one matcher'
      );
    });

    it('should fetch and process label keys from series', async () => {
      mockRequest.mockResolvedValueOnce([{ __name__: 'metric1', label1: 'value1', label2: 'value2' }]);

      const result = await client.queryLabelKeys(mockTimeRange, '{job="grafana"}');

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
          'match[]': '{__name__="metric1"}',
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
    getTimeRangeParams: mockGetTimeRangeParams,
  } as unknown as PrometheusDatasource;

  class TestBaseResourceClient extends BaseResourceClient {
    constructor() {
      super(mockRequest, mockDatasource);
    }
  }

  let client: TestBaseResourceClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new TestBaseResourceClient();
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

      const result = await client.querySeries(mockTimeRange, '{job="grafana"}');

      expect(mockRequest).toHaveBeenCalledWith(
        '/api/v1/series',
        {
          start: '1681300260',
          end: '1681300320',
          'match[]': '{job="grafana"}',
          limit: '40000',
        },
        { headers: { 'X-Grafana-Cache': 'private, max-age=60' } }
      );
      expect(result).toEqual([{ __name__: 'metric1' }]);
    });

    it('should use custom limit when provided', async () => {
      mockRequest.mockResolvedValueOnce([]);

      await client.querySeries(mockTimeRange, '{job="grafana"}', '1000');

      expect(mockRequest).toHaveBeenCalledWith(
        '/api/v1/series',
        {
          start: '1681300260',
          end: '1681300320',
          'match[]': '{job="grafana"}',
          limit: '1000',
        },
        { headers: { 'X-Grafana-Cache': 'private, max-age=60' } }
      );
    });

    it('should handle empty response', async () => {
      mockRequest.mockResolvedValueOnce(null);

      const result = await client.querySeries(mockTimeRange, '{job="grafana"}');

      expect(result).toEqual([]);
    });

    it('should handle non-array response', async () => {
      mockRequest.mockResolvedValueOnce({ error: 'invalid response' });

      const result = await client.querySeries(mockTimeRange, '{job="grafana"}');

      expect(result).toEqual([]);
    });
  });
});
