import { HistoryItem, dateTime } from '@grafana/data';

import LokiLanguageProvider from '../../../LanguageProvider';
import { createLokiDatasource } from '../../../__mocks__/datasource';
import { LokiDatasource } from '../../../datasource';
import { LokiQuery } from '../../../types';

import { CompletionDataProvider } from './CompletionDataProvider';
import { Label } from './situation';

const history: Array<HistoryItem<LokiQuery>> = [
  {
    ts: 12345678,
    query: {
      refId: 'test-1',
      expr: '{test: unit}',
    },
  },
  {
    ts: 87654321,
    query: {
      refId: 'test-1',
      expr: '{unit: test}',
    },
  },
  {
    ts: 87654321,
    query: {
      refId: 'test-1',
      expr: '{unit: test}',
    },
  },
  {
    ts: 0,
    query: {
      refId: 'test-0',
      expr: '',
    },
  },
];
const labelKeys = ['place', 'source'];
const labelValues = ['moon', 'luna'];
const otherLabels: Label[] = [
  {
    name: 'place',
    value: 'luna',
    op: '=',
  },
];
const seriesLabels = { place: ['series', 'labels'], source: [], other: [] };
const parserAndLabelKeys = {
  extractedLabelKeys: ['extracted', 'label', 'keys'],
  unwrapLabelKeys: ['unwrap', 'labels'],
  structuredMetadataKeys: ['structured', 'metadata'],
  hasJSON: true,
  hasLogfmt: false,
  hasPack: false,
};

const mockTimeRange = {
  from: dateTime(1546372800000),
  to: dateTime(1546380000000),
  raw: {
    from: dateTime(1546372800000),
    to: dateTime(1546380000000),
  },
};

describe('CompletionDataProvider', () => {
  let completionProvider: CompletionDataProvider, languageProvider: LokiLanguageProvider, datasource: LokiDatasource;
  let historyRef: { current: Array<HistoryItem<LokiQuery>> } = { current: [] };
  beforeEach(() => {
    datasource = createLokiDatasource();
    languageProvider = new LokiLanguageProvider(datasource);
    historyRef.current = history;

    completionProvider = new CompletionDataProvider(languageProvider, historyRef, mockTimeRange);

    jest.spyOn(languageProvider, 'getLabelKeys').mockReturnValue(labelKeys);
    jest.spyOn(languageProvider, 'fetchLabelValues').mockResolvedValue(labelValues);
    jest.spyOn(languageProvider, 'fetchSeriesLabels').mockResolvedValue(seriesLabels);
    jest.spyOn(languageProvider, 'getParserAndLabelKeys').mockResolvedValue(parserAndLabelKeys);
  });

  test('Returns the expected history entries', () => {
    expect(completionProvider.getHistory()).toEqual(['{test: unit}', '{unit: test}']);
  });

  test('Processes updates to the current historyRef value', () => {
    expect(completionProvider.getHistory()).toEqual(['{test: unit}', '{unit: test}']);

    historyRef.current = [
      {
        ts: 87654321,
        query: {
          refId: 'test-2',
          expr: '{value="other"}',
        },
      },
    ];

    expect(completionProvider.getHistory()).toEqual(['{value="other"}']);
  });

  test('Returns the expected label names with no other labels', async () => {
    expect(await completionProvider.getLabelNames([])).toEqual(labelKeys);
  });

  test('Returns the expected label names with other labels', async () => {
    expect(await completionProvider.getLabelNames(otherLabels)).toEqual(['source', 'other']);
  });

  test('Returns the expected label values with no other labels', async () => {
    expect(await completionProvider.getLabelValues('label', [])).toEqual(labelValues);
  });

  test('Returns the expected label values with other labels', async () => {
    expect(await completionProvider.getLabelValues('place', otherLabels)).toEqual(['series', 'labels']);
    expect(await completionProvider.getLabelValues('other label', otherLabels)).toEqual([]);
  });

  test('Returns the expected parser and label keys', async () => {
    expect(await completionProvider.getParserAndLabelKeys('')).toEqual(parserAndLabelKeys);
    expect(languageProvider.getParserAndLabelKeys).toHaveBeenCalledTimes(1);
  });

  test('Returns the expected parser and label keys, cache duplicate query', async () => {
    expect(await completionProvider.getParserAndLabelKeys('')).toEqual(parserAndLabelKeys);
    expect(await completionProvider.getParserAndLabelKeys('')).toEqual(parserAndLabelKeys);

    expect(languageProvider.getParserAndLabelKeys).toHaveBeenCalledTimes(1);
  });

  test('Returns the expected parser and label keys, unique query is not cached', async () => {
    //1
    expect(await completionProvider.getParserAndLabelKeys('')).toEqual(parserAndLabelKeys);
    expect(await completionProvider.getParserAndLabelKeys('')).toEqual(parserAndLabelKeys);

    //2
    expect(await completionProvider.getParserAndLabelKeys('unique')).toEqual(parserAndLabelKeys);
    expect(await completionProvider.getParserAndLabelKeys('unique')).toEqual(parserAndLabelKeys);

    // 3
    expect(await completionProvider.getParserAndLabelKeys('uffdah')).toEqual(parserAndLabelKeys);

    // 4
    expect(await completionProvider.getParserAndLabelKeys('')).toEqual(parserAndLabelKeys);

    expect(languageProvider.getParserAndLabelKeys).toHaveBeenCalledTimes(4);
  });

  test('Returns the expected parser and label keys, cache size is 2', async () => {
    //1
    expect(await completionProvider.getParserAndLabelKeys('')).toEqual(parserAndLabelKeys);
    expect(await completionProvider.getParserAndLabelKeys('')).toEqual(parserAndLabelKeys);

    //2
    expect(await completionProvider.getParserAndLabelKeys('unique')).toEqual(parserAndLabelKeys);
    expect(await completionProvider.getParserAndLabelKeys('unique')).toEqual(parserAndLabelKeys);

    // 2
    expect(await completionProvider.getParserAndLabelKeys('')).toEqual(parserAndLabelKeys);
    expect(await completionProvider.getParserAndLabelKeys('')).toEqual(parserAndLabelKeys);
    expect(languageProvider.getParserAndLabelKeys).toHaveBeenCalledTimes(2);

    // 3
    expect(await completionProvider.getParserAndLabelKeys('new')).toEqual(parserAndLabelKeys);
    expect(await completionProvider.getParserAndLabelKeys('unique')).toEqual(parserAndLabelKeys);
    expect(languageProvider.getParserAndLabelKeys).toHaveBeenCalledTimes(3);

    // 4
    expect(await completionProvider.getParserAndLabelKeys('')).toEqual(parserAndLabelKeys);
    expect(await completionProvider.getParserAndLabelKeys('')).toEqual(parserAndLabelKeys);
    expect(languageProvider.getParserAndLabelKeys).toHaveBeenCalledTimes(4);
  });

  test('Uses time range from CompletionProvider', async () => {
    completionProvider.getParserAndLabelKeys('');
    expect(languageProvider.getParserAndLabelKeys).toHaveBeenCalledWith('', { timeRange: mockTimeRange });
  });

  test('Returns the expected series labels', async () => {
    expect(await completionProvider.getSeriesLabels([])).toEqual(seriesLabels);
  });

  test('Escapes correct characters when building stream selector in getSeriesLabels', async () => {
    completionProvider.getSeriesLabels([{ name: 'job', op: '=', value: '"a\\b\n' }]);
    expect(languageProvider.fetchSeriesLabels).toHaveBeenCalledWith('{job="\\"a\\\\b\\n"}', {
      timeRange: mockTimeRange,
    });
  });
});
