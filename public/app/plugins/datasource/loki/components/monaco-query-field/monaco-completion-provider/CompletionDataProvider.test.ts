import { HistoryItem, dateTime } from '@grafana/data';

import LokiLanguageProvider from '../../../LanguageProvider';
import { LokiDatasource } from '../../../datasource';
import { createLokiDatasource } from '../../../mocks/datasource';
import { LokiQuery } from '../../../types';

import { CompletionDataProvider } from './CompletionDataProvider';
import { Label } from './situation';

const history: Array<HistoryItem<LokiQuery>> = [
  {
    ts: 12345678,
    query: {
      refId: 'test-1',
      expr: '{test="unit"}',
    },
  },
  {
    ts: 87654321,
    query: {
      refId: 'test-1',
      expr: '{unit="test"}',
    },
  },
  {
    ts: 87654321,
    query: {
      refId: 'test-1',
      expr: '{unit="test"}',
    },
  },
  {
    ts: 87654325,
    query: {
      refId: 'test-2',
      expr: '{unit="test"} ', // will be trimmed and removed
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

const otherTimeRange = {
  from: dateTime(1234567800000),
  to: dateTime(1234567801000),
  raw: {
    from: dateTime(1234567800000),
    to: dateTime(1234567801000),
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
    jest.spyOn(languageProvider, 'fetchLabels').mockResolvedValue(labelKeys);
    jest.spyOn(languageProvider, 'fetchLabelValues').mockResolvedValue(labelValues);
    jest.spyOn(languageProvider, 'getParserAndLabelKeys').mockResolvedValue(parserAndLabelKeys);
  });

  test('Returns the expected history entries', () => {
    expect(completionProvider.getHistory()).toEqual(['{unit="test"}', '{test="unit"}']);
  });

  test('Processes updates to the current historyRef value', () => {
    expect(completionProvider.getHistory()).toEqual(['{unit="test"}', '{test="unit"}']);

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

  test('Returns the expected label names', async () => {
    expect(await completionProvider.getLabelNames([])).toEqual(labelKeys);
  });

  test('Returns the list of label names without labels used in selector', async () => {
    expect(await completionProvider.getLabelNames(otherLabels)).toEqual(['source']);
  });

  test('Correctly build stream selector in getLabelNames and pass it to fetchLabels call', async () => {
    await completionProvider.getLabelNames([{ name: 'job', op: '=', value: '"a\\b\n' }]);
    expect(languageProvider.fetchLabels).toHaveBeenCalledWith({
      streamSelector: '{job="\\"a\\\\b\\n"}',
      timeRange: mockTimeRange,
    });
  });

  test('Returns the expected label values', async () => {
    expect(await completionProvider.getLabelValues('label', [])).toEqual(labelValues);
  });

  test('Correctly build stream selector in getLabelValues and pass it to fetchLabelValues call', async () => {
    await completionProvider.getLabelValues('place', [{ name: 'job', op: '=', value: '"a\\b\n' }]);
    expect(languageProvider.fetchLabelValues).toHaveBeenCalledWith('place', {
      streamSelector: '{job="\\"a\\\\b\\n"}',
      timeRange: mockTimeRange,
    });
  });

  test('Returns the expected parser and label keys', async () => {
    expect(await completionProvider.getParserAndLabelKeys('{a="b"}')).toEqual(parserAndLabelKeys);
    expect(languageProvider.getParserAndLabelKeys).toHaveBeenCalledTimes(1);
  });

  test('Returns the expected parser and label keys, cache duplicate query', async () => {
    expect(await completionProvider.getParserAndLabelKeys('{a="b"}')).toEqual(parserAndLabelKeys);
    expect(await completionProvider.getParserAndLabelKeys('{a="b"}')).toEqual(parserAndLabelKeys);

    expect(languageProvider.getParserAndLabelKeys).toHaveBeenCalledTimes(1);
  });

  test('Returns the expected parser and label keys, unique query is not cached', async () => {
    //1
    expect(await completionProvider.getParserAndLabelKeys('{a="b"}')).toEqual(parserAndLabelKeys);
    expect(await completionProvider.getParserAndLabelKeys('{a="b"}')).toEqual(parserAndLabelKeys);

    //2
    expect(await completionProvider.getParserAndLabelKeys('unique')).toEqual(parserAndLabelKeys);
    expect(await completionProvider.getParserAndLabelKeys('unique')).toEqual(parserAndLabelKeys);

    // 3
    expect(await completionProvider.getParserAndLabelKeys('uffdah')).toEqual(parserAndLabelKeys);

    // 4
    expect(await completionProvider.getParserAndLabelKeys('{a="b"}')).toEqual(parserAndLabelKeys);

    expect(languageProvider.getParserAndLabelKeys).toHaveBeenCalledTimes(4);
  });

  test('Clears the cache when the time range changes', async () => {
    expect(await completionProvider.getParserAndLabelKeys('{a="b"}')).toEqual(parserAndLabelKeys);
    expect(await completionProvider.getParserAndLabelKeys('{a="b"}')).toEqual(parserAndLabelKeys);
    completionProvider.setTimeRange(otherTimeRange);
    expect(await completionProvider.getParserAndLabelKeys('{a="b"}')).toEqual(parserAndLabelKeys);

    expect(languageProvider.getParserAndLabelKeys).toHaveBeenCalledTimes(2);
  });

  test('Returns the expected parser and label keys, cache size is 2', async () => {
    //1
    expect(await completionProvider.getParserAndLabelKeys('{a="b"}')).toEqual(parserAndLabelKeys);
    expect(await completionProvider.getParserAndLabelKeys('{a="b"}')).toEqual(parserAndLabelKeys);

    //2
    expect(await completionProvider.getParserAndLabelKeys('unique')).toEqual(parserAndLabelKeys);
    expect(await completionProvider.getParserAndLabelKeys('unique')).toEqual(parserAndLabelKeys);

    // 2
    expect(await completionProvider.getParserAndLabelKeys('{a="b"}')).toEqual(parserAndLabelKeys);
    expect(await completionProvider.getParserAndLabelKeys('{a="b"}')).toEqual(parserAndLabelKeys);
    expect(languageProvider.getParserAndLabelKeys).toHaveBeenCalledTimes(2);

    // 3
    expect(await completionProvider.getParserAndLabelKeys('new')).toEqual(parserAndLabelKeys);
    expect(await completionProvider.getParserAndLabelKeys('unique')).toEqual(parserAndLabelKeys);
    expect(languageProvider.getParserAndLabelKeys).toHaveBeenCalledTimes(3);

    // 4
    expect(await completionProvider.getParserAndLabelKeys('{a="b"}')).toEqual(parserAndLabelKeys);
    expect(await completionProvider.getParserAndLabelKeys('{a="b"}')).toEqual(parserAndLabelKeys);
    expect(languageProvider.getParserAndLabelKeys).toHaveBeenCalledTimes(4);
  });

  test('Uses time range from CompletionProvider', async () => {
    completionProvider.getParserAndLabelKeys('{a="b"}');
    expect(languageProvider.getParserAndLabelKeys).toHaveBeenCalledWith('{a="b"}', { timeRange: mockTimeRange });
  });

  test('Updates the time range from CompletionProvider', async () => {
    completionProvider.getParserAndLabelKeys('{a="b"}');
    expect(languageProvider.getParserAndLabelKeys).toHaveBeenCalledWith('{a="b"}', { timeRange: mockTimeRange });
    completionProvider.setTimeRange(otherTimeRange);
    completionProvider.getParserAndLabelKeys('{a="b"}');
    expect(languageProvider.getParserAndLabelKeys).toHaveBeenCalledWith('{a="b"}', { timeRange: otherTimeRange });
  });
});
