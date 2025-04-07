// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/language_provider.test.ts
import { AbstractLabelOperator, dateTime, TimeRange } from '@grafana/data';

import { DEFAULT_SERIES_LIMIT } from './components/metrics-browser/types';
import { Label } from './components/monaco-query-field/monaco-completion-provider/situation';
import { PrometheusDatasource } from './datasource';
import LanguageProvider, { removeQuotesIfExist } from './language_provider';
import { getClientCacheDurationInMinutes, getPrometheusTime, getRangeSnapInterval } from './language_utils';
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

describe('Language completion provider', () => {
  const defaultDatasource: PrometheusDatasource = {
    metadataRequest: () => ({ data: { data: [] } }),
    getTimeRangeParams: getTimeRangeParams,
    interpolateString: (string: string) => string,
    hasLabelsMatchAPISupport: () => false,
    getQuantizedTimeRangeParams: () =>
      getRangeSnapInterval(PrometheusCacheLevel.None, getMockQuantizedTimeRangeParams()),
    getDaysToCacheMetadata: () => 1,
    getAdjustedInterval: () => getRangeSnapInterval(PrometheusCacheLevel.None, getMockQuantizedTimeRangeParams()),
    cacheLevel: PrometheusCacheLevel.None,
  } as unknown as PrometheusDatasource;

  describe('cleanText', () => {
    const cleanText = new LanguageProvider(defaultDatasource).cleanText;
    it('does not remove metric or label keys', () => {
      expect(cleanText('foo')).toBe('foo');
      expect(cleanText('foo_bar')).toBe('foo_bar');
    });

    it('keeps trailing space but removes leading', () => {
      expect(cleanText('foo ')).toBe('foo ');
      expect(cleanText(' foo')).toBe('foo');
    });

    it('removes label syntax', () => {
      expect(cleanText('foo="bar')).toBe('bar');
      expect(cleanText('foo!="bar')).toBe('bar');
      expect(cleanText('foo=~"bar')).toBe('bar');
      expect(cleanText('foo!~"bar')).toBe('bar');
      expect(cleanText('{bar')).toBe('bar');
    });

    it('removes previous operators', () => {
      expect(cleanText('foo + bar')).toBe('bar');
      expect(cleanText('foo+bar')).toBe('bar');
      expect(cleanText('foo - bar')).toBe('bar');
      expect(cleanText('foo * bar')).toBe('bar');
      expect(cleanText('foo / bar')).toBe('bar');
      expect(cleanText('foo % bar')).toBe('bar');
      expect(cleanText('foo ^ bar')).toBe('bar');
      expect(cleanText('foo and bar')).toBe('bar');
      expect(cleanText('foo or bar')).toBe('bar');
      expect(cleanText('foo unless bar')).toBe('bar');
      expect(cleanText('foo == bar')).toBe('bar');
      expect(cleanText('foo != bar')).toBe('bar');
      expect(cleanText('foo > bar')).toBe('bar');
      expect(cleanText('foo < bar')).toBe('bar');
      expect(cleanText('foo >= bar')).toBe('bar');
      expect(cleanText('foo <= bar')).toBe('bar');
      expect(cleanText('memory')).toBe('memory');
    });

    it('removes aggregation syntax', () => {
      expect(cleanText('(bar')).toBe('bar');
      expect(cleanText('(foo,bar')).toBe('bar');
      expect(cleanText('(foo, bar')).toBe('bar');
    });

    it('removes range syntax', () => {
      expect(cleanText('[1m')).toBe('1m');
    });
  });

  describe('getSeriesLabels', () => {
    const timeRange = getMockTimeRange();

    it('should call labels endpoint', () => {
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
      expect(requestSpy).toHaveBeenCalled();
      expect(requestSpy).toHaveBeenCalledWith(
        `/api/v1/labels`,
        [],
        {
          end: toPrometheusTimeString,
          'match[]': '{job="grafana"}',
          start: fromPrometheusTimeString,
        },
        undefined
      );
    });

    it('should call series endpoint', () => {
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
      expect(requestSpy).toHaveBeenCalled();
      expect(requestSpy).toHaveBeenCalledWith(
        '/api/v1/series',
        [],
        {
          end: toPrometheusTimeString,
          'match[]': '{job="grafana"}',
          start: fromPrometheusTimeString,
        },
        undefined
      );
    });

    it('should call labels endpoint with quantized start', () => {
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
        `/api/v1/labels`,
        [],
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
    const timeRange = getMockTimeRange();

    it('should call old series endpoint and should use match[] parameter', () => {
      const languageProvider = new LanguageProvider({
        ...defaultDatasource,
      } as PrometheusDatasource);
      const getSeriesValues = languageProvider.getSeriesValues;
      const requestSpy = jest.spyOn(languageProvider, 'request');
      getSeriesValues(timeRange, 'job', '{job="grafana"}');
      expect(requestSpy).toHaveBeenCalled();
      expect(requestSpy).toHaveBeenCalledWith(
        '/api/v1/series',
        [],
        {
          end: toPrometheusTimeString,
          'match[]': '{job="grafana"}',
          start: fromPrometheusTimeString,
        },
        undefined
      );
    });

    it('should call new series endpoint and should use match[] parameter', () => {
      const languageProvider = new LanguageProvider({
        ...defaultDatasource,
        hasLabelsMatchAPISupport: () => true,
      } as PrometheusDatasource);
      const getSeriesValues = languageProvider.getSeriesValues;
      const requestSpy = jest.spyOn(languageProvider, 'request');
      const labelName = 'job';
      const labelValue = 'grafana';
      getSeriesValues(timeRange, labelName, `{${labelName}="${labelValue}"}`);
      expect(requestSpy).toHaveBeenCalled();
      expect(requestSpy).toHaveBeenCalledWith(
        `/api/v1/label/${labelName}/values`,
        [],
        {
          end: toPrometheusTimeString,
          'match[]': `{${labelName}="${labelValue}"}`,
          start: fromPrometheusTimeString,
        },
        undefined
      );
    });

    it('should call old series endpoint and should use match[] parameter and interpolate the template variables', () => {
      const languageProvider = new LanguageProvider({
        ...defaultDatasource,
        interpolateString: (string: string) => string.replace(/\$/, 'interpolated-'),
      } as PrometheusDatasource);
      const getSeriesValues = languageProvider.getSeriesValues;
      const requestSpy = jest.spyOn(languageProvider, 'request');
      getSeriesValues(timeRange, 'job', '{instance="$instance", job="grafana"}');
      expect(requestSpy).toHaveBeenCalled();
      expect(requestSpy).toHaveBeenCalledWith(
        '/api/v1/series',
        [],
        {
          end: toPrometheusTimeString,
          'match[]': '{instance="interpolated-instance", job="grafana"}',
          start: fromPrometheusTimeString,
        },
        undefined
      );
    });
  });

  describe('fetchSeries', () => {
    it('should use match[] parameter', async () => {
      const languageProvider = new LanguageProvider(defaultDatasource);
      const timeRange = getMockTimeRange();
      await languageProvider.start(timeRange);
      const requestSpy = jest.spyOn(languageProvider, 'request');
      await languageProvider.fetchSeries(timeRange, '{job="grafana"}');
      expect(requestSpy).toHaveBeenCalled();
      expect(requestSpy).toHaveBeenCalledWith(
        '/api/v1/series',
        {},
        {
          end: toPrometheusTimeString,
          'match[]': '{job="grafana"}',
          start: fromPrometheusTimeString,
        },
        undefined
      );
    });
  });

  describe('fetchSeriesLabels', () => {
    it('should interpolate variable in series', () => {
      const languageProvider = new LanguageProvider({
        ...defaultDatasource,
        interpolateString: (string: string) => string.replace(/\$/, 'interpolated-'),
      } as PrometheusDatasource);
      const fetchSeriesLabels = languageProvider.fetchSeriesLabels;
      const requestSpy = jest.spyOn(languageProvider, 'request');
      fetchSeriesLabels(getMockTimeRange(), '$metric');
      expect(requestSpy).toHaveBeenCalled();
      expect(requestSpy).toHaveBeenCalledWith(
        '/api/v1/series',
        [],
        {
          end: toPrometheusTimeString,
          'match[]': 'interpolated-metric',
          start: fromPrometheusTimeString,
          limit: DEFAULT_SERIES_LIMIT,
        },
        undefined
      );
    });

    it("should not use default limit parameter when 'none' is passed to fetchSeriesLabels", () => {
      const languageProvider = new LanguageProvider({
        ...defaultDatasource,
      } as PrometheusDatasource);
      const fetchSeriesLabels = languageProvider.fetchSeriesLabels;
      const requestSpy = jest.spyOn(languageProvider, 'request');
      fetchSeriesLabels(getMockTimeRange(), 'metric-with-limit', undefined, 'none');
      expect(requestSpy).toHaveBeenCalled();
      expect(requestSpy).toHaveBeenCalledWith(
        '/api/v1/series',
        [],
        {
          end: toPrometheusTimeString,
          'match[]': 'metric-with-limit',
          start: fromPrometheusTimeString,
        },
        undefined
      );
    });

    it("should not have a limit paranter if 'none' is passed to function", () => {
      const languageProvider = new LanguageProvider({
        ...defaultDatasource,
        // interpolateString: (string: string) => string.replace(/\$/, 'interpolated-'),
      } as PrometheusDatasource);
      const fetchSeriesLabels = languageProvider.fetchSeriesLabels;
      const requestSpy = jest.spyOn(languageProvider, 'request');
      fetchSeriesLabels(getMockTimeRange(), 'metric-without-limit', false, 'none');
      expect(requestSpy).toHaveBeenCalled();
      expect(requestSpy).toHaveBeenCalledWith(
        '/api/v1/series',
        [],
        {
          end: toPrometheusTimeString,
          'match[]': 'metric-without-limit',
          start: fromPrometheusTimeString,
        },
        undefined
      );
    });
  });

  describe('fetchLabels', () => {
    const tr = getMockTimeRange();
    const getParams = (requestSpy: ReturnType<typeof jest.spyOn>) => {
      // Following is equal to `URLSearchParams().toString()`
      return requestSpy.mock.calls[0][2]?.toString() ?? 'undefined';
    };

    describe('with POST', () => {
      let languageProvider: LanguageProvider;
      beforeEach(() => {
        languageProvider = new LanguageProvider({
          ...defaultDatasource,
          httpMethod: 'POST',
        } as PrometheusDatasource);
      });

      it('should send query metrics to the POST request', async () => {
        const mockQueries: PromQuery[] = [
          {
            refId: 'C',
            expr: 'go_gc_pauses_seconds_bucket',
          },
        ];
        const fetchLabel = languageProvider.fetchLabels;
        const requestSpy = jest.spyOn(languageProvider, 'request');
        await fetchLabel(tr, mockQueries);
        expect(requestSpy).toHaveBeenCalled();
        const params = getParams(requestSpy);
        expect(params).toMatch(encodeURI('match[]=go_gc_pauses_seconds_bucket'));
      });

      it('should send metrics from complex query to the POST request', async () => {
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

      it('should send metrics from multiple queries to the POST request', async () => {
        const mockQueries: PromQuery[] = [
          {
            refId: 'B',
            expr: 'process_cpu_seconds_total',
          },
          {
            refId: 'C',
            expr: 'go_gc_pauses_seconds_bucket',
          },
        ];
        const fetchLabel = languageProvider.fetchLabels;
        const requestSpy = jest.spyOn(languageProvider, 'request');
        await fetchLabel(tr, mockQueries);
        expect(requestSpy).toHaveBeenCalled();
        const params = getParams(requestSpy);
        expect(params).toMatch(encodeURI('match[]=process_cpu_seconds_total&match[]=go_gc_pauses_seconds_bucket'));
      });

      it('should send metrics from a query contains multiple metrics to the POST request', async () => {
        const mockQueries: PromQuery[] = [
          {
            refId: 'B',
            expr: 'process_cpu_seconds_total + go_gc_pauses_seconds_bucket',
          },
        ];
        const fetchLabel = languageProvider.fetchLabels;
        const requestSpy = jest.spyOn(languageProvider, 'request');
        await fetchLabel(tr, mockQueries);
        expect(requestSpy).toHaveBeenCalled();
        const params = getParams(requestSpy);
        expect(params).toMatch(encodeURI('match[]=process_cpu_seconds_total&match[]=go_gc_pauses_seconds_bucket'));
      });

      it('should send metrics from a query contains multiple metrics and queries to the POST request', async () => {
        const mockQueries: PromQuery[] = [
          {
            refId: 'A',
            expr: 'histogram_quantile(0.95, sum(rate(process_max_fds[$__rate_interval])) by (le)) + go_gc_heap_frees_by_size_bytes_bucket',
          },
          {
            refId: 'B',
            expr: 'process_cpu_seconds_total + go_gc_pauses_seconds_bucket',
          },
        ];
        const fetchLabel = languageProvider.fetchLabels;
        const requestSpy = jest.spyOn(languageProvider, 'request');
        await fetchLabel(tr, mockQueries);
        expect(requestSpy).toHaveBeenCalled();
        const params = getParams(requestSpy);
        expect(params).toMatch(
          encodeURI(
            'match[]=process_max_fds&match[]=go_gc_heap_frees_by_size_bytes_bucket&match[]=process_cpu_seconds_total&match[]=go_gc_pauses_seconds_bucket'
          )
        );
      });

      it('should set `labelKeys` on language provider', async () => {
        const mockQueries: PromQuery[] = [
          {
            refId: 'C',
            expr: 'go_gc_pauses_seconds_bucket',
          },
        ];
        const fetchLabel = languageProvider.fetchLabels;
        const requestSpy = jest.spyOn(languageProvider, 'request').mockResolvedValue(['foo', 'bar']);
        await fetchLabel(tr, mockQueries);
        expect(requestSpy).toHaveBeenCalled();
        expect(languageProvider.labelKeys).toEqual(['bar', 'foo']);
      });

      it('should return labelKeys from request', async () => {
        const mockQueries: PromQuery[] = [
          {
            refId: 'C',
            expr: 'go_gc_pauses_seconds_bucket',
          },
        ];
        const fetchLabel = languageProvider.fetchLabels;
        const requestSpy = jest.spyOn(languageProvider, 'request').mockResolvedValue(['foo', 'bar']);
        const keys = await fetchLabel(tr, mockQueries);
        expect(requestSpy).toHaveBeenCalled();
        expect(keys).toEqual(['bar', 'foo']);
      });
    });

    describe('with GET', () => {
      let languageProvider: LanguageProvider;
      beforeEach(() => {
        languageProvider = new LanguageProvider({
          ...defaultDatasource,
          httpMethod: 'GET',
        } as PrometheusDatasource);
      });

      it('should send query metrics to the GET request', async () => {
        const mockQueries: PromQuery[] = [
          {
            refId: 'C',
            expr: 'go_gc_pauses_seconds_bucket',
          },
        ];
        const fetchLabel = languageProvider.fetchLabels;
        const requestSpy = jest.spyOn(languageProvider, 'request');
        await fetchLabel(tr, mockQueries);
        expect(requestSpy).toHaveBeenCalled();
        expect(requestSpy.mock.calls[0][0]).toMatch(encodeURI('match[]=go_gc_pauses_seconds_bucket'));
      });

      it('should send metrics from complex query to the GET request', async () => {
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
        expect(requestSpy.mock.calls[0][0]).toMatch(encodeURI('match[]=go_gc_pauses_seconds_bucket'));
      });

      it('should send metrics from multiple queries to the GET request', async () => {
        const mockQueries: PromQuery[] = [
          {
            refId: 'B',
            expr: 'process_cpu_seconds_total',
          },
          {
            refId: 'C',
            expr: 'go_gc_pauses_seconds_bucket',
          },
        ];
        const fetchLabel = languageProvider.fetchLabels;
        const requestSpy = jest.spyOn(languageProvider, 'request');
        await fetchLabel(tr, mockQueries);
        expect(requestSpy).toHaveBeenCalled();
        expect(requestSpy.mock.calls[0][0]).toMatch(
          encodeURI('match[]=process_cpu_seconds_total&match[]=go_gc_pauses_seconds_bucket')
        );
      });

      it('should send metrics from a query contains multiple metrics to the GET request', async () => {
        const mockQueries: PromQuery[] = [
          {
            refId: 'B',
            expr: 'process_cpu_seconds_total + go_gc_pauses_seconds_bucket',
          },
        ];
        const fetchLabel = languageProvider.fetchLabels;
        const requestSpy = jest.spyOn(languageProvider, 'request');
        await fetchLabel(tr, mockQueries);
        expect(requestSpy).toHaveBeenCalled();
        expect(requestSpy.mock.calls[0][0]).toMatch(
          encodeURI('match[]=process_cpu_seconds_total&match[]=go_gc_pauses_seconds_bucket')
        );
      });

      it('should send metrics from a query contains multiple metrics and queries to the GET request', async () => {
        const mockQueries: PromQuery[] = [
          {
            refId: 'A',
            expr: 'histogram_quantile(0.95, sum(rate(process_max_fds[$__rate_interval])) by (le)) + go_gc_heap_frees_by_size_bytes_bucket',
          },
          {
            refId: 'B',
            expr: 'process_cpu_seconds_total + go_gc_pauses_seconds_bucket',
          },
        ];
        const fetchLabel = languageProvider.fetchLabels;
        const requestSpy = jest.spyOn(languageProvider, 'request');
        await fetchLabel(tr, mockQueries);
        expect(requestSpy).toHaveBeenCalled();
        expect(requestSpy.mock.calls[0][0]).toMatch(
          encodeURI(
            'match[]=process_max_fds&match[]=go_gc_heap_frees_by_size_bytes_bucket&match[]=process_cpu_seconds_total&match[]=go_gc_pauses_seconds_bucket'
          )
        );
      });

      it('should dont send match[] parameter if there is no metric', async () => {
        const mockQueries: PromQuery[] = [
          {
            refId: 'A',
            expr: '',
          },
        ];
        const fetchLabel = languageProvider.fetchLabels;
        const requestSpy = jest.spyOn(languageProvider, 'request');
        await fetchLabel(tr, mockQueries);
        expect(requestSpy).toHaveBeenCalled();
        expect(requestSpy.mock.calls[0][0].indexOf('match[]')).toEqual(-1);
      });
    });
  });

  describe('fetchLabelValues', () => {
    it('should interpolate variable in series', () => {
      const languageProvider = new LanguageProvider({
        ...defaultDatasource,
        interpolateString: (string: string) => string.replace(/\$/g, 'interpolated_'),
      } as PrometheusDatasource);
      const fetchLabelValues = languageProvider.fetchLabelValues;
      const requestSpy = jest.spyOn(languageProvider, 'request');
      fetchLabelValues(getMockTimeRange(), '$job');
      expect(requestSpy).toHaveBeenCalled();
      expect(requestSpy).toHaveBeenCalledWith(
        '/api/v1/label/interpolated_job/values',
        [],
        {
          end: toPrometheusTimeString,
          start: fromPrometheusTimeString,
        },
        undefined
      );
    });

    it('should fetch with encoded utf8 label', () => {
      const languageProvider = new LanguageProvider({
        ...defaultDatasource,
        interpolateString: (string: string) => string.replace(/\$/g, 'http.status:sum'),
      } as PrometheusDatasource);
      const fetchLabelValues = languageProvider.fetchLabelValues;
      const requestSpy = jest.spyOn(languageProvider, 'request');
      fetchLabelValues(getMockTimeRange(), '"http.status:sum"');
      expect(requestSpy).toHaveBeenCalled();
      expect(requestSpy).toHaveBeenCalledWith(
        '/api/v1/label/U__http_2e_status:sum/values',
        [],
        {
          end: toPrometheusTimeString,
          start: fromPrometheusTimeString,
        },
        undefined
      );
    });
  });

  describe('fetchSeriesValuesWithMatch', () => {
    it('should fetch with encoded utf8 label', () => {
      const languageProvider = new LanguageProvider({
        ...defaultDatasource,
        interpolateString: (string: string) => string.replace(/\$/g, 'http.status:sum'),
      } as PrometheusDatasource);
      const fetchSeriesValuesWithMatch = languageProvider.fetchSeriesValuesWithMatch;
      const requestSpy = jest.spyOn(languageProvider, 'request');
      fetchSeriesValuesWithMatch(getMockTimeRange(), '"http.status:sum"', '{__name__="a_utf8_http_requests_total"}');
      expect(requestSpy).toHaveBeenCalled();
      expect(requestSpy).toHaveBeenCalledWith(
        '/api/v1/label/U__http_2e_status:sum/values',
        [],
        {
          end: toPrometheusTimeString,
          start: fromPrometheusTimeString,
          'match[]': '{__name__="a_utf8_http_requests_total"}',
        },
        undefined
      );
    });

    it('should fetch without encoding for standard prometheus labels', () => {
      const languageProvider = new LanguageProvider({
        ...defaultDatasource,
      } as PrometheusDatasource);
      const fetchSeriesValuesWithMatch = languageProvider.fetchSeriesValuesWithMatch;
      const requestSpy = jest.spyOn(languageProvider, 'request');
      fetchSeriesValuesWithMatch(getMockTimeRange(), '"http_status_sum"', '{__name__="a_utf8_http_requests_total"}');
      expect(requestSpy).toHaveBeenCalled();
      expect(requestSpy).toHaveBeenCalledWith(
        '/api/v1/label/http_status_sum/values',
        [],
        {
          end: toPrometheusTimeString,
          start: fromPrometheusTimeString,
          'match[]': '{__name__="a_utf8_http_requests_total"}',
        },
        undefined
      );
    });
  });

  describe('disabled metrics lookup', () => {
    it('issues metadata requests when lookup is not disabled', async () => {
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

    it('doesnt blow up if metadata or fetchLabels rejects', async () => {
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
  });

  describe('Query imports', () => {
    it('returns empty queries', async () => {
      const instance = new LanguageProvider(defaultDatasource);
      const result = await instance.importFromAbstractQuery({ refId: 'bar', labelMatchers: [] });
      expect(result).toEqual({ refId: 'bar', expr: '', range: true });
    });

    describe('exporting to abstract query', () => {
      it('exports labels with metric name', async () => {
        const instance = new LanguageProvider(defaultDatasource);
        const abstractQuery = instance.exportToAbstractQuery({
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
