import { AbstractLabelOperator, dateTime, TimeRange } from '@grafana/data';

import { Label } from './components/monaco-query-field/monaco-completion-provider/situation';
import { PrometheusDatasource } from './datasource';
import LanguageProvider from './language_provider';
import { getClientCacheDurationInMinutes, getPrometheusTime, getRangeSnapInterval } from './language_utils';
import { PrometheusCacheLevel } from './types';

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
    it('should call labels endpoint', () => {
      const languageProvider = new LanguageProvider({
        ...defaultDatasource,
        hasLabelsMatchAPISupport: () => true,
      } as PrometheusDatasource);
      const getSeriesLabels = languageProvider.getSeriesLabels;
      const requestSpy = jest.spyOn(languageProvider, 'request');

      const labelName = 'job';
      const labelValue = 'grafana';
      getSeriesLabels(`{${labelName}="${labelValue}"}`, [{ name: labelName, value: labelValue, op: '=' }] as Label[]);
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
      getSeriesLabels(`{${labelName}="${labelValue}"}`, [{ name: labelName, value: labelValue, op: '=' }] as Label[]);
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
      getSeriesLabels(`{${labelName}="${labelValue}"}`, [{ name: labelName, value: labelValue, op: '=' }] as Label[]);
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
    it('should call old series endpoint and should use match[] parameter', () => {
      const languageProvider = new LanguageProvider({
        ...defaultDatasource,
      } as PrometheusDatasource);
      const getSeriesValues = languageProvider.getSeriesValues;
      const requestSpy = jest.spyOn(languageProvider, 'request');
      getSeriesValues('job', '{job="grafana"}');
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
      getSeriesValues(labelName, `{${labelName}="${labelValue}"}`);
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
      getSeriesValues('job', '{instance="$instance", job="grafana"}');
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
      await languageProvider.fetchSeries('{job="grafana"}');
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
      fetchSeriesLabels('$metric');
      expect(requestSpy).toHaveBeenCalled();
      expect(requestSpy).toHaveBeenCalledWith(
        '/api/v1/series',
        [],
        {
          end: toPrometheusTimeString,
          'match[]': 'interpolated-metric',
          start: fromPrometheusTimeString,
        },
        undefined
      );
    });
  });

  describe('fetchLabelValues', () => {
    it('should interpolate variable in series', () => {
      const languageProvider = new LanguageProvider({
        ...defaultDatasource,
        interpolateString: (string: string) => string.replace(/\$/, 'interpolated-'),
      } as PrometheusDatasource);
      const fetchLabelValues = languageProvider.fetchLabelValues;
      const requestSpy = jest.spyOn(languageProvider, 'request');
      fetchLabelValues('$job');
      expect(requestSpy).toHaveBeenCalled();
      expect(requestSpy).toHaveBeenCalledWith(
        '/api/v1/label/interpolated-job/values',
        [],
        {
          end: toPrometheusTimeString,
          start: fromPrometheusTimeString,
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
