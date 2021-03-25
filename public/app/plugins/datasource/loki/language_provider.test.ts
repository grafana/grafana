import Plain from 'slate-plain-serializer';

import LanguageProvider, { LokiHistoryItem } from './language_provider';
import { TypeaheadInput } from '@grafana/ui';

import { makeMockLokiDatasource } from './mocks';
import LokiDatasource from './datasource';

jest.mock('app/store/store', () => ({
  store: {
    getState: jest.fn().mockReturnValue({
      explore: {
        left: {
          mode: 'Logs',
        },
      },
    }),
  },
}));

describe('Language completion provider', () => {
  const datasource = makeMockLokiDatasource({});

  describe('query suggestions', () => {
    it('returns no suggestions on empty context', async () => {
      const instance = new LanguageProvider(datasource);
      const value = Plain.deserialize('');
      const result = await instance.provideCompletionItems({ text: '', prefix: '', value, wrapperClasses: [] });
      expect(result.context).toBeUndefined();

      expect(result.suggestions.length).toEqual(0);
    });

    it('returns history on empty context when history was provided', async () => {
      const instance = new LanguageProvider(datasource);
      const value = Plain.deserialize('');
      const history: LokiHistoryItem[] = [
        {
          query: { refId: '1', expr: '{app="foo"}' },
          ts: 1,
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
              label: '{app="foo"}',
            },
          ],
        },
      ]);
    });

    it('returns function and history suggestions', async () => {
      const instance = new LanguageProvider(datasource);
      const input = createTypeaheadInput('m', 'm', undefined, 1, [], instance);
      // Historic expressions don't have to match input, filtering is done in field
      const history: LokiHistoryItem[] = [
        {
          query: { refId: '1', expr: '{app="foo"}' },
          ts: 1,
        },
      ];
      const result = await instance.provideCompletionItems(input, { history });
      expect(result.context).toBeUndefined();
      expect(result.suggestions.length).toEqual(2);
      expect(result.suggestions[0].label).toEqual('History');
      expect(result.suggestions[1].label).toEqual('Functions');
    });

    it('returns pipe operations on pipe context', async () => {
      const instance = new LanguageProvider(datasource);
      const input = createTypeaheadInput('{app="test"} | ', ' ', '', 15, ['context-pipe']);
      const result = await instance.provideCompletionItems(input);
      expect(result.context).toBeUndefined();
      expect(result.suggestions.length).toEqual(2);
      expect(result.suggestions[0].label).toEqual('Operators');
      expect(result.suggestions[1].label).toEqual('Parsers');
    });
  });

  describe('label key suggestions', () => {
    it('returns all label suggestions on empty selector', async () => {
      const datasource = makeMockLokiDatasource({ label1: [], label2: [] });
      const provider = await getLanguageProvider(datasource);
      const input = createTypeaheadInput('{}', '', '', 1);
      const result = await provider.provideCompletionItems(input);
      expect(result.context).toBe('context-labels');
      expect(result.suggestions).toEqual([
        {
          items: [
            { label: 'label1', filterText: '"label1"' },
            { label: 'label2', filterText: '"label2"' },
          ],
          label: 'Labels',
        },
      ]);
    });

    it('returns all label suggestions on selector when starting to type', async () => {
      const datasource = makeMockLokiDatasource({ label1: [], label2: [] });
      const provider = await getLanguageProvider(datasource);
      const input = createTypeaheadInput('{l}', '', '', 2);
      const result = await provider.provideCompletionItems(input);
      expect(result.context).toBe('context-labels');
      expect(result.suggestions).toEqual([
        {
          items: [
            { label: 'label1', filterText: '"label1"' },
            { label: 'label2', filterText: '"label2"' },
          ],
          label: 'Labels',
        },
      ]);
    });
  });

  describe('label suggestions facetted', () => {
    it('returns facetted label suggestions based on selector', async () => {
      const datasource = makeMockLokiDatasource(
        { label1: [], label2: [] },
        { '{foo="bar"}': [{ label1: 'label_val1' }] }
      );
      const provider = await getLanguageProvider(datasource);
      const input = createTypeaheadInput('{foo="bar",}', '', '', 11);
      const result = await provider.provideCompletionItems(input);
      expect(result.context).toBe('context-labels');
      expect(result.suggestions).toEqual([{ items: [{ label: 'label1' }], label: 'Labels' }]);
    });

    it('returns facetted label suggestions for multipule selectors', async () => {
      const datasource = makeMockLokiDatasource(
        { label1: [], label2: [] },
        { '{baz="42",foo="bar"}': [{ label2: 'label_val2' }] }
      );
      const provider = await getLanguageProvider(datasource);
      const input = createTypeaheadInput('{baz="42",foo="bar",}', '', '', 20);
      const result = await provider.provideCompletionItems(input);
      expect(result.context).toBe('context-labels');
      expect(result.suggestions).toEqual([{ items: [{ label: 'label2' }], label: 'Labels' }]);
    });
  });

  describe('label suggestions', () => {
    it('returns label values suggestions from Loki', async () => {
      const datasource = makeMockLokiDatasource({ label1: ['label1_val1', 'label1_val2'], label2: [] });
      const provider = await getLanguageProvider(datasource);
      const input = createTypeaheadInput('{label1=}', '=', 'label1');
      let result = await provider.provideCompletionItems(input);

      result = await provider.provideCompletionItems(input);
      expect(result.context).toBe('context-label-values');
      expect(result.suggestions).toEqual([
        {
          items: [
            { label: 'label1_val1', filterText: '"label1_val1"' },
            { label: 'label1_val2', filterText: '"label1_val2"' },
          ],
          label: 'Label values for "label1"',
        },
      ]);
    });
    it('returns label values suggestions from Loki when re-editing', async () => {
      const datasource = makeMockLokiDatasource({ label1: ['label1_val1', 'label1_val2'], label2: [] });
      const provider = await getLanguageProvider(datasource);
      const input = createTypeaheadInput('{label1="label1_v"}', 'label1_v', 'label1', 17, [
        'attr-value',
        'context-labels',
      ]);
      let result = await provider.provideCompletionItems(input);
      expect(result.context).toBe('context-label-values');
      expect(result.suggestions).toEqual([
        {
          items: [
            { label: 'label1_val1', filterText: '"label1_val1"' },
            { label: 'label1_val2', filterText: '"label1_val2"' },
          ],
          label: 'Label values for "label1"',
        },
      ]);
    });
  });

  describe('label values', () => {
    it('should fetch label values if not cached', async () => {
      const datasource = makeMockLokiDatasource({ testkey: ['label1_val1', 'label1_val2'], label2: [] });
      const provider = await getLanguageProvider(datasource);
      const requestSpy = jest.spyOn(provider, 'request');
      const labelValues = await provider.fetchLabelValues('testkey');
      expect(requestSpy).toHaveBeenCalled();
      expect(labelValues).toEqual(['label1_val1', 'label1_val2']);
    });

    it('should return cached values', async () => {
      const datasource = makeMockLokiDatasource({ testkey: ['label1_val1', 'label1_val2'], label2: [] });
      const provider = await getLanguageProvider(datasource);
      const requestSpy = jest.spyOn(provider, 'request');
      const labelValues = await provider.fetchLabelValues('testkey');
      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect(labelValues).toEqual(['label1_val1', 'label1_val2']);

      const nextLabelValues = await provider.fetchLabelValues('testkey');
      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect(nextLabelValues).toEqual(['label1_val1', 'label1_val2']);
    });
  });
});

