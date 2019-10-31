import Plain from 'slate-plain-serializer';
import { Editor as SlateEditor } from 'slate';
import LanguageProvider from '../language_provider';
import { PrometheusDatasource } from '../datasource';
import { HistoryItem } from '@grafana/data';
import { PromQuery } from '../types';

describe('Language completion provider', () => {
  const datasource: PrometheusDatasource = ({
    metadataRequest: () => ({ data: { data: [] as any[] } }),
    getTimeRange: () => ({ start: 0, end: 1 }),
  } as any) as PrometheusDatasource;

  describe('empty query suggestions', () => {
    it('returns default suggestions on empty context', async () => {
      const instance = new LanguageProvider(datasource);
      const value = Plain.deserialize('');
      const result = await instance.provideCompletionItems({ text: '', prefix: '', value, wrapperClasses: [] });
      expect(result.context).toBeUndefined();
      expect(result.suggestions).toMatchObject([
        {
          label: 'Functions',
        },
      ]);
    });

    it('returns default suggestions with metrics on empty context when metrics were provided', async () => {
      const instance = new LanguageProvider(datasource, { metrics: ['foo', 'bar'] });
      const value = Plain.deserialize('');
      const result = await instance.provideCompletionItems({ text: '', prefix: '', value, wrapperClasses: [] });
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

    it('returns default suggestions with history on empty context when history was provided', async () => {
      const instance = new LanguageProvider(datasource);
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
        {
          label: 'Functions',
        },
      ]);
    });
  });

  describe('range suggestions', () => {
    it('returns range suggestions in range context', async () => {
      const instance = new LanguageProvider(datasource);
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
    it('returns metrics and function suggestions in an unknown context', async () => {
      const instance = new LanguageProvider(datasource, { metrics: ['foo', 'bar'] });
      let value = Plain.deserialize('a');
      value = value.setSelection({ anchor: { offset: 1 }, focus: { offset: 1 } });
      const result = await instance.provideCompletionItems({ text: 'a', prefix: 'a', value, wrapperClasses: [] });
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

    it('returns metrics and function  suggestions after a binary operator', async () => {
      const instance = new LanguageProvider(datasource, { metrics: ['foo', 'bar'] });
      const value = Plain.deserialize('*');
      const result = await instance.provideCompletionItems({ text: '*', prefix: '', value, wrapperClasses: [] });
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
      const instance = new LanguageProvider(datasource, { metrics: ['foo', 'bar'] });
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
      const instance = new LanguageProvider(datasource);
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
      expect(result.suggestions).toEqual([{ items: [{ label: 'job' }, { label: 'instance' }], label: 'Labels' }]);
    });

    it('returns label suggestions on label context and metric', async () => {
      const datasources: PrometheusDatasource = ({
        metadataRequest: () => ({ data: { data: [{ __name__: 'metric', bar: 'bazinga' }] as any[] } }),
        getTimeRange: () => ({ start: 0, end: 1 }),
      } as any) as PrometheusDatasource;
      const instance = new LanguageProvider(datasources, { labelKeys: { '{__name__="metric"}': ['bar'] } });
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
      expect(result.suggestions).toEqual([{ items: [{ label: 'bar' }], label: 'Labels' }]);
    });

    it('returns label suggestions on label context but leaves out labels that already exist', async () => {
      const datasources: PrometheusDatasource = ({
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
        getTimeRange: () => ({ start: 0, end: 1 }),
      } as any) as PrometheusDatasource;
      const instance = new LanguageProvider(datasources, {
        labelKeys: {
          '{job1="foo",job2!="foo",job3=~"foo",__name__="metric"}': ['bar', 'job1', 'job2', 'job3', '__name__'],
        },
      });
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
      expect(result.suggestions).toEqual([{ items: [{ label: 'bar' }], label: 'Labels' }]);
    });

    it('returns label value suggestions inside a label value context after a negated matching operator', async () => {
      const instance = new LanguageProvider(datasource, {
        labelKeys: { '{}': ['label'] },
        labelValues: { '{}': { label: ['a', 'b', 'c'] } },
      });
      const value = Plain.deserialize('{label!=}');
      const ed = new SlateEditor({ value });
      const valueWithSelection = ed.moveForward(8).value;
      const result = await instance.provideCompletionItems({
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

    it('returns a refresher on label context and unavailable metric', async () => {
      const instance = new LanguageProvider(datasource, { labelKeys: { '{__name__="foo"}': ['bar'] } });
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
    });

    it('returns label values on label context when given a metric and a label key', async () => {
      const instance = new LanguageProvider(datasource, {
        labelKeys: { '{__name__="metric"}': ['bar'] },
        labelValues: { '{__name__="metric"}': { bar: ['baz'] } },
      });
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
      expect(result.suggestions).toEqual([{ items: [{ label: 'baz' }], label: 'Label values for "bar"' }]);
    });

    it('returns label suggestions on aggregation context and metric w/ selector', async () => {
      const instance = new LanguageProvider(datasource, { labelKeys: { '{__name__="metric",foo="xx"}': ['bar'] } });
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
      expect(result.suggestions).toEqual([{ items: [{ label: 'bar' }], label: 'Labels' }]);
    });

    it('returns label suggestions on aggregation context and metric w/o selector', async () => {
      const instance = new LanguageProvider(datasource, { labelKeys: { '{__name__="metric"}': ['bar'] } });
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
      expect(result.suggestions).toEqual([{ items: [{ label: 'bar' }], label: 'Labels' }]);
    });

    it('returns label suggestions inside a multi-line aggregation context', async () => {
      const instance = new LanguageProvider(datasource, {
        labelKeys: { '{__name__="metric"}': ['label1', 'label2', 'label3'] },
      });
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
          items: [{ label: 'label1' }, { label: 'label2' }, { label: 'label3' }],
          label: 'Labels',
        },
      ]);
    });

    it('returns label suggestions inside an aggregation context with a range vector', async () => {
      const instance = new LanguageProvider(datasource, {
        labelKeys: { '{__name__="metric"}': ['label1', 'label2', 'label3'] },
      });
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
          items: [{ label: 'label1' }, { label: 'label2' }, { label: 'label3' }],
          label: 'Labels',
        },
      ]);
    });

    it('returns label suggestions inside an aggregation context with a range vector and label', async () => {
      const instance = new LanguageProvider(datasource, {
        labelKeys: { '{__name__="metric",label1="value"}': ['label1', 'label2', 'label3'] },
      });
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
          items: [{ label: 'label1' }, { label: 'label2' }, { label: 'label3' }],
          label: 'Labels',
        },
      ]);
    });

    it('returns no suggestions inside an unclear aggregation context using alternate syntax', async () => {
      const instance = new LanguageProvider(datasource, {
        labelKeys: { '{__name__="metric"}': ['label1', 'label2', 'label3'] },
      });
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
      const instance = new LanguageProvider(datasource, {
        labelKeys: { '{__name__="metric"}': ['label1', 'label2', 'label3'] },
      });
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
          items: [{ label: 'label1' }, { label: 'label2' }, { label: 'label3' }],
          label: 'Labels',
        },
      ]);
    });
  });
});
