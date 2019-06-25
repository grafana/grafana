// @ts-ignore
import Plain from 'slate-plain-serializer';

import LanguageProvider from '../language_provider';

describe('Language completion provider', () => {
  const datasource = {
    metadataRequest: () => ({ data: { data: [] as any[] } }),
  };

  describe('empty query suggestions', () => {
    it('returns default suggestions on emtpty context', () => {
      const instance = new LanguageProvider(datasource);
      const value = Plain.deserialize('');
      const result = instance.provideCompletionItems({ text: '', prefix: '', value, wrapperClasses: [] });
      expect(result.context).toBeUndefined();
      expect(result.refresher).toBeUndefined();
      expect(result.suggestions).toMatchObject([
        {
          label: 'Functions',
        },
      ]);
    });

    it('returns default suggestions with metrics on emtpty context when metrics were provided', () => {
      const instance = new LanguageProvider(datasource, { metrics: ['foo', 'bar'] });
      const value = Plain.deserialize('');
      const result = instance.provideCompletionItems({ text: '', prefix: '', value, wrapperClasses: [] });
      expect(result.context).toBeUndefined();
      expect(result.refresher).toBeUndefined();
      expect(result.suggestions).toMatchObject([
        {
          label: 'Functions',
        },
        {
          label: 'Metrics',
        },
      ]);
    });

    it('returns default suggestions with history on emtpty context when history was provided', () => {
      const instance = new LanguageProvider(datasource);
      const value = Plain.deserialize('');
      const history = [
        {
          query: { refId: '1', expr: 'metric' },
        },
      ];
      const result = instance.provideCompletionItems({ text: '', prefix: '', value, wrapperClasses: [] }, { history });
      expect(result.context).toBeUndefined();
      expect(result.refresher).toBeUndefined();
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
      ]);
    });
  });

  describe('range suggestions', () => {
    it('returns range suggestions in range context', () => {
      const instance = new LanguageProvider(datasource);
      const value = Plain.deserialize('1');
      const result = instance.provideCompletionItems({
        text: '1',
        prefix: '1',
        value,
        wrapperClasses: ['context-range'],
      });
      expect(result.context).toBe('context-range');
      expect(result.refresher).toBeUndefined();
      expect(result.suggestions).toMatchObject([
        {
          items: [
            { label: '$__interval', sortText: '$__interval' }, // TODO: figure out why this row and sortText is needed
            { label: '1m', sortText: '00:01:00' },
            { label: '5m', sortText: '00:05:00' },
            { label: '10m', sortText: '00:10:00' },
            { label: '30m', sortText: '00:30:00' },
            { label: '1h', sortText: '01:00:00' },
            { label: '1d', sortText: '24:00:00' },
          ],
          label: 'Range vector',
        },
      ]);
    });
  });

  describe('metric suggestions', () => {
    it('returns metrics and function suggestions in an unknown context', () => {
      const instance = new LanguageProvider(datasource, { metrics: ['foo', 'bar'] });
      const value = Plain.deserialize('a');
      const result = instance.provideCompletionItems({ text: 'a', prefix: 'a', value, wrapperClasses: [] });
      expect(result.context).toBeUndefined();
      expect(result.refresher).toBeUndefined();
      expect(result.suggestions).toMatchObject([
        {
          label: 'Functions',
        },
        {
          label: 'Metrics',
        },
      ]);
    });

    it('returns metrics and function  suggestions after a binary operator', () => {
      const instance = new LanguageProvider(datasource, { metrics: ['foo', 'bar'] });
      const value = Plain.deserialize('*');
      const result = instance.provideCompletionItems({ text: '*', prefix: '', value, wrapperClasses: [] });
      expect(result.context).toBeUndefined();
      expect(result.refresher).toBeUndefined();
      expect(result.suggestions).toMatchObject([
        {
          label: 'Functions',
        },
        {
          label: 'Metrics',
        },
      ]);
    });

    it('returns no suggestions at the beginning of a non-empty function', () => {
      const instance = new LanguageProvider(datasource, { metrics: ['foo', 'bar'] });
      const value = Plain.deserialize('sum(up)');
      const range = value.selection.merge({
        anchorOffset: 4,
      });
      const valueWithSelection = value.change().select(range).value;
      const result = instance.provideCompletionItems({
        text: '',
        prefix: '',
        value: valueWithSelection,
        wrapperClasses: [],
      });
      expect(result.context).toBeUndefined();
      expect(result.refresher).toBeUndefined();
      expect(result.suggestions.length).toEqual(0);
    });
  });

  describe('label suggestions', () => {
    it('returns default label suggestions on label context and no metric', () => {
      const instance = new LanguageProvider(datasource);
      const value = Plain.deserialize('{}');
      const range = value.selection.merge({
        anchorOffset: 1,
      });
      const valueWithSelection = value.change().select(range).value;
      const result = instance.provideCompletionItems({
        text: '',
        prefix: '',
        wrapperClasses: ['context-labels'],
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-labels');
      expect(result.suggestions).toEqual([{ items: [{ label: 'job' }, { label: 'instance' }], label: 'Labels' }]);
    });

    it('returns label suggestions on label context and metric', () => {
      const instance = new LanguageProvider(datasource, { labelKeys: { '{__name__="metric"}': ['bar'] } });
      const value = Plain.deserialize('metric{}');
      const range = value.selection.merge({
        anchorOffset: 7,
      });
      const valueWithSelection = value.change().select(range).value;
      const result = instance.provideCompletionItems({
        text: '',
        prefix: '',
        wrapperClasses: ['context-labels'],
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-labels');
      expect(result.suggestions).toEqual([{ items: [{ label: 'bar' }], label: 'Labels' }]);
    });

    it('returns label suggestions on label context but leaves out labels that already exist', () => {
      const instance = new LanguageProvider(datasource, {
        labelKeys: { '{job1="foo",job2!="foo",job3=~"foo"}': ['bar', 'job1', 'job2', 'job3'] },
      });
      const value = Plain.deserialize('{job1="foo",job2!="foo",job3=~"foo",}');
      const range = value.selection.merge({
        anchorOffset: 36,
      });
      const valueWithSelection = value.change().select(range).value;
      const result = instance.provideCompletionItems({
        text: '',
        prefix: '',
        wrapperClasses: ['context-labels'],
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-labels');
      expect(result.suggestions).toEqual([{ items: [{ label: 'bar' }], label: 'Labels' }]);
    });

    it('returns label value suggestions inside a label value context after a negated matching operator', () => {
      const instance = new LanguageProvider(datasource, {
        labelKeys: { '{}': ['label'] },
        labelValues: { '{}': { label: ['a', 'b', 'c'] } },
      });
      const value = Plain.deserialize('{label!=}');
      const range = value.selection.merge({ anchorOffset: 8 });
      const valueWithSelection = value.change().select(range).value;
      const result = instance.provideCompletionItems({
        text: '!=',
        prefix: '',
        wrapperClasses: ['context-labels'],
        labelKey: 'label',
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-label-values');
      expect(result.suggestions).toEqual([
        {
          items: [{ label: 'a' }, { label: 'b' }, { label: 'c' }],
          label: 'Label values for "label"',
        },
      ]);
    });

    it('returns a refresher on label context and unavailable metric', () => {
      const instance = new LanguageProvider(datasource, { labelKeys: { '{__name__="foo"}': ['bar'] } });
      const value = Plain.deserialize('metric{}');
      const range = value.selection.merge({
        anchorOffset: 7,
      });
      const valueWithSelection = value.change().select(range).value;
      const result = instance.provideCompletionItems({
        text: '',
        prefix: '',
        wrapperClasses: ['context-labels'],
        value: valueWithSelection,
      });
      expect(result.context).toBeUndefined();
      expect(result.refresher).toBeInstanceOf(Promise);
      expect(result.suggestions).toEqual([]);
    });

    it('returns label values on label context when given a metric and a label key', () => {
      const instance = new LanguageProvider(datasource, {
        labelKeys: { '{__name__="metric"}': ['bar'] },
        labelValues: { '{__name__="metric"}': { bar: ['baz'] } },
      });
      const value = Plain.deserialize('metric{bar=ba}');
      const range = value.selection.merge({
        anchorOffset: 13,
      });
      const valueWithSelection = value.change().select(range).value;
      const result = instance.provideCompletionItems({
        text: '=ba',
        prefix: 'ba',
        wrapperClasses: ['context-labels'],
        labelKey: 'bar',
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-label-values');
      expect(result.suggestions).toEqual([{ items: [{ label: 'baz' }], label: 'Label values for "bar"' }]);
    });

    it('returns label suggestions on aggregation context and metric w/ selector', () => {
      const instance = new LanguageProvider(datasource, { labelKeys: { '{__name__="metric",foo="xx"}': ['bar'] } });
      const value = Plain.deserialize('sum(metric{foo="xx"}) by ()');
      const range = value.selection.merge({
        anchorOffset: 26,
      });
      const valueWithSelection = value.change().select(range).value;
      const result = instance.provideCompletionItems({
        text: '',
        prefix: '',
        wrapperClasses: ['context-aggregation'],
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-aggregation');
      expect(result.suggestions).toEqual([{ items: [{ label: 'bar' }], label: 'Labels' }]);
    });

    it('returns label suggestions on aggregation context and metric w/o selector', () => {
      const instance = new LanguageProvider(datasource, { labelKeys: { '{__name__="metric"}': ['bar'] } });
      const value = Plain.deserialize('sum(metric) by ()');
      const range = value.selection.merge({
        anchorOffset: 16,
      });
      const valueWithSelection = value.change().select(range).value;
      const result = instance.provideCompletionItems({
        text: '',
        prefix: '',
        wrapperClasses: ['context-aggregation'],
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-aggregation');
      expect(result.suggestions).toEqual([{ items: [{ label: 'bar' }], label: 'Labels' }]);
    });

    it('returns label suggestions inside a multi-line aggregation context', () => {
      const instance = new LanguageProvider(datasource, {
        labelKeys: { '{__name__="metric"}': ['label1', 'label2', 'label3'] },
      });
      const value = Plain.deserialize('sum(\nmetric\n)\nby ()');
      const aggregationTextBlock = value.document.getBlocksAsArray()[3];
      const range = value.selection.moveToStartOf(aggregationTextBlock).merge({ anchorOffset: 4 });
      const valueWithSelection = value.change().select(range).value;
      const result = instance.provideCompletionItems({
        text: '',
        prefix: '',
        wrapperClasses: ['context-aggregation'],
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-aggregation');
      expect(result.suggestions).toEqual([
        {
          items: [{ label: 'label1' }, { label: 'label2' }, { label: 'label3' }],
          label: 'Labels',
        },
      ]);
    });

    it('returns label suggestions inside an aggregation context with a range vector', () => {
      const instance = new LanguageProvider(datasource, {
        labelKeys: { '{__name__="metric"}': ['label1', 'label2', 'label3'] },
      });
      const value = Plain.deserialize('sum(rate(metric[1h])) by ()');
      const range = value.selection.merge({
        anchorOffset: 26,
      });
      const valueWithSelection = value.change().select(range).value;
      const result = instance.provideCompletionItems({
        text: '',
        prefix: '',
        wrapperClasses: ['context-aggregation'],
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-aggregation');
      expect(result.suggestions).toEqual([
        {
          items: [{ label: 'label1' }, { label: 'label2' }, { label: 'label3' }],
          label: 'Labels',
        },
      ]);
    });

    it('returns label suggestions inside an aggregation context with a range vector and label', () => {
      const instance = new LanguageProvider(datasource, {
        labelKeys: { '{__name__="metric",label1="value"}': ['label1', 'label2', 'label3'] },
      });
      const value = Plain.deserialize('sum(rate(metric{label1="value"}[1h])) by ()');
      const range = value.selection.merge({
        anchorOffset: 42,
      });
      const valueWithSelection = value.change().select(range).value;
      const result = instance.provideCompletionItems({
        text: '',
        prefix: '',
        wrapperClasses: ['context-aggregation'],
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-aggregation');
      expect(result.suggestions).toEqual([
        {
          items: [{ label: 'label1' }, { label: 'label2' }, { label: 'label3' }],
          label: 'Labels',
        },
      ]);
    });

    it('returns no suggestions inside an unclear aggregation context using alternate syntax', () => {
      const instance = new LanguageProvider(datasource, {
        labelKeys: { '{__name__="metric"}': ['label1', 'label2', 'label3'] },
      });
      const value = Plain.deserialize('sum by ()');
      const range = value.selection.merge({
        anchorOffset: 8,
      });
      const valueWithSelection = value.change().select(range).value;
      const result = instance.provideCompletionItems({
        text: '',
        prefix: '',
        wrapperClasses: ['context-aggregation'],
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-aggregation');
      expect(result.suggestions).toEqual([]);
    });

    it('returns label suggestions inside an aggregation context using alternate syntax', () => {
      const instance = new LanguageProvider(datasource, {
        labelKeys: { '{__name__="metric"}': ['label1', 'label2', 'label3'] },
      });
      const value = Plain.deserialize('sum by () (metric)');
      const range = value.selection.merge({
        anchorOffset: 8,
      });
      const valueWithSelection = value.change().select(range).value;
      const result = instance.provideCompletionItems({
        text: '',
        prefix: '',
        wrapperClasses: ['context-aggregation'],
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-aggregation');
      expect(result.suggestions).toEqual([
        {
          items: [{ label: 'label1' }, { label: 'label2' }, { label: 'label3' }],
          label: 'Labels',
        },
      ]);
    });
  });
});
