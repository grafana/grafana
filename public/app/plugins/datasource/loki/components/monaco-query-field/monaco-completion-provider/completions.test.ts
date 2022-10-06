import LokiLanguageProvider from '../../../LanguageProvider';
import { LokiDatasource } from '../../../datasource';
import { createLokiDatasource } from '../../../mocks';

import { CompletionDataProvider } from './CompletionDataProvider';
import { getCompletions } from './completions';
import { Label, Situation } from './situation';

const history = [
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
      expr: '{test: unit}',
    },
  },
];

const labelNames = ['place', 'source'];
const labelValues = ['moon', 'luna'];
const extractedLabelKeys = ['extracted', 'label'];
const otherLabels: Label[] = [
  {
    name: 'place',
    value: 'luna',
    op: '=',
  },
];
const afterSelectorCompletions = [
  {
    insertText: '|= "$0"',
    isSnippet: true,
    label: '|= ""',
    type: 'LINE_FILTER',
  },
  {
    insertText: '!= "$0"',
    isSnippet: true,
    label: '!= ""',
    type: 'LINE_FILTER',
  },
  {
    insertText: '|~ "$0"',
    isSnippet: true,
    label: '|~ ""',
    type: 'LINE_FILTER',
  },
  {
    insertText: '!~ "$0"',
    isSnippet: true,
    label: '!~ ""',
    type: 'LINE_FILTER',
  },
  {
    insertText: '',
    label: '// Placeholder for the detected parser',
    type: 'DETECTED_PARSER_PLACEHOLDER',
  },
  {
    insertText: '',
    label: '// Placeholder for logfmt or json',
    type: 'OPPOSITE_PARSER_PLACEHOLDER',
  },
  {
    insertText: 'pattern',
    label: 'pattern',
    type: 'PARSER',
  },
  {
    insertText: 'regexp',
    label: 'regexp',
    type: 'PARSER',
  },
  {
    insertText: 'unpack',
    label: 'unpack',
    type: 'PARSER',
  },
  {
    insertText: 'unwrap extracted',
    label: 'unwrap extracted (detected)',
    type: 'LINE_FILTER',
  },
  {
    insertText: 'unwrap label',
    label: 'unwrap label (detected)',
    type: 'LINE_FILTER',
  },
  {
    insertText: 'unwrap',
    label: 'unwrap',
    type: 'LINE_FILTER',
  },
  {
    insertText: 'line_format "{{.$0}}"',
    isSnippet: true,
    label: 'line_format',
    type: 'LINE_FORMAT',
  },
];

function buildAfterSelectorCompletions(
  detectedParser: string,
  detectedParserType: string,
  otherParser: string,
  explanation = '(detected)'
) {
  return afterSelectorCompletions.map((completion) => {
    if (completion.type === 'DETECTED_PARSER_PLACEHOLDER') {
      return {
        ...completion,
        type: detectedParserType,
        label: `${detectedParser} ${explanation}`,
        insertText: detectedParser,
      };
    } else if (completion.type === 'OPPOSITE_PARSER_PLACEHOLDER') {
      return {
        ...completion,
        type: 'PARSER',
        label: otherParser,
        insertText: otherParser,
      };
    }

    return { ...completion };
  });
}