describe('Request URL', () => {
  it('should contain range params', async () => {
    const datasourceWithLabels = makeMockLokiDatasource({ other: [] });
    const rangeParams = datasourceWithLabels.getTimeRangeParams();
    const datasourceSpy = jest.spyOn(datasourceWithLabels as any, 'metadataRequest');

    const instance = new LanguageProvider(datasourceWithLabels);
    instance.fetchLogLabels();
    const expectedUrl = '/loki/api/v1/label';
    expect(datasourceSpy).toHaveBeenCalledWith(expectedUrl, rangeParams);
  });
});

describe('Query imports', () => {
  const datasource = makeMockLokiDatasource({});

  it('returns empty queries for unknown origin datasource', async () => {
    const instance = new LanguageProvider(datasource);
    const result = await instance.importQueries([{ refId: 'bar', expr: 'foo' }], 'unknown');
    expect(result).toEqual([{ refId: 'bar', expr: '' }]);
  });

  describe('prometheus query imports', () => {
    it('returns empty query from metric-only query', async () => {
      const instance = new LanguageProvider(datasource);
      const result = await instance.importPrometheusQuery('foo');
      expect(result).toEqual('');
    });

    it('returns empty query from selector query if label is not available', async () => {
      const datasourceWithLabels = makeMockLokiDatasource({ other: [] });
      const instance = new LanguageProvider(datasourceWithLabels);
      const result = await instance.importPrometheusQuery('{foo="bar"}');
      expect(result).toEqual('{}');
    });

    it('returns selector query from selector query with common labels', async () => {
      const datasourceWithLabels = makeMockLokiDatasource({ foo: [] });
      const instance = new LanguageProvider(datasourceWithLabels);
      const result = await instance.importPrometheusQuery('metric{foo="bar",baz="42"}');
      expect(result).toEqual('{foo="bar"}');
    });

    it('returns selector query from selector query with all labels if logging label list is empty', async () => {
      const datasourceWithLabels = makeMockLokiDatasource({});
      const instance = new LanguageProvider(datasourceWithLabels);
      const result = await instance.importPrometheusQuery('metric{foo="bar",baz="42"}');
      expect(result).toEqual('{baz="42",foo="bar"}');
    });
  });
});

async function getLanguageProvider(datasource: LokiDatasource) {
  const instance = new LanguageProvider(datasource);
  await instance.start();
  return instance;
}

/**
 * @param value Value of the full input
 * @param text Last piece of text (not sure but in case of {label=} this would be just '=')
 * @param labelKey Label by which to search for values. Cutting corners a bit here as this should be inferred from value
 */
function createTypeaheadInput(
  value: string,
  text: string,
  labelKey?: string,
  anchorOffset?: number,
  wrapperClasses?: string[],
  instance?: LanguageProvider
): TypeaheadInput {
  const deserialized = Plain.deserialize(value);
  const range = deserialized.selection.setAnchor(deserialized.selection.anchor.setOffset(anchorOffset || 1));
  const valueWithSelection = deserialized.setSelection(range);
  return {
    text,
    prefix: instance ? instance.cleanText(text) : '',
    wrapperClasses: wrapperClasses || ['context-labels'],
    value: valueWithSelection,
    labelKey,
  };
}
