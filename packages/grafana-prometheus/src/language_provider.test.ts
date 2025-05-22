// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/language_provider.test.ts
import { AbstractLabelOperator, dateTime, TimeRange } from '@grafana/data';

import { DEFAULT_SERIES_LIMIT } from './components/metrics-browser/types';
import { Label } from './components/monaco-query-field/monaco-completion-provider/situation';
import { PrometheusDatasource } from './datasource';
import LanguageProvider, {
  exportToAbstractQuery,
  getMetadataHelp,
  getMetadataString,
  getMetadataType,
  importFromAbstractQuery,
  removeQuotesIfExist,
} from './language_provider';
import { getClientCacheDurationInMinutes, getPrometheusTime, getRangeSnapInterval } from './language_utils';
import { PrometheusCacheLevel, PromMetricsMetadata, PromQuery } from './types';

const now = new Date(1681300293392).getTime();
const timeRangeDurationSeconds = 1;
const toPrometheusTime = getPrometheusTime(dateTime(now), false);
const fromPrometheusTime = getPrometheusTime(dateTime(now - timeRangeDurationSeconds * 1000), false);
const toPrometheusTimeString = toPrometheusTime.toString(10);
const fromPrometheusTimeString = fromPrometheusTime.toString(10);

const getMockTimeRange = (): TimeRange => {
  return {
    to: dateTime(now).utc(),
    from: dateTime(now).subtract(timeRangeDurationSeconds, 'second').utc(),
    raw: {
      from: fromPrometheusTimeString,
      to: toPrometheusTimeString,
    },
  };
};

const getTimeRangeParams = (
  timRange: TimeRange,
  override?: Partial<{ start: string; end: string }>
): { start: string; end: string } => ({
  start: fromPrometheusTimeString,
  end: toPrometheusTimeString,
  ...override,
});

const getMockQuantizedTimeRangeParams = (override?: Partial<TimeRange>): TimeRange => ({
  from: dateTime(fromPrometheusTime * 1000),
  to: dateTime(toPrometheusTime * 1000),
  raw: {
    from: `now-${timeRangeDurationSeconds}s`,
    to: 'now',
  },
  ...override,
});

// Common test helper to verify request parameters
const verifyRequestParams = (
  requestSpy: jest.SpyInstance,
  expectedUrl: string,
  expectedParams: unknown,
  expectedOptions?: unknown
) => {
  expect(requestSpy).toHaveBeenCalled();
  expect(requestSpy).toHaveBeenCalledWith(
    expectedUrl,
    expect.objectContaining(expectedParams),
    expectedOptions
  );
};

