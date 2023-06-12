import { Editor as SlateEditor } from 'slate';
import Plain from 'slate-plain-serializer';

import { AbstractLabelOperator, dateTime, HistoryItem, TimeRange } from '@grafana/data';
import { config } from '@grafana/runtime';
import { SearchFunctionType } from '@grafana/ui';

import { Label } from './components/monaco-query-field/monaco-completion-provider/situation';
import { PrometheusDatasource } from './datasource';
import LanguageProvider from './language_provider';
import { getClientCacheDurationInMinutes, getPrometheusTime, getRangeSnapInterval } from './language_utils';
import { PrometheusCacheLevel, PromQuery } from './types';

const now = new Date(1681300293392).getTime();
const timeRangeDurationSeconds = 1;
const toPrometheusTime = getPrometheusTime(dateTime(now), false);
const fromPrometheusTime = getPrometheusTime(dateTime(now - timeRangeDurationSeconds * 1000), false);
const toPrometheusTimeString = toPrometheusTime.toString(10);
const fromPrometheusTimeString = fromPrometheusTime.toString(10);

const getTimeRangeParams = (override?: Partial<{ start: string; end: string }>): { start: string; end: string } => ({
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

  // @todo clean up prometheusResourceBrowserCache feature flag
  describe('getSeriesLabelsDeprecatedLRU', () => {
    beforeEach(() => {
      config.featureToggles.prometheusResourceBrowserCache = false;
    });
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
      expect(requestSpy).toHaveBeenCalledWith(`/api/v1/labels`, [], {
        end: toPrometheusTimeString,
        'match[]': '{job="grafana"}',
        start: fromPrometheusTimeString,
      });
    });

    it('should call series endpoint', () => {
      const languageProvider = new LanguageProvider({
        ...defaultDatasource,
        getAdjustedInterval: () => getRangeSnapInterval(PrometheusCacheLevel.None, getMockQuantizedTimeRangeParams()),
      } as PrometheusDatasource);
      const getSeriesLabels = languageProvider.getSeriesLabels;
      const requestSpy = jest.spyOn(languageProvider, 'request');

      const labelName = 'job';
      const labelValue = 'grafana';
      getSeriesLabels(`{${labelName}="${labelValue}"}`, [{ name: labelName, value: labelValue, op: '=' }] as Label[]);
      expect(requestSpy).toHaveBeenCalled();
      expect(requestSpy).toHaveBeenCalledWith('/api/v1/series', [], {
        end: toPrometheusTimeString,
        'match[]': '{job="grafana"}',
        start: fromPrometheusTimeString,
      });
    });
  });
  describe('getSeriesLabels', () => {
    beforeEach(() => {
      config.featureToggles.prometheusResourceBrowserCache = true;
    });
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
        getAdjustedInterval: () => getRangeSnapInterval(PrometheusCacheLevel.None, getMockQuantizedTimeRangeParams()),
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
        getAdjustedInterval: () => getRangeSnapInterval(PrometheusCacheLevel.Low, getMockQuantizedTimeRangeParams()),
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
  });

  describe('fetchSeries', () => {
    it('should use match[] parameter', () => {
      const languageProvider = new LanguageProvider(defaultDatasource);
      const fetchSeries = languageProvider.fetchSeries;
      const requestSpy = jest.spyOn(languageProvider, 'request');
      fetchSeries('{job="grafana"}');
      expect(requestSpy).toHaveBeenCalled();
      expect(requestSpy).toHaveBeenCalledWith(
        '/api/v1/series',
        {},
        { end: toPrometheusTimeString, 'match[]': '{job="grafana"}', start: fromPrometheusTimeString },
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

  describe('empty query suggestions', () => {
    it('returns no suggestions on empty context', async () => {
      const instance = new LanguageProvider(defaultDatasource);
      const value = Plain.deserialize('');
      const result = await instance.provideCompletionItems({ text: '', prefix: '', value, wrapperClasses: [] });
      expect(result.context).toBeUndefined();
      expect(result.suggestions).toMatchObject([]);
    });

    it('returns no suggestions with metrics on empty context even when metrics were provided', async () => {
      const instance = new LanguageProvider(defaultDatasource);
      instance.metrics = ['foo', 'bar'];
      const value = Plain.deserialize('');
      const result = await instance.provideCompletionItems({ text: '', prefix: '', value, wrapperClasses: [] });
      expect(result.context).toBeUndefined();
      expect(result.suggestions).toMatchObject([]);
    });

    it('returns history on empty context when history was provided', async () => {
      const instance = new LanguageProvider(defaultDatasource);
      const value = Plain.deserialize('');
      const history: Array<HistoryItem<PromQuery>> = [
        {
          ts: 0,
          query: { refId: '1', expr: 'metric' },
        },
      ];
      const result = await instance.provideCompletionItems(
        { text: '', prefix: '', value, wrapperClasses: [] },
        { history }
      );
      expect(result.context).toBeUndefined();

      expect(result.suggestions).toMatchObject([
        {
          label: 'History',
          items: [
            {
              label: 'metric',
            },
          ],
        },
      ]);
    });
  });

  describe('range suggestions', () => {
    it('returns range suggestions in range context', async () => {
      const instance = new LanguageProvider(defaultDatasource);
      const value = Plain.deserialize('1');
      const result = await instance.provideCompletionItems({
        text: '1',
        prefix: '1',
        value,
        wrapperClasses: ['context-range'],
      });
      expect(result.context).toBe('context-range');
      expect(result.suggestions).toMatchObject([
        {
          items: [
            { label: '$__interval', sortValue: '$__interval' },
            { label: '$__rate_interval', sortValue: '$__rate_interval' },
            { label: '$__range', sortValue: '$__range' },
            { label: '1m', sortValue: '00:01:00' },
            { label: '5m', sortValue: '00:05:00' },
            { label: '10m', sortValue: '00:10:00' },
            { label: '30m', sortValue: '00:30:00' },
            { label: '1h', sortValue: '01:00:00' },
            { label: '1d', sortValue: '24:00:00' },
          ],
          label: 'Range vector',
        },
      ]);
    });
  });

  describe('metric suggestions', () => {
    it('returns history, metrics and function suggestions in an uknown context ', async () => {
      const instance = new LanguageProvider(defaultDatasource);
      instance.metrics = ['foo', 'bar'];
      const history: Array<HistoryItem<PromQuery>> = [
        {
          ts: 0,
          query: { refId: '1', expr: 'metric' },
        },
      ];
      let value = Plain.deserialize('m');
      value = value.setSelection({ anchor: { offset: 1 }, focus: { offset: 1 } });
      // Even though no metric with `m` is present, we still get metric completion items, filtering is done by the consumer
      const result = await instance.provideCompletionItems(
        { text: 'm', prefix: 'm', value, wrapperClasses: [] },
        { history }
      );
      expect(result.context).toBeUndefined();
      expect(result.suggestions).toMatchObject([
        {
          label: 'History',
          items: [
            {
              label: 'metric',
            },
          ],
        },
        {
          label: 'Functions',
        },
        {
          label: 'Metrics',
        },
      ]);
    });

    it('returns no suggestions directly after a binary operator', async () => {
      const instance = new LanguageProvider(defaultDatasource);
      instance.metrics = ['foo', 'bar'];
      const value = Plain.deserialize('*');
      const result = await instance.provideCompletionItems({ text: '*', prefix: '', value, wrapperClasses: [] });
      expect(result.context).toBeUndefined();
      expect(result.suggestions).toMatchObject([]);
    });

    it('returns metric suggestions with prefix after a binary operator', async () => {
      const instance = new LanguageProvider(defaultDatasource);
      instance.metrics = ['foo', 'bar'];
      const value = Plain.deserialize('foo + b');
      const ed = new SlateEditor({ value });
      const valueWithSelection = ed.moveForward(7).value;
      const result = await instance.provideCompletionItems({
        text: 'foo + b',
        prefix: 'b',
        value: valueWithSelection,
        wrapperClasses: [],
      });
      expect(result.context).toBeUndefined();
      expect(result.suggestions).toMatchObject([
        {
          label: 'Functions',
        },
        {
          label: 'Metrics',
        },
      ]);
    });

    it('returns no suggestions at the beginning of a non-empty function', async () => {
      const instance = new LanguageProvider(defaultDatasource);
      const value = Plain.deserialize('sum(up)');
      const ed = new SlateEditor({ value });

      const valueWithSelection = ed.moveForward(4).value;
      const result = await instance.provideCompletionItems({
        text: '',
        prefix: '',
        value: valueWithSelection,
        wrapperClasses: [],
      });
      expect(result.context).toBeUndefined();
      expect(result.suggestions.length).toEqual(0);
    });
  });

  describe('label suggestions', () => {
    it('returns default label suggestions on label context and no metric', async () => {
      const instance = new LanguageProvider(defaultDatasource);
      const value = Plain.deserialize('{}');
      const ed = new SlateEditor({ value });
      const valueWithSelection = ed.moveForward(1).value;
      const result = await instance.provideCompletionItems({
        text: '',
        prefix: '',
        wrapperClasses: ['context-labels'],
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-labels');
      expect(result.suggestions).toEqual([
        {
          items: [{ label: 'job' }, { label: 'instance' }],
          label: 'Labels',
          searchFunctionType: SearchFunctionType.Fuzzy,
        },
      ]);
    });

    it('returns label suggestions on label context and metric', async () => {
      const datasources: PrometheusDatasource = {
        ...defaultDatasource,
        metadataRequest: () => ({ data: { data: [{ __name__: 'metric', bar: 'bazinga' }] } }),
      } as unknown as PrometheusDatasource;
      const instance = new LanguageProvider(datasources);
      const value = Plain.deserialize('metric{}');
      const ed = new SlateEditor({ value });
      const valueWithSelection = ed.moveForward(7).value;
      const result = await instance.provideCompletionItems({
        text: '',
        prefix: '',
        wrapperClasses: ['context-labels'],
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-labels');
      expect(result.suggestions).toEqual([
        { items: [{ label: 'bar' }], label: 'Labels', searchFunctionType: SearchFunctionType.Fuzzy },
      ]);
    });

    it('returns label suggestions on label context but leaves out labels that already exist', async () => {
      const testDatasource: PrometheusDatasource = {
        ...defaultDatasource,
        metadataRequest: () => ({
          data: {
            data: [
              {
                __name__: 'metric',
                bar: 'asdasd',
                job1: 'dsadsads',
                job2: 'fsfsdfds',
                job3: 'dsadsad',
              },
            ],
          },
        }),
      } as unknown as PrometheusDatasource;
      const instance = new LanguageProvider(testDatasource);
      const value = Plain.deserialize('{job1="foo",job2!="foo",job3=~"foo",__name__="metric",}');
      const ed = new SlateEditor({ value });
      const valueWithSelection = ed.moveForward(54).value;
      const result = await instance.provideCompletionItems({
        text: '',
        prefix: '',
        wrapperClasses: ['context-labels'],
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-labels');
      expect(result.suggestions).toEqual([
        { items: [{ label: 'bar' }], label: 'Labels', searchFunctionType: SearchFunctionType.Fuzzy },
      ]);
    });

    it('returns label value suggestions inside a label value context after a negated matching operator', async () => {
      const instance = new LanguageProvider({
        ...defaultDatasource,
        metadataRequest: () => {
          return { data: { data: ['value1', 'value2'] } };
        },
      } as unknown as PrometheusDatasource);
      const value = Plain.deserialize('{job!=}');
      const ed = new SlateEditor({ value });
      const valueWithSelection = ed.moveForward(6).value;
      const result = await instance.provideCompletionItems({
        text: '!=',
        prefix: '',
        wrapperClasses: ['context-labels'],
        labelKey: 'job',
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-label-values');
      expect(result.suggestions).toEqual([
        {
          items: [{ label: 'value1' }, { label: 'value2' }],
          label: 'Label values for "job"',
          searchFunctionType: SearchFunctionType.Fuzzy,
        },
      ]);
    });

    it('returns a refresher on label context and unavailable metric', async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      const instance = new LanguageProvider(defaultDatasource);
      const value = Plain.deserialize('metric{}');
      const ed = new SlateEditor({ value });
      const valueWithSelection = ed.moveForward(7).value;
      const result = await instance.provideCompletionItems({
        text: '',
        prefix: '',
        wrapperClasses: ['context-labels'],
        value: valueWithSelection,
      });
      expect(result.context).toBeUndefined();
      expect(result.suggestions).toEqual([]);
      expect(console.warn).toHaveBeenCalledWith('Server did not return any values for selector = {__name__="metric"}');
    });

    it('returns label values on label context when given a metric and a label key', async () => {
      const instance = new LanguageProvider({
        ...defaultDatasource,
        metadataRequest: () => simpleMetricLabelsResponse,
      } as unknown as PrometheusDatasource);
      const value = Plain.deserialize('metric{bar=ba}');
      const ed = new SlateEditor({ value });
      const valueWithSelection = ed.moveForward(13).value;
      const result = await instance.provideCompletionItems({
        text: '=ba',
        prefix: 'ba',
        wrapperClasses: ['context-labels'],
        labelKey: 'bar',
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-label-values');
      expect(result.suggestions).toEqual([
        { items: [{ label: 'baz' }], label: 'Label values for "bar"', searchFunctionType: SearchFunctionType.Fuzzy },
      ]);
    });

    it('returns label suggestions on aggregation context and metric w/ selector', async () => {
      const instance = new LanguageProvider({
        ...defaultDatasource,
        metadataRequest: () => simpleMetricLabelsResponse,
      } as unknown as PrometheusDatasource);
      const value = Plain.deserialize('sum(metric{foo="xx"}) by ()');
      const ed = new SlateEditor({ value });
      const valueWithSelection = ed.moveForward(26).value;
      const result = await instance.provideCompletionItems({
        text: '',
        prefix: '',
        wrapperClasses: ['context-aggregation'],
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-aggregation');
      expect(result.suggestions).toEqual([
        { items: [{ label: 'bar' }], label: 'Labels', searchFunctionType: SearchFunctionType.Fuzzy },
      ]);
    });

    it('returns label suggestions on aggregation context and metric w/o selector', async () => {
      const instance = new LanguageProvider({
        ...defaultDatasource,
        metadataRequest: () => simpleMetricLabelsResponse,
      } as unknown as PrometheusDatasource);
      const value = Plain.deserialize('sum(metric) by ()');
      const ed = new SlateEditor({ value });
      const valueWithSelection = ed.moveForward(16).value;
      const result = await instance.provideCompletionItems({
        text: '',
        prefix: '',
        wrapperClasses: ['context-aggregation'],
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-aggregation');
      expect(result.suggestions).toEqual([
        { items: [{ label: 'bar' }], label: 'Labels', searchFunctionType: SearchFunctionType.Fuzzy },
      ]);
    });

    it('returns label suggestions inside a multi-line aggregation context', async () => {
      const instance = new LanguageProvider({
        ...defaultDatasource,
        metadataRequest: () => simpleMetricLabelsResponse,
      } as unknown as PrometheusDatasource);
      const value = Plain.deserialize('sum(\nmetric\n)\nby ()');
      const aggregationTextBlock = value.document.getBlocks().get(3);
      const ed = new SlateEditor({ value });
      ed.moveToStartOfNode(aggregationTextBlock);
      const valueWithSelection = ed.moveForward(4).value;
      const result = await instance.provideCompletionItems({
        text: '',
        prefix: '',
        wrapperClasses: ['context-aggregation'],
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-aggregation');
      expect(result.suggestions).toEqual([
        {
          items: [{ label: 'bar' }],
          label: 'Labels',
          searchFunctionType: SearchFunctionType.Fuzzy,
        },
      ]);
    });

    it('returns label suggestions inside an aggregation context with a range vector', async () => {
      const instance = new LanguageProvider({
        ...defaultDatasource,
        metadataRequest: () => simpleMetricLabelsResponse,
      } as unknown as PrometheusDatasource);
      const value = Plain.deserialize('sum(rate(metric[1h])) by ()');
      const ed = new SlateEditor({ value });
      const valueWithSelection = ed.moveForward(26).value;
      const result = await instance.provideCompletionItems({
        text: '',
        prefix: '',
        wrapperClasses: ['context-aggregation'],
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-aggregation');
      expect(result.suggestions).toEqual([
        {
          items: [{ label: 'bar' }],
          label: 'Labels',
          searchFunctionType: SearchFunctionType.Fuzzy,
        },
      ]);
    });

    it('returns label suggestions inside an aggregation context with a range vector and label', async () => {
      const instance = new LanguageProvider({
        ...defaultDatasource,
        metadataRequest: () => simpleMetricLabelsResponse,
      } as unknown as PrometheusDatasource);
      const value = Plain.deserialize('sum(rate(metric{label1="value"}[1h])) by ()');
      const ed = new SlateEditor({ value });
      const valueWithSelection = ed.moveForward(42).value;
      const result = await instance.provideCompletionItems({
        text: '',
        prefix: '',
        wrapperClasses: ['context-aggregation'],
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-aggregation');
      expect(result.suggestions).toEqual([
        {
          items: [{ label: 'bar' }],
          label: 'Labels',
          searchFunctionType: SearchFunctionType.Fuzzy,
        },
      ]);
    });

    it('returns no suggestions inside an unclear aggregation context using alternate syntax', async () => {
      const instance = new LanguageProvider(defaultDatasource);
      const value = Plain.deserialize('sum by ()');
      const ed = new SlateEditor({ value });
      const valueWithSelection = ed.moveForward(8).value;
      const result = await instance.provideCompletionItems({
        text: '',
        prefix: '',
        wrapperClasses: ['context-aggregation'],
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-aggregation');
      expect(result.suggestions).toEqual([]);
    });

    it('returns label suggestions inside an aggregation context using alternate syntax', async () => {
      const instance = new LanguageProvider({
        ...defaultDatasource,
        metadataRequest: () => simpleMetricLabelsResponse,
      } as unknown as PrometheusDatasource);
      const value = Plain.deserialize('sum by () (metric)');
      const ed = new SlateEditor({ value });
      const valueWithSelection = ed.moveForward(8).value;
      const result = await instance.provideCompletionItems({
        text: '',
        prefix: '',
        wrapperClasses: ['context-aggregation'],
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-aggregation');
      expect(result.suggestions).toEqual([
        {
          items: [{ label: 'bar' }],
          label: 'Labels',
          searchFunctionType: SearchFunctionType.Fuzzy,
        },
      ]);
    });

    it('does not re-fetch default labels', async () => {
      const testDatasource: PrometheusDatasource = {
        ...defaultDatasource,
        metadataRequest: jest.fn(() => ({ data: { data: [] } })),
        interpolateString: (string: string) => string,
        getQuantizedTimeRangeParams: getMockQuantizedTimeRangeParams,
      } as unknown as PrometheusDatasource;

      const mockedMetadataRequest = jest.mocked(testDatasource.metadataRequest);

      const instance = new LanguageProvider(testDatasource);
      const value = Plain.deserialize('{}');
      const ed = new SlateEditor({ value });
      const valueWithSelection = ed.moveForward(1).value;
      const args = {
        text: '',
        prefix: '',
        wrapperClasses: ['context-labels'],
        value: valueWithSelection,
      };
      const promise1 = instance.provideCompletionItems(args);
      // one call for 2 default labels job, instance
      expect(mockedMetadataRequest.mock.calls.length).toBe(2);
      const promise2 = instance.provideCompletionItems(args);
      expect(mockedMetadataRequest.mock.calls.length).toBe(2);
      await Promise.all([promise1, promise2]);
      expect(mockedMetadataRequest.mock.calls.length).toBe(2);
    });
  });
  describe('disabled metrics lookup', () => {
    it('does not issue any metadata requests when lookup is disabled', async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      const datasource: PrometheusDatasource = {
        metadataRequest: jest.fn(() => ({ data: { data: ['foo', 'bar'] as string[] } })),
        lookupsDisabled: true,
      } as unknown as PrometheusDatasource;
      const mockedMetadataRequest = jest.mocked(datasource.metadataRequest);
      const instance = new LanguageProvider(datasource);
      const value = Plain.deserialize('{}');
      const ed = new SlateEditor({ value });
      const valueWithSelection = ed.moveForward(1).value;
      const args = {
        text: '',
        prefix: '',
        wrapperClasses: ['context-labels'],
        value: valueWithSelection,
      };

      expect(mockedMetadataRequest.mock.calls.length).toBe(0);
      await instance.start();
      expect(mockedMetadataRequest.mock.calls.length).toBe(0);
      await instance.provideCompletionItems(args);
      expect(mockedMetadataRequest.mock.calls.length).toBe(0);
      expect(console.warn).toHaveBeenCalledWith('Server did not return any values for selector = {}');
    });
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

const simpleMetricLabelsResponse = {
  data: {
    data: [
      {
        __name__: 'metric',
        bar: 'baz',
      },
    ],
  },
};
