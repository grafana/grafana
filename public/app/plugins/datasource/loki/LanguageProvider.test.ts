import { AbstractLabelOperator, DataFrame, TimeRange, dateTime, getDefaultTimeRange } from '@grafana/data';
import { config } from '@grafana/runtime';

import LanguageProvider from './LanguageProvider';
import { createLokiDatasource } from './__mocks__/datasource';
import { createMetadataRequest } from './__mocks__/metadataRequest';
import { DEFAULT_MAX_LINES_SAMPLE, LokiDatasource } from './datasource';
import {
  extractLogParserFromDataFrame,
  extractLabelKeysFromDataFrame,
  extractUnwrapLabelKeysFromDataFrame,
} from './responseUtils';
import { LabelType, LokiQueryType } from './types';

jest.mock('./responseUtils');

const mockTimeRange = {
  from: dateTime(1546372800000),
  to: dateTime(1546380000000),
  raw: {
    from: dateTime(1546372800000),
    to: dateTime(1546380000000),
  },
};

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  getDefaultTimeRange: jest.fn().mockImplementation(() => ({
    from: dateTime(0),
    to: dateTime(1),
    raw: {
      from: dateTime(0),
      to: dateTime(1),
    },
  })),
}));

describe('Language completion provider', () => {
  describe('start', () => {
    const datasource = setup({ testkey: ['label1_val1', 'label1_val2'], label2: [] });

    it('should fetch labels on initial start', async () => {
      const languageProvider = new LanguageProvider(datasource);
      const fetchSpy = jest.spyOn(languageProvider, 'fetchLabels').mockResolvedValue([]);
      await languageProvider.start();
      expect(fetchSpy).toHaveBeenCalled();
    });

    it('should not again fetch labels on second start', async () => {
      const languageProvider = new LanguageProvider(datasource);
      const fetchSpy = jest.spyOn(languageProvider, 'fetchLabels').mockResolvedValue([]);
      await languageProvider.start();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      await languageProvider.start();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('should again fetch labels on second start with different timerange', async () => {
      const languageProvider = new LanguageProvider(datasource);
      const fetchSpy = jest.spyOn(languageProvider, 'fetchLabels').mockResolvedValue([]);
      await languageProvider.start();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      await languageProvider.start(mockTimeRange);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('fetchSeries', () => {
    it('should use match[] parameter', () => {
      const datasource = setup({}, { '{foo="bar"}': [{ label1: 'label_val1' }] });
      const languageProvider = new LanguageProvider(datasource);
      const fetchSeries = languageProvider.fetchSeries;
      const requestSpy = jest.spyOn(languageProvider, 'request');
      fetchSeries('{job="grafana"}');
      expect(requestSpy).toHaveBeenCalledWith('series', {
        end: 1560163909000,
        'match[]': '{job="grafana"}',
        start: 1560153109000,
      });
    });

    it('should use provided time range', () => {
      const datasource = setup({});
      datasource.getTimeRangeParams = jest
        .fn()
        .mockImplementation((range: TimeRange) => ({ start: range.from.valueOf(), end: range.to.valueOf() }));
      const languageProvider = new LanguageProvider(datasource);
      languageProvider.request = jest.fn();
      languageProvider.fetchSeries('{job="grafana"}', { timeRange: mockTimeRange });
      // time range was passed to getTimeRangeParams
      expect(datasource.getTimeRangeParams).toHaveBeenCalledWith(mockTimeRange);
      // time range was passed to request
      expect(languageProvider.request).toHaveBeenCalled();
      expect(languageProvider.request).toHaveBeenCalledWith('series', {
        end: 1546380000000,
        'match[]': '{job="grafana"}',
        start: 1546372800000,
      });
    });
  });

  describe('fetchSeriesLabels', () => {
    it('should interpolate variable in series', () => {
      const datasource = setup({});
      jest.spyOn(datasource, 'getTimeRangeParams').mockReturnValue({ start: 0, end: 1 });
      jest
        .spyOn(datasource, 'interpolateString')
        .mockImplementation((string: string) => string.replace(/\$/, 'interpolated-'));

      const languageProvider = new LanguageProvider(datasource);
      const fetchSeriesLabels = languageProvider.fetchSeriesLabels;
      const requestSpy = jest.spyOn(languageProvider, 'request').mockResolvedValue([]);
      fetchSeriesLabels('$stream');
      expect(requestSpy).toHaveBeenCalled();
      expect(requestSpy).toHaveBeenCalledWith('series', {
        end: 1,
        'match[]': 'interpolated-stream',
        start: 0,
      });
    });

    it('should be called with time range params if provided', () => {
      const datasource = setup({});
      datasource.getTimeRangeParams = jest
        .fn()
        .mockImplementation((range: TimeRange) => ({ start: range.from.valueOf(), end: range.to.valueOf() }));
      const languageProvider = new LanguageProvider(datasource);
      languageProvider.request = jest.fn().mockResolvedValue([]);
      languageProvider.fetchSeriesLabels('stream', { timeRange: mockTimeRange });
      // time range was passed to getTimeRangeParams
      expect(datasource.getTimeRangeParams).toHaveBeenCalled();
      expect(datasource.getTimeRangeParams).toHaveBeenCalledWith(mockTimeRange);
      // time range was passed to request
      expect(languageProvider.request).toHaveBeenCalled();
      expect(languageProvider.request).toHaveBeenCalledWith('series', {
        end: 1546380000000,
        'match[]': 'stream',
        start: 1546372800000,
      });
    });

    it('should work if request returns undefined', async () => {
      const datasource = setup({});
      datasource.getTimeRangeParams = jest
        .fn()
        .mockImplementation((range: TimeRange) => ({ start: range.from.valueOf(), end: range.to.valueOf() }));
      const languageProvider = new LanguageProvider(datasource);
      languageProvider.request = jest.fn().mockResolvedValue(undefined);
      const series = await languageProvider.fetchSeriesLabels('stream', { timeRange: mockTimeRange });
      expect(series).toEqual({});
    });
  });

  describe('fetchLabelValues', () => {
    it('should fetch label values if not cached', async () => {
      const datasource = setup({ testkey: ['label1_val1', 'label1_val2'], label2: [] });
      const provider = await getLanguageProvider(datasource);
      const requestSpy = jest.spyOn(provider, 'request');
      const labelValues = await provider.fetchLabelValues('testkey');
      expect(requestSpy).toHaveBeenCalledWith('label/testkey/values', {
        end: 1560163909000,
        start: 1560153109000,
      });
      expect(labelValues).toEqual(['label1_val1', 'label1_val2']);
    });

    it('fetch label when options.streamSelector provided and values is not cached', async () => {
      const datasource = setup({ testkey: ['label1_val1', 'label1_val2'], label2: [] });
      const provider = await getLanguageProvider(datasource);
      const requestSpy = jest.spyOn(provider, 'request');
      const labelValues = await provider.fetchLabelValues('testkey', { streamSelector: '{foo="bar"}' });
      expect(requestSpy).toHaveBeenCalledWith('label/testkey/values', {
        end: 1560163909000,
        query: '{foo="bar"}',
        start: 1560153109000,
      });
      expect(labelValues).toEqual(['label1_val1', 'label1_val2']);
    });

    it('fetch label with options.timeRange when provided and values is not cached', async () => {
      const datasource = setup({ testkey: ['label1_val1', 'label1_val2'], label2: [] });
      datasource.getTimeRangeParams = jest
        .fn()
        .mockImplementation((range: TimeRange) => ({ start: range.from.valueOf(), end: range.to.valueOf() }));
      const languageProvider = new LanguageProvider(datasource);
      languageProvider.request = jest.fn().mockResolvedValue([]);
      languageProvider.fetchLabelValues('testKey', { timeRange: mockTimeRange });
      // time range was passed to getTimeRangeParams
      expect(datasource.getTimeRangeParams).toHaveBeenCalled();
      expect(datasource.getTimeRangeParams).toHaveBeenCalledWith(mockTimeRange);
      // time range was passed to request
      expect(languageProvider.request).toHaveBeenCalled();
      expect(languageProvider.request).toHaveBeenCalledWith('label/testKey/values', {
        end: 1546380000000,
        start: 1546372800000,
      });
    });

    it('uses default time range if fetch label does not receive options.timeRange', async () => {
      const datasource = setup({ testkey: ['label1_val1', 'label1_val2'], label2: [] });
      datasource.getTimeRangeParams = jest
        .fn()
        .mockImplementation((range: TimeRange) => ({ start: range.from.valueOf(), end: range.to.valueOf() }));
      const languageProvider = new LanguageProvider(datasource);
      languageProvider.request = jest.fn().mockResolvedValue([]);
      languageProvider.fetchLabelValues('testKey');
      expect(getDefaultTimeRange).toHaveBeenCalled();
      expect(languageProvider.request).toHaveBeenCalled();
      expect(languageProvider.request).toHaveBeenCalledWith('label/testKey/values', {
        end: 1,
        start: 0,
      });
    });

    it('should return cached values', async () => {
      const datasource = setup({ testkey: ['label1_val1', 'label1_val2'], label2: [] });
      const provider = await getLanguageProvider(datasource);
      const requestSpy = jest.spyOn(provider, 'request');
      const labelValues = await provider.fetchLabelValues('testkey');
      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect(labelValues).toEqual(['label1_val1', 'label1_val2']);

      const nextLabelValues = await provider.fetchLabelValues('testkey');
      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect(requestSpy).toHaveBeenCalledWith('label/testkey/values', {
        end: 1560163909000,
        start: 1560153109000,
      });
      expect(nextLabelValues).toEqual(['label1_val1', 'label1_val2']);
    });

    it('should return cached values when options.streamSelector provided', async () => {
      const datasource = setup({ testkey: ['label1_val1', 'label1_val2'], label2: [] });
      const provider = await getLanguageProvider(datasource);
      const requestSpy = jest.spyOn(provider, 'request');
      const labelValues = await provider.fetchLabelValues('testkey', { streamSelector: '{foo="bar"}' });
      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect(requestSpy).toHaveBeenCalledWith('label/testkey/values', {
        end: 1560163909000,
        query: '{foo="bar"}',
        start: 1560153109000,
      });
      expect(labelValues).toEqual(['label1_val1', 'label1_val2']);

      const nextLabelValues = await provider.fetchLabelValues('testkey', { streamSelector: '{foo="bar"}' });
      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect(nextLabelValues).toEqual(['label1_val1', 'label1_val2']);
    });

    it('should encode special characters', async () => {
      const datasource = setup({ '`\\"testkey': ['label1_val1', 'label1_val2'], label2: [] });
      const provider = await getLanguageProvider(datasource);
      const requestSpy = jest.spyOn(provider, 'request');
      await provider.fetchLabelValues('`\\"testkey');

      expect(requestSpy).toHaveBeenCalledWith('label/%60%5C%22testkey/values', expect.any(Object));
    });

    it('should encode special characters in options.streamSelector', async () => {
      const datasource = setup({ '`\\"testkey': ['label1_val1', 'label1_val2'], label2: [] });
      const provider = await getLanguageProvider(datasource);
      const requestSpy = jest.spyOn(provider, 'request');
      await provider.fetchLabelValues('`\\"testkey', { streamSelector: '{foo="\\bar"}' });

      expect(requestSpy).toHaveBeenCalledWith(expect.any(String), {
        query: '{foo="\\bar"}',
        start: expect.any(Number),
        end: expect.any(Number),
      });
    });

    it('should use a single promise to resolve values', async () => {
      const datasource = setup({ testkey: ['label1_val1', 'label1_val2'], label2: [] });
      const provider = await getLanguageProvider(datasource);
      const requestSpy = jest.spyOn(provider, 'request');
      const promise1 = provider.fetchLabelValues('testkey');
      const promise2 = provider.fetchLabelValues('testkey');
      const promise3 = provider.fetchLabelValues('testkeyNOPE');
      expect(requestSpy).toHaveBeenCalledTimes(2);

      const values1 = await promise1;
      const values2 = await promise2;
      const values3 = await promise3;

      expect(values1).toStrictEqual(values2);
      expect(values2).not.toStrictEqual(values3);
      expect(requestSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('fetchLabels', () => {
    it('should return labels', async () => {
      const datasourceWithLabels = setup({ other: [] });

      const instance = new LanguageProvider(datasourceWithLabels);
      const labels = await instance.fetchLabels();
      expect(labels).toEqual(['other']);
    });

    it('should set labels', async () => {
      const datasourceWithLabels = setup({ other: [] });

      const instance = new LanguageProvider(datasourceWithLabels);
      await instance.fetchLabels();
      expect(instance.labelKeys).toEqual(['other']);
    });

    it('should return empty array', async () => {
      const datasourceWithLabels = setup({});

      const instance = new LanguageProvider(datasourceWithLabels);
      const labels = await instance.fetchLabels();
      expect(labels).toEqual([]);
    });

    it('should set empty array', async () => {
      const datasourceWithLabels = setup({});

      const instance = new LanguageProvider(datasourceWithLabels);
      await instance.fetchLabels();
      expect(instance.labelKeys).toEqual([]);
    });

    it('should use time range param', async () => {
      const datasourceWithLabels = setup({});
      datasourceWithLabels.languageProvider.request = jest.fn();

      const instance = new LanguageProvider(datasourceWithLabels);
      instance.request = jest.fn();
      await instance.fetchLabels({ timeRange: mockTimeRange });
      expect(instance.request).toHaveBeenCalledWith('labels', datasourceWithLabels.getTimeRangeParams(mockTimeRange));
    });

    it('should use series endpoint for request with stream selector', async () => {
      const datasourceWithLabels = setup({});
      datasourceWithLabels.languageProvider.request = jest.fn();

      const instance = new LanguageProvider(datasourceWithLabels);
      instance.request = jest.fn();
      await instance.fetchLabels({ streamSelector: '{foo="bar"}' });
      expect(instance.request).toHaveBeenCalledWith('series', {
        end: 1560163909000,
        'match[]': '{foo="bar"}',
        start: 1560153109000,
      });
    });
  });
});

describe('Request URL', () => {
  it('should contain range params', async () => {
    const datasourceWithLabels = setup({ other: [] });
    const rangeParams = datasourceWithLabels.getTimeRangeParams(mockTimeRange);
    const datasourceSpy = jest.spyOn(datasourceWithLabels, 'metadataRequest');

    const instance = new LanguageProvider(datasourceWithLabels);
    instance.fetchLabels();
    const expectedUrl = 'labels';
    expect(datasourceSpy).toHaveBeenCalledWith(expectedUrl, rangeParams);
  });
});

describe('Query imports', () => {
  const datasource = setup({});

  describe('importing from abstract query', () => {
    it('returns empty queries', async () => {
      const instance = new LanguageProvider(datasource);
      const result = await instance.importFromAbstractQuery({ refId: 'bar', labelMatchers: [] });
      expect(result).toEqual({ refId: 'bar', expr: '', queryType: LokiQueryType.Range });
    });

    it('returns valid query', () => {
      const instance = new LanguageProvider(datasource);
      const result = instance.importFromAbstractQuery({
        refId: 'bar',
        labelMatchers: [
          { name: 'label1', operator: AbstractLabelOperator.Equal, value: 'value1' },
          { name: 'label2', operator: AbstractLabelOperator.NotEqual, value: 'value2' },
          { name: 'label3', operator: AbstractLabelOperator.EqualRegEx, value: 'value3' },
          { name: 'label4', operator: AbstractLabelOperator.NotEqualRegEx, value: 'value4' },
        ],
      });
      expect(result).toEqual({
        refId: 'bar',
        expr: '{label1="value1", label2!="value2", label3=~"value3", label4!~"value4"}',
        queryType: LokiQueryType.Range,
      });
    });
  });

  describe('exporting to abstract query', () => {
    it('exports labels', async () => {
      const instance = new LanguageProvider(datasource);
      const abstractQuery = instance.exportToAbstractQuery({
        refId: 'bar',
        expr: '{label1="value1", label2!="value2", label3=~"value3", label4!~"value4"}',
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
        ],
      });
    });

    it('exports labels in metric query', async () => {
      const instance = new LanguageProvider(datasource);
      const abstractQuery = instance.exportToAbstractQuery({
        refId: 'bar',
        expr: 'rate({label1="value1", label2!="value2"}[5m])',
        instant: true,
        range: false,
      });
      expect(abstractQuery).toMatchObject({
        refId: 'bar',
        labelMatchers: [
          { name: 'label1', operator: AbstractLabelOperator.Equal, value: 'value1' },
          { name: 'label2', operator: AbstractLabelOperator.NotEqual, value: 'value2' },
        ],
      });
    });

    it('exports labels in query with multiple stream selectors', async () => {
      const instance = new LanguageProvider(datasource);
      const abstractQuery = instance.exportToAbstractQuery({
        refId: 'bar',
        expr: 'rate({label1="value1", label2!="value2"}[5m]) + rate({label3=~"value3", label4!~"value4"}[5m])',
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
        ],
      });
    });
  });

  describe('getParserAndLabelKeys()', () => {
    const queryHintsFeatureToggle = config.featureToggles.lokiQueryHints;
    beforeAll(() => {
      config.featureToggles.lokiQueryHints = true;
    });
    afterAll(() => {
      config.featureToggles.lokiQueryHints = queryHintsFeatureToggle;
    });

    let datasource: LokiDatasource, languageProvider: LanguageProvider;
    const extractLogParserFromDataFrameMock = jest.mocked(extractLogParserFromDataFrame);
    const extractedLabelKeys = ['extracted', 'label'];
    const structuredMetadataKeys = ['structured', 'metadata'];
    const parsedKeys = ['parsed', 'label'];
    const unwrapLabelKeys = ['unwrap', 'labels'];

    beforeEach(() => {
      datasource = createLokiDatasource();
      languageProvider = new LanguageProvider(datasource);
      jest.mocked(extractLabelKeysFromDataFrame).mockImplementation((_, type) => {
        if (type === LabelType.Indexed || !type) {
          return extractedLabelKeys;
        } else if (type === LabelType.StructuredMetadata) {
          return structuredMetadataKeys;
        } else if (type === LabelType.Parsed) {
          return parsedKeys;
        } else {
          return [];
        }
      });
      jest.mocked(extractUnwrapLabelKeysFromDataFrame).mockReturnValue(unwrapLabelKeys);
    });

    it('identifies selectors with JSON parser data', async () => {
      jest.spyOn(datasource, 'getDataSamples').mockResolvedValue([{}] as DataFrame[]);
      extractLogParserFromDataFrameMock.mockReturnValueOnce({ hasLogfmt: false, hasJSON: true, hasPack: false });

      expect(await languageProvider.getParserAndLabelKeys('{place="luna"}')).toEqual({
        extractedLabelKeys: [...extractedLabelKeys, ...parsedKeys],
        unwrapLabelKeys,
        structuredMetadataKeys,
        hasJSON: true,
        hasLogfmt: false,
        hasPack: false,
      });
    });

    it('identifies selectors with Logfmt parser data', async () => {
      jest.spyOn(datasource, 'getDataSamples').mockResolvedValue([{}] as DataFrame[]);
      extractLogParserFromDataFrameMock.mockReturnValueOnce({ hasLogfmt: true, hasJSON: false, hasPack: false });

      expect(await languageProvider.getParserAndLabelKeys('{place="luna"}')).toEqual({
        extractedLabelKeys: [...extractedLabelKeys, ...parsedKeys],
        unwrapLabelKeys,
        structuredMetadataKeys,
        hasJSON: false,
        hasLogfmt: true,
        hasPack: false,
      });
    });

    it('correctly processes empty data', async () => {
      jest.spyOn(datasource, 'getDataSamples').mockResolvedValue([]);
      extractLogParserFromDataFrameMock.mockClear();

      expect(await languageProvider.getParserAndLabelKeys('{place="luna"}')).toEqual({
        extractedLabelKeys: [],
        unwrapLabelKeys: [],
        structuredMetadataKeys: [],
        hasJSON: false,
        hasLogfmt: false,
        hasPack: false,
      });
      expect(extractLogParserFromDataFrameMock).not.toHaveBeenCalled();
    });

    it('calls dataSample with correct default maxLines', async () => {
      jest.spyOn(datasource, 'getDataSamples').mockResolvedValue([]);

      expect(await languageProvider.getParserAndLabelKeys('{place="luna"}')).toEqual({
        extractedLabelKeys: [],
        unwrapLabelKeys: [],
        structuredMetadataKeys: [],
        hasJSON: false,
        hasLogfmt: false,
        hasPack: false,
      });
      expect(datasource.getDataSamples).toHaveBeenCalledWith(
        {
          expr: '{place="luna"}',
          maxLines: DEFAULT_MAX_LINES_SAMPLE,
          refId: 'data-samples',
        },
        getDefaultTimeRange()
      );
    });

    it('calls dataSample with correctly set sampleSize', async () => {
      jest.spyOn(datasource, 'getDataSamples').mockResolvedValue([]);

      expect(await languageProvider.getParserAndLabelKeys('{place="luna"}', { maxLines: 5 })).toEqual({
        extractedLabelKeys: [],
        unwrapLabelKeys: [],
        structuredMetadataKeys: [],
        hasJSON: false,
        hasLogfmt: false,
        hasPack: false,
      });
      expect(datasource.getDataSamples).toHaveBeenCalledWith(
        {
          expr: '{place="luna"}',
          maxLines: 5,
          refId: 'data-samples',
        },
        getDefaultTimeRange()
      );
    });

    it('calls dataSample with correctly set time range', async () => {
      jest.spyOn(datasource, 'getDataSamples').mockResolvedValue([]);
      languageProvider.getParserAndLabelKeys('{place="luna"}', { timeRange: mockTimeRange });
      expect(datasource.getDataSamples).toHaveBeenCalledWith(
        {
          expr: '{place="luna"}',
          maxLines: 10,
          refId: 'data-samples',
        },
        mockTimeRange
      );
    });
    it('does not call dataSample with feature toggle disabled', async () => {
      config.featureToggles.lokiQueryHints = false;
      jest.spyOn(datasource, 'getDataSamples');
      languageProvider.getParserAndLabelKeys('{place="luna"}', { timeRange: mockTimeRange });
      expect(datasource.getDataSamples).not.toHaveBeenCalled();
    });
  });
});

async function getLanguageProvider(datasource: LokiDatasource) {
  const instance = new LanguageProvider(datasource);
  await instance.start();
  return instance;
}

function setup(
  labelsAndValues: Record<string, string[]>,
  series?: Record<string, Array<Record<string, string>>>
): LokiDatasource {
  const datasource = createLokiDatasource();

  const rangeMock = {
    start: 1560153109000,
    end: 1560163909000,
  };

  jest.spyOn(datasource, 'getTimeRangeParams').mockReturnValue(rangeMock);
  jest.spyOn(datasource, 'metadataRequest').mockImplementation(createMetadataRequest(labelsAndValues, series));
  jest.spyOn(datasource, 'interpolateString').mockImplementation((string: string) => string);

  return datasource;
}