describe('Prometheus Language Provider', () => {
  const defaultDatasource: PrometheusDatasource = {
    metadataRequest: () => ({ data: { data: [] } }),
    getTimeRangeParams: getTimeRangeParams,
    interpolateString: (string: string) => string,
    hasLabelsMatchAPISupport: () => false,
    getDaysToCacheMetadata: () => 1,
    getAdjustedInterval: () => getRangeSnapInterval(PrometheusCacheLevel.None, getMockQuantizedTimeRangeParams()),
    cacheLevel: PrometheusCacheLevel.None,
    getIntervalVars: () => ({}),
    getRangeScopedVars: () => ({}),
  } as unknown as PrometheusDatasource;

  describe('Series and label fetching', () => {
    const timeRange = getMockTimeRange();

    describe('getSeries', () => {
      it('should use fetchDefaultSeries for empty selector', async () => {
        const languageProvider = new LanguageProvider(defaultDatasource);
        const fetchDefaultSeriesSpy = jest.spyOn(languageProvider, 'fetchDefaultSeries');
        fetchDefaultSeriesSpy.mockResolvedValue({ job: ['job1', 'job2'], instance: ['instance1', 'instance2'] });

        const result = await languageProvider.getSeries(timeRange, '{}');

        expect(fetchDefaultSeriesSpy).toHaveBeenCalledWith(timeRange);
        expect(result).toEqual({ job: ['job1', 'job2'], instance: ['instance1', 'instance2'] });
      });

      it('should use fetchSeriesLabels for non-empty selector', async () => {
        const languageProvider = new LanguageProvider(defaultDatasource);
        const fetchSeriesLabelsSpy = jest.spyOn(languageProvider, 'fetchSeriesLabels');
        fetchSeriesLabelsSpy.mockResolvedValue({ job: ['job1', 'job2'], instance: ['instance1', 'instance2'] });

        const result = await languageProvider.getSeries(timeRange, '{job="grafana"}');

        expect(fetchSeriesLabelsSpy).toHaveBeenCalledWith(timeRange, '{job="grafana"}', undefined, 'none');
        expect(result).toEqual({ job: ['job1', 'job2'], instance: ['instance1', 'instance2'] });
      });

      it('should include name label when withName is true', async () => {
        const languageProvider = new LanguageProvider(defaultDatasource);
        const fetchSeriesLabelsSpy = jest.spyOn(languageProvider, 'fetchSeriesLabels');
        fetchSeriesLabelsSpy.mockResolvedValue({ __name__: ['metric1', 'metric2'], job: ['job1'] });

        const result = await languageProvider.getSeries(timeRange, '{job="grafana"}', true);

        expect(fetchSeriesLabelsSpy).toHaveBeenCalledWith(timeRange, '{job="grafana"}', true, 'none');
        expect(result).toHaveProperty('__name__');
        expect(result.__name__).toEqual(['metric1', 'metric2']);
      });

      it('should handle errors gracefully', async () => {
        jest.spyOn(console, 'error').mockImplementation();
        const languageProvider = new LanguageProvider(defaultDatasource);
        jest.spyOn(languageProvider, 'fetchSeriesLabels').mockRejectedValue(new Error('Network error'));

        const result = await languageProvider.getSeries(timeRange, '{job="grafana"}');

        expect(result).toEqual({});
      });
    });

    describe('getSeriesLabels', () => {
      it('should call labels endpoint when API support is available', () => {
        const languageProvider = new LanguageProvider({
          ...defaultDatasource,
          hasLabelsMatchAPISupport: () => true,
        } as PrometheusDatasource);
        const getSeriesLabels = languageProvider.getSeriesLabels;
        const requestSpy = jest.spyOn(languageProvider, 'request');

        const labelName = 'job';
        const labelValue = 'grafana';
        getSeriesLabels(timeRange, `{${labelName}="${labelValue}"}`, [
          {
            name: labelName,
            value: labelValue,
            op: '=',
          },
        ] as Label[]);

        verifyRequestParams(requestSpy, '/api/v1/labels', {
          end: toPrometheusTimeString,
          'match[]': '{job="grafana"}',
          start: fromPrometheusTimeString,
        });
      });

      it('should call series endpoint when API support is not available', () => {
        const languageProvider = new LanguageProvider({
          ...defaultDatasource,
          getAdjustedInterval: (timeRange: TimeRange) =>
            getRangeSnapInterval(PrometheusCacheLevel.None, getMockQuantizedTimeRangeParams()),
        } as PrometheusDatasource);
        const getSeriesLabels = languageProvider.getSeriesLabels;
        const requestSpy = jest.spyOn(languageProvider, 'request');

        const labelName = 'job';
        const labelValue = 'grafana';
        getSeriesLabels(timeRange, `{${labelName}="${labelValue}"}`, [
          {
            name: labelName,
            value: labelValue,
            op: '=',
          },
        ] as Label[]);

        verifyRequestParams(requestSpy, '/api/v1/series', {
          end: toPrometheusTimeString,
          'match[]': '{job="grafana"}',
          start: fromPrometheusTimeString,
        });
      });

      it('should call labels endpoint with quantized time parameters when cache level is set', () => {
        const timeSnapMinutes = getClientCacheDurationInMinutes(PrometheusCacheLevel.Low);
        const languageProvider = new LanguageProvider({
          ...defaultDatasource,
          hasLabelsMatchAPISupport: () => true,
          cacheLevel: PrometheusCacheLevel.Low,
          getAdjustedInterval: (timeRange: TimeRange) =>
            getRangeSnapInterval(PrometheusCacheLevel.Low, getMockQuantizedTimeRangeParams()),
          getCacheDurationInMinutes: () => timeSnapMinutes,
        } as PrometheusDatasource);
        const getSeriesLabels = languageProvider.getSeriesLabels;
        const requestSpy = jest.spyOn(languageProvider, 'request');

        const labelName = 'job';
        const labelValue = 'grafana';
        getSeriesLabels(timeRange, `{${labelName}="${labelValue}"}`, [
          {
            name: labelName,
            value: labelValue,
            op: '=',
          },
        ] as Label[]);

        expect(requestSpy).toHaveBeenCalled();
        expect(requestSpy).toHaveBeenCalledWith(
          '/api/v1/labels',
          {
            end: (
              dateTime(fromPrometheusTime * 1000)
                .add(timeSnapMinutes, 'minute')
                .startOf('minute')
                .valueOf() / 1000
            ).toString(),
            'match[]': '{job="grafana"}',
            start: (
              dateTime(toPrometheusTime * 1000)
                .startOf('minute')
                .valueOf() / 1000
            ).toString(),
          },
          { headers: { 'X-Grafana-Cache': `private, max-age=${timeSnapMinutes * 60}` } }
        );
      });
    });

    describe('getSeriesValues', () => {
      it('should call series endpoint when labels match API is not supported', () => {
        const languageProvider = new LanguageProvider({
          ...defaultDatasource,
        } as PrometheusDatasource);
        const getSeriesValues = languageProvider.getSeriesValues;
        const requestSpy = jest.spyOn(languageProvider, 'request');

        getSeriesValues(timeRange, 'job', '{job="grafana"}');

        verifyRequestParams(requestSpy, '/api/v1/series', {
          end: toPrometheusTimeString,
          'match[]': '{job="grafana"}',
          start: fromPrometheusTimeString,
        });
      });

      it('should call label values endpoint when labels match API is supported', () => {
        const languageProvider = new LanguageProvider({
          ...defaultDatasource,
          hasLabelsMatchAPISupport: () => true,
        } as PrometheusDatasource);
        const getSeriesValues = languageProvider.getSeriesValues;
        const requestSpy = jest.spyOn(languageProvider, 'request');

        const labelName = 'job';
        const labelValue = 'grafana';
        getSeriesValues(timeRange, labelName, `{${labelName}="${labelValue}"}`);

        verifyRequestParams(requestSpy, `/api/v1/label/${labelName}/values`, {
          end: toPrometheusTimeString,
          'match[]': `{${labelName}="${labelValue}"}`,
          start: fromPrometheusTimeString,
        });
      });

      it('should properly interpolate template variables in queries', () => {
        const languageProvider = new LanguageProvider({
          ...defaultDatasource,
          interpolateString: (string: string) => string.replace(/\$/g, 'interpolated-'),
        } as PrometheusDatasource);
        const getSeriesValues = languageProvider.getSeriesValues;
        const requestSpy = jest.spyOn(languageProvider, 'request');

        getSeriesValues(timeRange, 'job', '{instance="$instance", job="grafana"}');

        verifyRequestParams(requestSpy, '/api/v1/series', {
          end: toPrometheusTimeString,
          'match[]': '{instance="interpolated-instance", job="grafana"}',
          start: fromPrometheusTimeString,
        });
      });
    });

    describe('fetchSeries', () => {
      it('should use match[] parameter in request', async () => {
        const languageProvider = new LanguageProvider(defaultDatasource);
        await languageProvider.start(timeRange);
        const requestSpy = jest.spyOn(languageProvider, 'request');

        await languageProvider.fetchSeries(timeRange, '{job="grafana"}');

        verifyRequestParams(requestSpy, '/api/v1/series', {
          end: toPrometheusTimeString,
          'match[]': '{job="grafana"}',
          start: fromPrometheusTimeString,
        });
      });
    });

    describe('fetchSeriesLabels', () => {
      it('should interpolate variables in series queries', () => {
        const languageProvider = new LanguageProvider({
          ...defaultDatasource,
          interpolateString: (string: string) => string.replace(/\$/g, 'interpolated-'),
        } as PrometheusDatasource);
        const fetchSeriesLabels = languageProvider.fetchSeriesLabels;
        const requestSpy = jest.spyOn(languageProvider, 'request');

        fetchSeriesLabels(getMockTimeRange(), '$metric');

        verifyRequestParams(requestSpy, '/api/v1/series', {
          end: toPrometheusTimeString,
          'match[]': 'interpolated-metric',
          start: fromPrometheusTimeString,
          limit: DEFAULT_SERIES_LIMIT,
        });
      });

      it('should not include limit parameter when "none" is specified', () => {
        const languageProvider = new LanguageProvider({
          ...defaultDatasource,
        } as PrometheusDatasource);
        const fetchSeriesLabels = languageProvider.fetchSeriesLabels;
        const requestSpy = jest.spyOn(languageProvider, 'request');

        fetchSeriesLabels(getMockTimeRange(), 'metric-with-limit', undefined, 'none');

        verifyRequestParams(requestSpy, '/api/v1/series', {
          end: toPrometheusTimeString,
          'match[]': 'metric-with-limit',
          start: fromPrometheusTimeString,
        });
      });
    });
  });

  describe('fetchLabels API', () => {
    const tr = getMockTimeRange();

    const getParams = (requestSpy: ReturnType<typeof jest.spyOn>) => {
      return requestSpy.mock.calls[0][1]?.toString() ?? 'undefined';
    };

    describe('with POST method', () => {
      let languageProvider: LanguageProvider;

      beforeEach(() => {
        languageProvider = new LanguageProvider({
          ...defaultDatasource,
          httpMethod: 'POST',
        } as PrometheusDatasource);
      });

      it('should send single metric to request', async () => {
        const mockQueries: PromQuery[] = [{ refId: 'C', expr: 'go_gc_pauses_seconds_bucket' }];
        const fetchLabel = languageProvider.fetchLabels;
        const requestSpy = jest.spyOn(languageProvider, 'request');

        await fetchLabel(tr, mockQueries);

        expect(requestSpy).toHaveBeenCalled();
        const params = getParams(requestSpy);
        expect(params).toMatch(encodeURI('match[]=go_gc_pauses_seconds_bucket'));
      });

      it('should extract metrics from complex PromQL expressions', async () => {
        const mockQueries: PromQuery[] = [
          {
            refId: 'C',
            expr: 'histogram_quantile(0.95, sum(rate(go_gc_pauses_seconds_bucket[$__rate_interval])) by (le))',
          },
        ];
        const fetchLabel = languageProvider.fetchLabels;
        const requestSpy = jest.spyOn(languageProvider, 'request');

        await fetchLabel(tr, mockQueries);

        expect(requestSpy).toHaveBeenCalled();
        const params = getParams(requestSpy);
        expect(params).toMatch(encodeURI('match[]=go_gc_pauses_seconds_bucket'));
      });

      it('should combine metrics from multiple queries', async () => {
        const mockQueries: PromQuery[] = [
          { refId: 'B', expr: 'process_cpu_seconds_total' },
          { refId: 'C', expr: 'go_gc_pauses_seconds_bucket' },
        ];
        const fetchLabel = languageProvider.fetchLabels;
        const requestSpy = jest.spyOn(languageProvider, 'request');

        await fetchLabel(tr, mockQueries);

        expect(requestSpy).toHaveBeenCalled();
        const params = getParams(requestSpy);
        expect(params).toMatch(encodeURI('match[]=process_cpu_seconds_total&match[]=go_gc_pauses_seconds_bucket'));
      });

      it('should extract multiple metrics from binary operations', async () => {
        const mockQueries: PromQuery[] = [
          { refId: 'B', expr: 'process_cpu_seconds_total + go_gc_pauses_seconds_bucket' },
        ];
        const fetchLabel = languageProvider.fetchLabels;
        const requestSpy = jest.spyOn(languageProvider, 'request');

        await fetchLabel(tr, mockQueries);

        expect(requestSpy).toHaveBeenCalled();
        const params = getParams(requestSpy);
        expect(params).toMatch(encodeURI('match[]=process_cpu_seconds_total&match[]=go_gc_pauses_seconds_bucket'));
      });

      it('should set and return labelKeys from API response', async () => {
        const mockQueries: PromQuery[] = [{ refId: 'C', expr: 'go_gc_pauses_seconds_bucket' }];
        const fetchLabel = languageProvider.fetchLabels;
        const requestSpy = jest.spyOn(languageProvider, 'request').mockResolvedValue(['foo', 'bar']);

        const keys = await fetchLabel(tr, mockQueries);

        expect(requestSpy).toHaveBeenCalled();
        expect(languageProvider.labelKeys).toEqual(['bar', 'foo']); // Sorted order
        expect(keys).toEqual(['bar', 'foo']);
      });
    });

    describe('with GET method', () => {
      let languageProvider: LanguageProvider;

      beforeEach(() => {
        languageProvider = new LanguageProvider({
          ...defaultDatasource,
          httpMethod: 'GET',
        } as PrometheusDatasource);
      });

      it('should send query metrics in URL for GET requests', async () => {
        const mockQueries: PromQuery[] = [{ refId: 'C', expr: 'go_gc_pauses_seconds_bucket' }];
        const fetchLabel = languageProvider.fetchLabels;
        const requestSpy = jest.spyOn(languageProvider, 'request');

        await fetchLabel(tr, mockQueries);

        expect(requestSpy).toHaveBeenCalled();
        expect(requestSpy.mock.calls[0][0]).toMatch(encodeURI('match[]=go_gc_pauses_seconds_bucket'));
      });

      it('should handle empty queries correctly', async () => {
        const mockQueries: PromQuery[] = [{ refId: 'A', expr: '' }];
        const fetchLabel = languageProvider.fetchLabels;
        const requestSpy = jest.spyOn(languageProvider, 'request');

        await fetchLabel(tr, mockQueries);

        expect(requestSpy).toHaveBeenCalled();
        expect(requestSpy.mock.calls[0][0].indexOf('match[]')).toEqual(-1);
      });
    });
  });

  describe('Label value handling', () => {
    describe('fetchLabelValues', () => {
      it('should interpolate variables in labels', () => {
        const languageProvider = new LanguageProvider({
          ...defaultDatasource,
          interpolateString: (string: string) => string.replace(/\$/g, 'interpolated_'),
        } as PrometheusDatasource);
        const fetchLabelValues = languageProvider.fetchLabelValues;
        const requestSpy = jest.spyOn(languageProvider, 'request');

        fetchLabelValues(getMockTimeRange(), '$job');

        verifyRequestParams(requestSpy, '/api/v1/label/interpolated_job/values', {
          end: toPrometheusTimeString,
          start: fromPrometheusTimeString,
        });
      });

      it('should properly encode UTF-8 labels', () => {
        const languageProvider = new LanguageProvider({
          ...defaultDatasource,
          interpolateString: (string: string) => string.replace(/\$/g, 'http.status:sum'),
        } as PrometheusDatasource);
        const fetchLabelValues = languageProvider.fetchLabelValues;
        const requestSpy = jest.spyOn(languageProvider, 'request');

        fetchLabelValues(getMockTimeRange(), '"http.status:sum"');

        verifyRequestParams(requestSpy, '/api/v1/label/U__http_2e_status:sum/values', {
          end: toPrometheusTimeString,
          start: fromPrometheusTimeString,
        });
      });

      it('should handle special characters safely in label values', () => {
        const languageProvider = new LanguageProvider({
          ...defaultDatasource,
          interpolateString: (string: string) => string.replace(/\$/g, 'value with spaces & special chars'),
        } as PrometheusDatasource);
        const fetchLabelValues = languageProvider.fetchLabelValues;
        const requestSpy = jest.spyOn(languageProvider, 'request');

        fetchLabelValues(getMockTimeRange(), '$job');

        expect(requestSpy).toHaveBeenCalled();
        expect(requestSpy.mock.calls[0][0]).not.toContain(' ');
        expect(requestSpy.mock.calls[0][0]).not.toContain('&');
      });
    });

    describe('fetchSeriesValuesWithMatch', () => {
      it('should handle UTF-8 encoding for special label names', () => {
        const languageProvider = new LanguageProvider({
          ...defaultDatasource,
          interpolateString: (string: string) => string.replace(/\$/g, 'http.status:sum'),
        } as PrometheusDatasource);
        const fetchSeriesValuesWithMatch = languageProvider.fetchSeriesValuesWithMatch;
        const requestSpy = jest.spyOn(languageProvider, 'request');

        fetchSeriesValuesWithMatch(getMockTimeRange(), '"http.status:sum"', '{__name__="a_utf8_http_requests_total"}');

        verifyRequestParams(requestSpy, '/api/v1/label/U__http_2e_status:sum/values', {
          end: toPrometheusTimeString,
          start: fromPrometheusTimeString,
          'match[]': '{__name__="a_utf8_http_requests_total"}',
        });
      });

      it('should not encode standard Prometheus label names', () => {
        const languageProvider = new LanguageProvider({
          ...defaultDatasource,
        } as PrometheusDatasource);
        const fetchSeriesValuesWithMatch = languageProvider.fetchSeriesValuesWithMatch;
        const requestSpy = jest.spyOn(languageProvider, 'request');

        fetchSeriesValuesWithMatch(getMockTimeRange(), '"http_status_sum"', '{__name__="a_utf8_http_requests_total"}');

        verifyRequestParams(requestSpy, '/api/v1/label/http_status_sum/values', {
          end: toPrometheusTimeString,
          start: fromPrometheusTimeString,
          'match[]': '{__name__="a_utf8_http_requests_total"}',
        });
      });
    });
  });

  describe('Error handling and metadata', () => {
    it('should handle disabled metadata lookups gracefully', async () => {
      const datasource: PrometheusDatasource = {
        ...defaultDatasource,
        metadataRequest: jest.fn(() => ({ data: { data: ['foo', 'bar'] as string[] } })),
        lookupsDisabled: false,
      } as unknown as PrometheusDatasource;
      const mockedMetadataRequest = jest.mocked(datasource.metadataRequest);
      const instance = new LanguageProvider(datasource);

      expect(mockedMetadataRequest.mock.calls.length).toBe(0);
      await instance.start();
      expect(mockedMetadataRequest.mock.calls.length).toBeGreaterThan(0);
    });

    it('should handle metadata request failures gracefully', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const datasource: PrometheusDatasource = {
        ...defaultDatasource,
        metadataRequest: jest.fn(() => Promise.reject('rejected')),
        lookupsDisabled: false,
      } as unknown as PrometheusDatasource;
      const mockedMetadataRequest = jest.mocked(datasource.metadataRequest);
      const instance = new LanguageProvider(datasource);

      expect(mockedMetadataRequest.mock.calls.length).toBe(0);
      const result = await instance.start();
      expect(result[0]).toBeUndefined();
      expect(result[1]).toEqual([]);
      expect(mockedMetadataRequest.mock.calls.length).toBe(3);
    });

    it('should include cache headers for requests when cacheLevel is set', () => {
      const timeSnapMinutes = getClientCacheDurationInMinutes(PrometheusCacheLevel.Medium);
      const languageProvider = new LanguageProvider({
        ...defaultDatasource,
        cacheLevel: PrometheusCacheLevel.Medium,
        getCacheDurationInMinutes: () => timeSnapMinutes,
      } as PrometheusDatasource);
      const fetchLabelValues = languageProvider.fetchLabelValues;
      const requestSpy = jest.spyOn(languageProvider, 'request');

      fetchLabelValues(getMockTimeRange(), 'job');

      expect(requestSpy).toHaveBeenCalled();
      expect(requestSpy.mock.calls[0][2]).toEqual({
        headers: { 'X-Grafana-Cache': `private, max-age=${timeSnapMinutes * 60}` },
      });
    });

    it('should handle request errors gracefully', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const languageProvider = new LanguageProvider(defaultDatasource);
      const datasourceRequestMock = jest
        .spyOn(defaultDatasource, 'metadataRequest')
        .mockRejectedValue(new Error('Network error'));

      const result = await languageProvider.request('/api/v1/labels', {});

      expect(datasourceRequestMock).toHaveBeenCalled();
      expect(result).toEqual(undefined);
    });

    it('should ignore cancelled request errors', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const languageProvider = new LanguageProvider(defaultDatasource);
      const error = { cancelled: true };
      const datasourceRequestMock = jest.spyOn(defaultDatasource, 'metadataRequest').mockRejectedValue(error);

      const result = await languageProvider.request('/api/v1/labels', {});

      expect(datasourceRequestMock).toHaveBeenCalled();
      expect(result).toEqual(undefined);
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe('Query transformation', () => {
    describe('importFromAbstractQuery', () => {
      it('should handle empty queries', async () => {
        const result = importFromAbstractQuery({ refId: 'bar', labelMatchers: [] });
        expect(result).toEqual({ refId: 'bar', expr: '', range: true });
      });
    });

    describe('exportToAbstractQuery', () => {
      it('should extract labels and metric name from PromQL', async () => {
        const abstractQuery = exportToAbstractQuery({
          refId: 'bar',
          expr: 'metric_name{label1="value1", label2!="value2", label3=~"value3", label4!~"value4"}',
          instant: true,
          range: false,
        });

        expect(abstractQuery).toMatchObject({
          refId: 'bar',
          labelMatchers: [
            { name: 'label1', operator: AbstractLabelOperator.Equal, value: 'value1' },
            { name: 'label2', operator: AbstractLabelOperator.NotEqual, value: 'value2' },
            { name: 'label3', operator: AbstractLabelOperator.EqualRegEx, value: 'value3' },
            { name: 'label4', operator: AbstractLabelOperator.NotEqualRegEx, value: 'value4' },
            { name: '__name__', operator: AbstractLabelOperator.Equal, value: 'metric_name' },
          ],
        });
      });
    });
  });

  describe('Metadata utility functions', () => {
    const testMetadata: PromMetricsMetadata = {
      metric1: { type: 'counter', help: 'Test counter help text' },
      metric2: { type: 'gauge', help: 'Test gauge help text' },
    };

    describe('getMetadataString', () => {
      it('should return formatted string with type and help text', () => {
        const result = getMetadataString('metric1', testMetadata);
        expect(result).toBe('COUNTER: Test counter help text');
      });

      it('should return undefined for unknown metrics', () => {
        const result = getMetadataString('unknown_metric', testMetadata);
        expect(result).toBeUndefined();
      });
    });

    describe('getMetadataHelp', () => {
      it('should return help text for known metric', () => {
        const result = getMetadataHelp('metric2', testMetadata);
        expect(result).toBe('Test gauge help text');
      });

      it('should return undefined for unknown metrics', () => {
        const result = getMetadataHelp('unknown_metric', testMetadata);
        expect(result).toBeUndefined();
      });
    });

    describe('getMetadataType', () => {
      it('should return type for known metric', () => {
        const result = getMetadataType('metric1', testMetadata);
        expect(result).toBe('counter');
      });

      it('should return undefined for unknown metrics', () => {
        const result = getMetadataType('unknown_metric', testMetadata);
        expect(result).toBeUndefined();
      });
    });
  });

  describe('fetchSuggestions', () => {
    it('should send POST request with correct parameters', async () => {
      const timeRange = getMockTimeRange();
      const mockQueries: PromQuery[] = [{ refId: 'A', expr: 'metric1' }];

      const languageProvider = new LanguageProvider({
        ...defaultDatasource,
        interpolateString: (string: string) => `interpolated_${string}`,
        getIntervalVars: () => ({ __interval: '1m' }),
        getRangeScopedVars: () => ({ __range: { text: '1h', value: '1h' } }),
      } as unknown as PrometheusDatasource);

      const requestSpy = jest.spyOn(languageProvider, 'request').mockResolvedValue(['suggestion1', 'suggestion2']);

      // Simplifying the test by not passing complex scope objects that require more type definitions
      const result = await languageProvider.fetchSuggestions(
        timeRange,
        mockQueries,
        undefined, // omitting scopes parameter
        [{ key: 'instance', operator: '=', value: 'localhost' }],
        'metric',
        100
      );

      expect(requestSpy).toHaveBeenCalled();
      expect(requestSpy.mock.calls[0][0]).toBe('/suggestions');

      // Check method and content type
      expect(requestSpy.mock.calls[0][2]).toMatchObject({
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });

      // Check query parameters
      expect(requestSpy.mock.calls[0][1]).toMatchObject({
        labelName: 'metric',
        limit: 100,
        queries: ['interpolated_metric1'],
      });

      expect(result).toEqual(['suggestion1', 'suggestion2']);
    });

    it('should use default time range if not provided', async () => {
      const languageProvider = new LanguageProvider(defaultDatasource);
      const requestSpy = jest.spyOn(languageProvider, 'request').mockResolvedValue(['result']);

      await languageProvider.fetchSuggestions(undefined, [], [], [], 'test');

      expect(requestSpy).toHaveBeenCalled();
      // Default time range should be used
      expect(requestSpy.mock.calls[0][1]).toHaveProperty('start');
      expect(requestSpy.mock.calls[0][1]).toHaveProperty('end');
    });

    it('should handle empty response gracefully', async () => {
      const languageProvider = new LanguageProvider(defaultDatasource);
      jest.spyOn(languageProvider, 'request').mockResolvedValue(null);

      const result = await languageProvider.fetchSuggestions(getMockTimeRange(), [], [], [], 'test');

      expect(result).toEqual([]);
    });

    it('should include cache headers when cacheLevel is set', async () => {
      const timeSnapMinutes = getClientCacheDurationInMinutes(PrometheusCacheLevel.Medium);
      const languageProvider = new LanguageProvider({
        ...defaultDatasource,
        cacheLevel: PrometheusCacheLevel.Medium,
      } as PrometheusDatasource);

      const requestSpy = jest.spyOn(languageProvider, 'request').mockResolvedValue(['result']);

      await languageProvider.fetchSuggestions(getMockTimeRange(), [], [], [], 'test');

      expect(requestSpy).toHaveBeenCalled();
      expect(requestSpy.mock.calls[0][2]?.headers).toHaveProperty('X-Grafana-Cache');
      expect(requestSpy.mock.calls[0][2]?.headers?.['X-Grafana-Cache']).toContain(
        `private, max-age=${timeSnapMinutes * 60}`
      );
    });
  });
});

describe('removeQuotesIfExist', () => {
  it('removes quotes from a string with double quotes', () => {
    const input = '"hello"';
    const result = removeQuotesIfExist(input);
    expect(result).toBe('hello');
  });

  it('returns the original string if it does not start and end with quotes', () => {
    const input = 'hello';
    const result = removeQuotesIfExist(input);
    expect(result).toBe('hello');
  });

  it('returns the original string if it has mismatched quotes', () => {
    const input = '"hello';
    const result = removeQuotesIfExist(input);
    expect(result).toBe('"hello');
  });

  it('removes quotes for strings with special characters inside quotes', () => {
    const input = '"hello, world!"';
    const result = removeQuotesIfExist(input);
    expect(result).toBe('hello, world!');
  });

  it('removes quotes for strings with spaces inside quotes', () => {
    const input = '"   "';
    const result = removeQuotesIfExist(input);
    expect(result).toBe('   ');
  });

  it('returns the original string for an empty string', () => {
    const input = '';
    const result = removeQuotesIfExist(input);
    expect(result).toBe('');
  });

  it('returns the original string if the string only has a single quote character', () => {
    const input = '"';
    const result = removeQuotesIfExist(input);
    expect(result).toBe('"');
  });

  it('handles strings with nested quotes correctly', () => {
    const input = '"nested \"quotes\""';
    const result = removeQuotesIfExist(input);
    expect(result).toBe('nested \"quotes\"');
  });

  it('removes quotes from a numeric string wrapped in quotes', () => {
    const input = '"12345"';
    const result = removeQuotesIfExist(input);
    expect(result).toBe('12345');
  });
});
