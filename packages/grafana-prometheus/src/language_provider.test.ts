// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/language_provider.test.ts
import { AbstractLabelOperator, dateTime, TimeRange } from '@grafana/data';

jest.mock('./language_utils', () => ({
  ...jest.requireActual('./language_utils'),
  getPrometheusTime: jest.requireActual('./language_utils').getPrometheusTime,
  getRangeSnapInterval: jest.requireActual('./language_utils').getRangeSnapInterval,
}));

import { getCacheDurationInMinutes } from './caching';
import { Label } from './components/monaco-query-field/monaco-completion-provider/situation';
import { DEFAULT_SERIES_LIMIT } from './constants';
import { PrometheusDatasource } from './datasource';
import {
  exportToAbstractQuery,
  importFromAbstractQuery,
  PrometheusLanguageProviderInterface,
  PrometheusLanguageProvider,
  populateMatchParamsFromQueries,
} from './language_provider';
import { getPrometheusTime, getRangeSnapInterval } from './language_utils';
import { PrometheusCacheLevel, PromQuery } from './types';

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
  expect(requestSpy).toHaveBeenCalledWith(expectedUrl, expect.objectContaining(expectedParams), expectedOptions);
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
    seriesLimit: DEFAULT_SERIES_LIMIT,
  } as unknown as PrometheusDatasource;

  describe('Series and label fetching', () => {
    const timeRange = getMockTimeRange();

    describe('getSeries', () => {
      it('should use fetchDefaultSeries for empty selector', async () => {
        const languageProvider = new PrometheusLanguageProvider(defaultDatasource);
        const fetchDefaultSeriesSpy = jest.spyOn(languageProvider, 'fetchDefaultSeries');
        fetchDefaultSeriesSpy.mockResolvedValue({ job: ['job1', 'job2'], instance: ['instance1', 'instance2'] });

        const result = await languageProvider.getSeries(timeRange, '{}');

        expect(fetchDefaultSeriesSpy).toHaveBeenCalledWith(timeRange);
        expect(result).toEqual({ job: ['job1', 'job2'], instance: ['instance1', 'instance2'] });
      });

      it('should use fetchSeriesLabels for non-empty selector', async () => {
        const languageProvider = new PrometheusLanguageProvider(defaultDatasource);
        const fetchSeriesLabelsSpy = jest.spyOn(languageProvider, 'fetchSeriesLabels');
        fetchSeriesLabelsSpy.mockResolvedValue({ job: ['job1', 'job2'], instance: ['instance1', 'instance2'] });

        const result = await languageProvider.getSeries(timeRange, '{job="grafana"}');

        expect(fetchSeriesLabelsSpy).toHaveBeenCalledWith(timeRange, '{job="grafana"}', undefined, 'none');
        expect(result).toEqual({ job: ['job1', 'job2'], instance: ['instance1', 'instance2'] });
      });

      it('should include name label when withName is true', async () => {
        const languageProvider = new PrometheusLanguageProvider(defaultDatasource);
        const fetchSeriesLabelsSpy = jest.spyOn(languageProvider, 'fetchSeriesLabels');
        fetchSeriesLabelsSpy.mockResolvedValue({ __name__: ['metric1', 'metric2'], job: ['job1'] });

        const result = await languageProvider.getSeries(timeRange, '{job="grafana"}', true);

        expect(fetchSeriesLabelsSpy).toHaveBeenCalledWith(timeRange, '{job="grafana"}', true, 'none');
        expect(result).toHaveProperty('__name__');
        expect(result.__name__).toEqual(['metric1', 'metric2']);
      });

      it('should handle errors gracefully', async () => {
        jest.spyOn(console, 'error').mockImplementation();
        const languageProvider = new PrometheusLanguageProvider(defaultDatasource);
        jest.spyOn(languageProvider, 'fetchSeriesLabels').mockRejectedValue(new Error('Network error'));

        const result = await languageProvider.getSeries(timeRange, '{job="grafana"}');

        expect(result).toEqual({});
      });
    });

    describe('getSeriesLabels', () => {
      it('should call labels endpoint when API support is available', () => {
        const languageProvider = new PrometheusLanguageProvider({
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
        const languageProvider = new PrometheusLanguageProvider({
          ...defaultDatasource,
          getAdjustedInterval: (_: TimeRange) =>
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
        const timeSnapMinutes = getCacheDurationInMinutes(PrometheusCacheLevel.Low);
        const languageProvider = new PrometheusLanguageProvider({
          ...defaultDatasource,
          hasLabelsMatchAPISupport: () => true,
          cacheLevel: PrometheusCacheLevel.Low,
          getAdjustedInterval: (_: TimeRange) =>
            getRangeSnapInterval(PrometheusCacheLevel.Low, getMockQuantizedTimeRangeParams()),
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
        const languageProvider = new PrometheusLanguageProvider({
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
        const languageProvider = new PrometheusLanguageProvider({
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
        const languageProvider = new PrometheusLanguageProvider({
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
        const languageProvider = new PrometheusLanguageProvider(defaultDatasource);
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
        const languageProvider = new PrometheusLanguageProvider({
          ...defaultDatasource,
          interpolateString: (string: string) => string.replace(/\$/g, 'interpolated-'),
        } as PrometheusDatasource);
        const fetchSeriesLabels = languageProvider.fetchSeriesLabels;
        const requestSpy = jest.spyOn(languageProvider, 'request');

        fetchSeriesLabels(getMockTimeRange(), '$metric', undefined, DEFAULT_SERIES_LIMIT);

        verifyRequestParams(requestSpy, '/api/v1/series', {
          end: toPrometheusTimeString,
          'match[]': 'interpolated-metric',
          start: fromPrometheusTimeString,
          limit: DEFAULT_SERIES_LIMIT,
        });
      });

      it('should not include limit parameter when "none" is specified', () => {
        const languageProvider = new PrometheusLanguageProvider({
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
      let languageProvider: PrometheusLanguageProviderInterface;

      beforeEach(() => {
        languageProvider = new PrometheusLanguageProvider({
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
      let languageProvider: PrometheusLanguageProviderInterface;

      beforeEach(() => {
        languageProvider = new PrometheusLanguageProvider({
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
        const languageProvider = new PrometheusLanguageProvider({
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
        const languageProvider = new PrometheusLanguageProvider({
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
        const languageProvider = new PrometheusLanguageProvider({
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
        const languageProvider = new PrometheusLanguageProvider({
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
        const languageProvider = new PrometheusLanguageProvider({
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

  describe('fetchSuggestions', () => {
    it('should send POST request with correct parameters', async () => {
      const timeRange = getMockTimeRange();
      const mockQueries: PromQuery[] = [{ refId: 'A', expr: 'metric1' }];

      const languageProvider = new PrometheusLanguageProvider({
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
      const languageProvider = new PrometheusLanguageProvider(defaultDatasource);
      const requestSpy = jest.spyOn(languageProvider, 'request').mockResolvedValue(['result']);

      await languageProvider.fetchSuggestions(undefined, [], [], [], 'test');

      expect(requestSpy).toHaveBeenCalled();
      // Default time range should be used
      expect(requestSpy.mock.calls[0][1]).toHaveProperty('start');
      expect(requestSpy.mock.calls[0][1]).toHaveProperty('end');
    });

    it('should handle empty response gracefully', async () => {
      const languageProvider = new PrometheusLanguageProvider(defaultDatasource);
      jest.spyOn(languageProvider, 'request').mockResolvedValue(null);

      const result = await languageProvider.fetchSuggestions(getMockTimeRange(), [], [], [], 'test');

      expect(result).toEqual([]);
    });

    it('should include cache headers when cacheLevel is set', async () => {
      const timeSnapMinutes = getCacheDurationInMinutes(PrometheusCacheLevel.Medium);
      const languageProvider = new PrometheusLanguageProvider({
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

describe('PrometheusLanguageProvider with feature toggle', () => {
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
    seriesLimit: DEFAULT_SERIES_LIMIT,
  } as unknown as PrometheusDatasource;

  describe('constructor', () => {
    it('should initialize with SeriesApiClient when labels match API is not supported', () => {
      const provider = new PrometheusLanguageProvider(defaultDatasource);
      expect(provider).toBeInstanceOf(PrometheusLanguageProvider);
    });

    it('should initialize with LabelsApiClient when labels match API is supported', () => {
      const datasourceWithLabelsAPI = {
        ...defaultDatasource,
        hasLabelsMatchAPISupport: () => true,
      } as unknown as PrometheusDatasource;
      const provider = new PrometheusLanguageProvider(datasourceWithLabelsAPI);
      expect(provider).toBeInstanceOf(PrometheusLanguageProvider);
    });
  });

  describe('start', () => {
    it('should not start when lookups are disabled', async () => {
      const datasourceWithLookupsDisabled = {
        ...defaultDatasource,
        lookupsDisabled: true,
      } as unknown as PrometheusDatasource;
      const provider = new PrometheusLanguageProvider(datasourceWithLookupsDisabled);
      const result = await provider.start();
      expect(result).toEqual([]);
    });

    it('should use resource client and metricsMetadata is available', async () => {
      const provider = new PrometheusLanguageProvider(defaultDatasource);
      const mockMetadata = { metric1: { type: 'counter', help: 'help text' } };

      // Mock the resource client's start method
      const resourceClientStartSpy = jest.spyOn(provider['resourceClient'], 'start');
      const queryMetadataSpy = jest.spyOn(provider as any, '_queryMetadata').mockResolvedValue(mockMetadata);

      await provider.start();

      expect(resourceClientStartSpy).toHaveBeenCalled();
      expect(queryMetadataSpy).toHaveBeenCalled();
      expect(provider.retrieveMetricsMetadata()).toEqual(mockMetadata);
      expect(provider.metricsMetadata).toEqual(mockMetadata); // Check backward compatibility
    });

    it('should call queryMetricsMetadata with datasource seriesLimit during start', async () => {
      const customSeriesLimit = 5000;
      const datasourceWithCustomLimit = {
        ...defaultDatasource,
        seriesLimit: customSeriesLimit,
      } as PrometheusDatasource;

      const provider = new PrometheusLanguageProvider(datasourceWithCustomLimit);
      const mockMetadata = { metric1: { type: 'counter', help: 'help text' } };

      // Mock the resource client's start method
      const resourceClientStartSpy = jest.spyOn(provider['resourceClient'], 'start').mockResolvedValue();
      const queryMetricsMetadataSpy = jest.spyOn(provider, 'queryMetricsMetadata').mockResolvedValue(mockMetadata);

      await provider.start();

      expect(resourceClientStartSpy).toHaveBeenCalled();
      expect(queryMetricsMetadataSpy).toHaveBeenCalledWith(customSeriesLimit);
    });

    it('should return empty array when lazy loading is enabled', async () => {
      const datasource = {
        ...defaultDatasource,
        lazyLoading: true,
      } as unknown as PrometheusDatasource;
      const provider = new PrometheusLanguageProvider(datasource);
      const result = await provider.start();
      expect(result).toEqual([]);
    });

    it('should not call metadataRequest when lazy loading is enabled', async () => {
      const datasource = {
        ...defaultDatasource,
        lazyLoading: true,
      } as unknown as PrometheusDatasource;
      const provider = new PrometheusLanguageProvider(datasource);
      await provider.start();
      const metadataRequest = jest.spyOn(datasource, 'metadataRequest');
      expect(metadataRequest).toHaveBeenCalledTimes(0);
    });
  });

  describe('queryMetricsMetadata', () => {
    it('should fetch and store metadata without limit', async () => {
      const provider = new PrometheusLanguageProvider(defaultDatasource);
      const mockMetadata = { metric1: { type: 'counter', help: 'help text' } };
      const queryMetadataSpy = jest.spyOn(provider as any, '_queryMetadata').mockResolvedValue(mockMetadata);

      const result = await provider.queryMetricsMetadata();

      expect(queryMetadataSpy).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockMetadata);
      expect(provider.retrieveMetricsMetadata()).toEqual(mockMetadata);
    });

    it('should fetch and store metadata with custom limit', async () => {
      const provider = new PrometheusLanguageProvider(defaultDatasource);
      const mockMetadata = { metric1: { type: 'counter', help: 'help text' } };
      const customLimit = 1000;
      const queryMetadataSpy = jest.spyOn(provider as any, '_queryMetadata').mockResolvedValue(mockMetadata);

      const result = await provider.queryMetricsMetadata(customLimit);

      expect(queryMetadataSpy).toHaveBeenCalledWith(customLimit);
      expect(result).toEqual(mockMetadata);
      expect(provider.retrieveMetricsMetadata()).toEqual(mockMetadata);
    });

    it('should pass limit parameter to the metadata API endpoint', async () => {
      const provider = new PrometheusLanguageProvider(defaultDatasource);
      const requestSpy = jest.spyOn(provider, 'request').mockResolvedValue({
        metric1: { type: 'counter', help: 'help text' },
      });
      const customLimit = 500;

      await provider.queryMetricsMetadata(customLimit);

      expect(requestSpy).toHaveBeenCalledWith(
        '/api/v1/metadata',
        { limit: customLimit },
        expect.objectContaining({
          showErrorAlert: false,
        })
      );
    });

    it('should use DEFAULT_SERIES_LIMIT when no limit is provided', async () => {
      const provider = new PrometheusLanguageProvider(defaultDatasource);
      const requestSpy = jest.spyOn(provider, 'request').mockResolvedValue({
        metric1: { type: 'counter', help: 'help text' },
      });

      await provider.queryMetricsMetadata();

      expect(requestSpy).toHaveBeenCalledWith(
        '/api/v1/metadata',
        { limit: DEFAULT_SERIES_LIMIT },
        expect.objectContaining({
          showErrorAlert: false,
        })
      );
    });

    it('should pass zero limit when explicitly set', async () => {
      const provider = new PrometheusLanguageProvider(defaultDatasource);
      const requestSpy = jest.spyOn(provider, 'request').mockResolvedValue({
        metric1: { type: 'counter', help: 'help text' },
      });

      await provider.queryMetricsMetadata(0);

      expect(requestSpy).toHaveBeenCalledWith(
        '/api/v1/metadata',
        { limit: 0 },
        expect.objectContaining({
          showErrorAlert: false,
        })
      );
    });

    it('should include cache headers in the request', async () => {
      const provider = new PrometheusLanguageProvider({
        ...defaultDatasource,
        cacheLevel: PrometheusCacheLevel.Medium,
      } as PrometheusDatasource);
      const requestSpy = jest.spyOn(provider, 'request').mockResolvedValue({});

      await provider.queryMetricsMetadata(1000);

      expect(requestSpy).toHaveBeenCalledWith(
        '/api/v1/metadata',
        { limit: 1000 },
        expect.objectContaining({
          showErrorAlert: false,
          headers: expect.objectContaining({
            'X-Grafana-Cache': expect.stringMatching(/private, max-age=\d+/),
          }),
        })
      );
    });

    it('should handle undefined metadata response', async () => {
      const provider = new PrometheusLanguageProvider(defaultDatasource);
      const queryMetadataSpy = jest.spyOn(provider as any, '_queryMetadata').mockResolvedValue(undefined);

      const result = await provider.queryMetricsMetadata();

      expect(queryMetadataSpy).toHaveBeenCalled();
      expect(result).toEqual({});
      expect(provider.retrieveMetricsMetadata()).toEqual({});
    });

    it('should handle null metadata response', async () => {
      const provider = new PrometheusLanguageProvider(defaultDatasource);
      const queryMetadataSpy = jest.spyOn(provider as any, '_queryMetadata').mockResolvedValue(null);

      const result = await provider.queryMetricsMetadata(1000);

      expect(queryMetadataSpy).toHaveBeenCalledWith(1000);
      expect(result).toEqual({});
      expect(provider.retrieveMetricsMetadata()).toEqual({});
    });

    it('should handle endpoint errors and set empty metadata', async () => {
      const provider = new PrometheusLanguageProvider(defaultDatasource);
      const queryMetadataSpy = jest
        .spyOn(provider as any, '_queryMetadata')
        .mockRejectedValue(new Error('Endpoint not found'));

      const result = await provider.queryMetricsMetadata(1000);

      expect(queryMetadataSpy).toHaveBeenCalledWith(1000);
      expect(result).toEqual({});
      expect(provider.retrieveMetricsMetadata()).toEqual({});
    });

    it('should handle network timeout errors gracefully', async () => {
      const provider = new PrometheusLanguageProvider(defaultDatasource);
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      const queryMetadataSpy = jest.spyOn(provider as any, '_queryMetadata').mockRejectedValue(timeoutError);

      const result = await provider.queryMetricsMetadata(500);

      expect(queryMetadataSpy).toHaveBeenCalledWith(500);
      expect(result).toEqual({});
      expect(provider.retrieveMetricsMetadata()).toEqual({});
    });

    it('should maintain backward compatibility by setting deprecated metricsMetadata property', async () => {
      const provider = new PrometheusLanguageProvider(defaultDatasource);
      const mockMetadata = { metric1: { type: 'counter', help: 'help text' } };
      jest.spyOn(provider as any, '_queryMetadata').mockResolvedValue(mockMetadata);

      await provider.queryMetricsMetadata(250);

      expect(provider.retrieveMetricsMetadata()).toEqual(mockMetadata);
    });
  });

  describe('queryLabelKeys and queryLabelValues', () => {
    const timeRange = getMockTimeRange();

    it('should delegate to resource client queryLabelKeys', async () => {
      const provider = new PrometheusLanguageProvider(defaultDatasource);
      const resourceClientSpy = jest
        .spyOn(provider['resourceClient'], 'queryLabelKeys')
        .mockResolvedValue(['label1', 'label2']);

      const result = await provider.queryLabelKeys(timeRange, '{job="grafana"}');

      expect(resourceClientSpy).toHaveBeenCalledWith(timeRange, '{job="grafana"}', undefined);
      expect(result).toEqual(['label1', 'label2']);
    });

    it('queryLabelKeys should interpolate variables', async () => {
      const provider = new PrometheusLanguageProvider({
        ...defaultDatasource,
        interpolateString: (string: string) => string.replace(/\$/g, 'interpolated_'),
      } as PrometheusDatasource);
      const resourceClientSpy = jest
        .spyOn(provider['resourceClient'], 'queryLabelKeys')
        .mockResolvedValue(['label1', 'label2']);

      const result = await provider.queryLabelKeys(timeRange, '{job="$job"}');

      expect(resourceClientSpy).toHaveBeenCalledWith(timeRange, '{job="interpolated_job"}', undefined);
      expect(result).toEqual(['label1', 'label2']);
    });

    it('should delegate to resource client queryLabelValues', async () => {
      const provider = new PrometheusLanguageProvider(defaultDatasource);
      const resourceClientSpy = jest
        .spyOn(provider['resourceClient'], 'queryLabelValues')
        .mockResolvedValue(['value1', 'value2']);

      const result = await provider.queryLabelValues(timeRange, 'job', '{job="grafana"}');

      expect(resourceClientSpy).toHaveBeenCalledWith(timeRange, 'job', '{job="grafana"}', undefined);
      expect(result).toEqual(['value1', 'value2']);
    });

    it('queryLabelValues should interpolate variables', async () => {
      const provider = new PrometheusLanguageProvider({
        ...defaultDatasource,
        interpolateString: (string: string) => string.replace(/\$/g, 'interpolated_'),
      } as PrometheusDatasource);
      const resourceClientSpy = jest
        .spyOn(provider['resourceClient'], 'queryLabelValues')
        .mockResolvedValue(['label1', 'label2']);

      const result = await provider.queryLabelValues(timeRange, '$label', '{job="$job"}');

      expect(resourceClientSpy).toHaveBeenCalledWith(
        timeRange,
        'interpolated_label',
        '{job="interpolated_job"}',
        undefined
      );
      expect(result).toEqual(['label1', 'label2']);
    });
  });

  describe('retrieveMethods', () => {
    it('should delegate to resource client for metrics and labels', () => {
      const provider = new PrometheusLanguageProvider(defaultDatasource);
      const mockResourceClient = {
        histogramMetrics: ['histogram1', 'histogram2'],
        metrics: ['metric1', 'metric2'],
        labelKeys: ['label1', 'label2'],
      };

      // Mock the resource client properties
      Object.defineProperty(provider, '_resourceClient', {
        value: mockResourceClient,
        writable: true,
      });

      expect(provider.retrieveHistogramMetrics()).toEqual(['histogram1', 'histogram2']);
      expect(provider.retrieveMetrics()).toEqual(['metric1', 'metric2']);
      expect(provider.retrieveLabelKeys()).toEqual(['label1', 'label2']);
    });
  });

  describe('populateMatchParamsFromQueries', () => {
    it('should add match params from queries', () => {
      const queries: PromQuery[] = [
        { expr: 'metric1', refId: '1' },
        { expr: 'metric2', refId: '2' },
      ];
      const result = populateMatchParamsFromQueries(queries);
      expect(result).toEqual([`__name__=~"metric1|metric2"`]);
    });

    it('should handle binary queries', () => {
      const queries: PromQuery[] = [{ expr: 'binary{label="val"} + second{}', refId: '1' }];
      const result = populateMatchParamsFromQueries(queries);
      expect(result).toEqual([`__name__=~"binary|second"`]);
    });

    it('should handle undefined queries', () => {
      const result = populateMatchParamsFromQueries(undefined);
      expect(result).toEqual([]);
    });

    it('should handle UTF8 metrics', () => {
      const queries: PromQuery[] = [{ expr: '{"utf8.metric", label="value"}', refId: '1' }];
      const result = populateMatchParamsFromQueries(queries);
      expect(result).toContain('__name__=~"utf8.metric"');
    });

    it('should handle UTF8 metrics with normal metrics', () => {
      const queries: PromQuery[] = [{ expr: '{"utf8.metric", label="value"} + second{}', refId: '1' }];
      const result = populateMatchParamsFromQueries(queries);
      expect(result).toContain('__name__=~"utf8.metric|second"');
    });

    it('should return match-all matcher if there is no expr in queries', () => {
      const queries: PromQuery[] = [{ expr: '', refId: '1' }];
      const result = populateMatchParamsFromQueries(queries);
      expect(result).toEqual([]);
    });

    it('should return match-all matcher if there is no query', () => {
      const queries: PromQuery[] = [];
      const result = populateMatchParamsFromQueries(queries);
      expect(result).toEqual([]);
    });

    it('should extract the correct matcher for queries with `... or vector(0)`', () => {
      const queries: PromQuery[] = [
        {
          refId: 'A',
          expr: `sum(increase(go_cpu_classes_idle_cpu_seconds_total[$__rate_interval])) or vector(0)`,
        },
      ];
      const result = populateMatchParamsFromQueries(queries);
      expect(result).toEqual(['__name__=~"go_cpu_classes_idle_cpu_seconds_total"']);
    });
  });
});