describe('getCompletions', () => {
  let completionProvider: CompletionDataProvider, languageProvider: LokiLanguageProvider, datasource: LokiDatasource;
  beforeEach(() => {
    datasource = createLokiDatasource();
    languageProvider = new LokiLanguageProvider(datasource);
    completionProvider = new CompletionDataProvider(languageProvider, history);

    jest.spyOn(completionProvider, 'getLabelNames').mockResolvedValue(labelNames);
    jest.spyOn(completionProvider, 'getLabelValues').mockResolvedValue(labelValues);
    jest.spyOn(completionProvider, 'getParserAndLabelKeys').mockResolvedValue({
      extractedLabelKeys,
      hasJSON: false,
      hasLogfmt: false,
    });
  });

  test.each(['EMPTY', 'AT_ROOT'])(`Returns completion options when the situation is %s`, async (type) => {
    const situation = { type } as Situation;
    const completions = await getCompletions(situation, completionProvider);

    expect(completions).toHaveLength(25);
  });

  test('Returns completion options when the situation is IN_DURATION', async () => {
    const situation: Situation = { type: 'IN_DURATION' };
    const completions = await getCompletions(situation, completionProvider);

    expect(completions).toEqual([
      { insertText: '$__interval', label: '$__interval', type: 'DURATION' },
      { insertText: '$__range', label: '$__range', type: 'DURATION' },
      { insertText: '1m', label: '1m', type: 'DURATION' },
      { insertText: '5m', label: '5m', type: 'DURATION' },
      { insertText: '10m', label: '10m', type: 'DURATION' },
      { insertText: '30m', label: '30m', type: 'DURATION' },
      { insertText: '1h', label: '1h', type: 'DURATION' },
      { insertText: '1d', label: '1d', type: 'DURATION' },
    ]);
  });

  test('Returns completion options when the situation is IN_GROUPING', async () => {
    const situation: Situation = { type: 'IN_GROUPING', otherLabels };
    const completions = await getCompletions(situation, completionProvider);

    expect(completions).toEqual([
      {
        insertText: 'place',
        label: 'place',
        triggerOnInsert: false,
        type: 'LABEL_NAME',
      },
      {
        insertText: 'source',
        label: 'source',
        triggerOnInsert: false,
        type: 'LABEL_NAME',
      },
      {
        insertText: 'extracted',
        label: 'extracted (parsed)',
        triggerOnInsert: false,
        type: 'LABEL_NAME',
      },
      {
        insertText: 'label',
        label: 'label (parsed)',
        triggerOnInsert: false,
        type: 'LABEL_NAME',
      },
    ]);
  });

  test('Returns completion options when the situation is IN_LABEL_SELECTOR_NO_LABEL_NAME', async () => {
    const situation: Situation = { type: 'IN_LABEL_SELECTOR_NO_LABEL_NAME', otherLabels };
    const completions = await getCompletions(situation, completionProvider);

    expect(completions).toEqual([
      {
        insertText: 'place=',
        label: 'place',
        triggerOnInsert: true,
        type: 'LABEL_NAME',
      },
      {
        insertText: 'source=',
        label: 'source',
        triggerOnInsert: true,
        type: 'LABEL_NAME',
      },
    ]);
  });

  test('Returns completion options when the situation is IN_LABEL_SELECTOR_WITH_LABEL_NAME', async () => {
    const situation: Situation = {
      type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
      otherLabels,
      labelName: '',
      betweenQuotes: false,
    };
    let completions = await getCompletions(situation, completionProvider);

    expect(completions).toEqual([
      {
        insertText: '"moon"',
        label: 'moon',
        type: 'LABEL_VALUE',
      },
      {
        insertText: '"luna"',
        label: 'luna',
        type: 'LABEL_VALUE',
      },
    ]);

    completions = await getCompletions({ ...situation, betweenQuotes: true }, completionProvider);

    expect(completions).toEqual([
      {
        insertText: 'moon',
        label: 'moon',
        type: 'LABEL_VALUE',
      },
      {
        insertText: 'luna',
        label: 'luna',
        type: 'LABEL_VALUE',
      },
    ]);
  });

  test('Returns completion options when the situation is AFTER_SELECTOR and JSON parser', async () => {
    jest.spyOn(completionProvider, 'getParserAndLabelKeys').mockResolvedValue({
      extractedLabelKeys,
      hasJSON: true,
      hasLogfmt: false,
    });
    const situation: Situation = { type: 'AFTER_SELECTOR', labels: [], afterPipe: true };
    const completions = await getCompletions(situation, completionProvider);

    const expected = buildAfterSelectorCompletions('json', 'PARSER', 'logfmt');
    expect(completions).toEqual(expected);
  });

  test('Returns completion options when the situation is AFTER_SELECTOR and Logfmt parser', async () => {
    jest.spyOn(completionProvider, 'getParserAndLabelKeys').mockResolvedValue({
      extractedLabelKeys,
      hasJSON: false,
      hasLogfmt: true,
    });
    const situation: Situation = { type: 'AFTER_SELECTOR', labels: [], afterPipe: true };
    const completions = await getCompletions(situation, completionProvider);

    const expected = buildAfterSelectorCompletions('logfmt', 'DURATION', 'json');
    expect(completions).toEqual(expected);
  });

  test('Returns completion options when the situation is IN_AGGREGATION', async () => {
    const situation: Situation = { type: 'IN_AGGREGATION' };
    const completions = await getCompletions(situation, completionProvider);

    expect(completions).toHaveLength(22);
  });
});
