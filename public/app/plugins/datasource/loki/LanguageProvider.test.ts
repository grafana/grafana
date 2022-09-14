import Plain from 'slate-plain-serializer';

import { AbstractLabelOperator } from '@grafana/data';
import { TypeaheadInput } from '@grafana/ui';
import { TemplateSrv } from 'app/features/templating/template_srv';

import LanguageProvider, { LokiHistoryItem } from './LanguageProvider';
import { LokiDatasource } from './datasource';
import { createLokiDatasource, createMetadataRequest } from './mocks';
import { LokiQueryType } from './types';

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
  const datasource = setup({});

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
  });

  describe('label key suggestions', () => {
    it('returns all label suggestions on empty selector', async () => {
      const datasource = setup({ label1: [], label2: [] });
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
      const datasource = setup({ label1: [], label2: [] });
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
      const datasource = setup({ label1: [], label2: [] }, { '{foo="bar"}': [{ label1: 'label_val1' }] });
      const provider = await getLanguageProvider(datasource);
      const input = createTypeaheadInput('{foo="bar",}', '', '', 11);
      const result = await provider.provideCompletionItems(input);
      expect(result.context).toBe('context-labels');
      expect(result.suggestions).toEqual([{ items: [{ label: 'label1' }], label: 'Labels' }]);
    });

    it('returns facetted label suggestions for multipule selectors', async () => {
      const datasource = setup({ label1: [], label2: [] }, { '{baz="42",foo="bar"}': [{ label2: 'label_val2' }] });
      const provider = await getLanguageProvider(datasource);
      const input = createTypeaheadInput('{baz="42",foo="bar",}', '', '', 20);
      const result = await provider.provideCompletionItems(input);
      expect(result.context).toBe('context-labels');
      expect(result.suggestions).toEqual([{ items: [{ label: 'label2' }], label: 'Labels' }]);
    });
  });

  describe('label suggestions', () => {
    it('returns label values suggestions from Loki', async () => {
      const datasource = setup({ label1: ['label1_val1', 'label1_val2'], label2: [] });
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
      const datasource = setup({ label1: ['label1_val1', 'label1_val2'], label2: [] });
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
      const datasource = setup({ testkey: ['label1_val1', 'label1_val2'], label2: [] });
      const provider = await getLanguageProvider(datasource);
      const requestSpy = jest.spyOn(provider, 'request');
      const labelValues = await provider.fetchLabelValues('testkey');
      expect(requestSpy).toHaveBeenCalled();
      expect(labelValues).toEqual(['label1_val1', 'label1_val2']);
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
      expect(nextLabelValues).toEqual(['label1_val1', 'label1_val2']);
    });

    it('should encode special characters', async () => {
      const datasource = setup({ '`\\"testkey': ['label1_val1', 'label1_val2'], label2: [] });
      const provider = await getLanguageProvider(datasource);
      const requestSpy = jest.spyOn(provider, 'request');
      await provider.fetchLabelValues('`\\"testkey');

      expect(requestSpy).toHaveBeenCalledWith('label/%60%5C%22testkey/values', expect.any(Object));
    });
  });
});

describe('Request URL', () => {
  it('should contain range params', async () => {
    const datasourceWithLabels = setup({ other: [] });
    const rangeParams = datasourceWithLabels.getTimeRangeParams();
    const datasourceSpy = jest.spyOn(datasourceWithLabels, 'metadataRequest');

    const instance = new LanguageProvider(datasourceWithLabels);
    instance.fetchLabels();
    const expectedUrl = 'labels';
    expect(datasourceSpy).toHaveBeenCalledWith(expectedUrl, rangeParams);
  });
});

describe('Query imports', () => {
  const datasource = setup({});

  it('returns empty queries', async () => {
    const instance = new LanguageProvider(datasource);
    const result = await instance.importFromAbstractQuery({ refId: 'bar', labelMatchers: [] });
    expect(result).toEqual({ refId: 'bar', expr: '', queryType: LokiQueryType.Range });
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

function setup(
  labelsAndValues: Record<string, string[]>,
  series?: Record<string, Array<Record<string, string>>>
): LokiDatasource {
  const datasource = createLokiDatasource({} as unknown as TemplateSrv);

  const rangeMock = {
    start: 1560153109000,
    end: 1560163909000,
  };

  jest.spyOn(datasource, 'getTimeRangeParams').mockReturnValue(rangeMock);
  jest.spyOn(datasource, 'metadataRequest').mockImplementation(createMetadataRequest(labelsAndValues, series));
  jest.spyOn(datasource, 'interpolateString').mockImplementation((string: string) => string);

  return datasource;
}
