import Plain from 'slate-plain-serializer';
import { Editor as SlateEditor } from 'slate';
import LanguageProvider from './language_provider';
import { PrometheusDatasource } from './datasource';
import { HistoryItem } from '@grafana/data';
import { PromQuery } from './types';
import Mock = jest.Mock;

describe('Language completion provider', () => {
  const datasource: PrometheusDatasource = ({
    metadataRequest: () => ({ data: { data: [] as any[] } }),
    getTimeRange: () => ({ start: 0, end: 1 }),
  } as any) as PrometheusDatasource;

  describe('cleanText', () => {
    const cleanText = new LanguageProvider(datasource).cleanText;
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

  describe('empty query suggestions', () => {
    it('returns no suggestions on empty context', async () => {
      const instance = new LanguageProvider(datasource);
      const value = Plain.deserialize('');
      const result = await instance.provideCompletionItems({ text: '', prefix: '', value, wrapperClasses: [] });
      expect(result.context).toBeUndefined();
      expect(result.suggestions).toMatchObject([]);
    });

    it('returns no suggestions with metrics on empty context even when metrics were provided', async () => {
      const instance = new LanguageProvider(datasource);
      instance.metrics = ['foo', 'bar'];
      const value = Plain.deserialize('');
      const result = await instance.provideCompletionItems({ text: '', prefix: '', value, wrapperClasses: [] });
      expect(result.context).toBeUndefined();
      expect(result.suggestions).toMatchObject([]);
    });

    it('returns history on empty context when history was provided', async () => {
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
    it('returns history, metrics and function suggestions in an uknown context ', async () => {
      const instance = new LanguageProvider(datasource);
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
      const instance = new LanguageProvider(datasource);
      instance.metrics = ['foo', 'bar'];
      const value = Plain.deserialize('*');
      const result = await instance.provideCompletionItems({ text: '*', prefix: '', value, wrapperClasses: [] });
      expect(result.context).toBeUndefined();
      expect(result.suggestions).toMatchObject([]);
    });

    it('returns metric suggestions with prefix after a binary operator', async () => {
      const instance = new LanguageProvider(datasource);
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
      const instance = new LanguageProvider(datasource);
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
      instance.lookupsDisabled = false;
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
      const instance = new LanguageProvider(datasources);
      instance.lookupsDisabled = false;
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
      const datasource: PrometheusDatasource = ({
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
      const instance = new LanguageProvider(datasource);
      instance.lookupsDisabled = false;
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
      const instance = new LanguageProvider(({
        ...datasource,
        metadataRequest: () => {
          return { data: { data: ['value1', 'value2'] } };
        },
      } as any) as PrometheusDatasource);
      instance.lookupsDisabled = false;
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
        },
      ]);
    });

    it('returns a refresher on label context and unavailable metric', async () => {
      const instance = new LanguageProvider(datasource);
      instance.lookupsDisabled = false;
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
      const instance = new LanguageProvider(({
        ...datasource,
        metadataRequest: () => simpleMetricLabelsResponse,
      } as any) as PrometheusDatasource);
      instance.lookupsDisabled = false;
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
      const instance = new LanguageProvider(({
        ...datasource,
        metadataRequest: () => simpleMetricLabelsResponse,
      } as any) as PrometheusDatasource);
      instance.lookupsDisabled = false;
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
      const instance = new LanguageProvider(({
        ...datasource,
        metadataRequest: () => simpleMetricLabelsResponse,
      } as any) as PrometheusDatasource);
      instance.lookupsDisabled = false;
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
      const instance = new LanguageProvider(({
        ...datasource,
        metadataRequest: () => simpleMetricLabelsResponse,
      } as any) as PrometheusDatasource);
      instance.lookupsDisabled = false;
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
        },
      ]);
    });

    it('returns label suggestions inside an aggregation context with a range vector', async () => {
      const instance = new LanguageProvider(({
        ...datasource,
        metadataRequest: () => simpleMetricLabelsResponse,
      } as any) as PrometheusDatasource);
      instance.lookupsDisabled = false;
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
        },
      ]);
    });

    it('returns label suggestions inside an aggregation context with a range vector and label', async () => {
      const instance = new LanguageProvider(({
        ...datasource,
        metadataRequest: () => simpleMetricLabelsResponse,
      } as any) as PrometheusDatasource);
      instance.lookupsDisabled = false;
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
        },
      ]);
    });

    it('returns no suggestions inside an unclear aggregation context using alternate syntax', async () => {
      const instance = new LanguageProvider(datasource);
      instance.lookupsDisabled = false;
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
      const instance = new LanguageProvider(({
        ...datasource,
        metadataRequest: () => simpleMetricLabelsResponse,
      } as any) as PrometheusDatasource);
      instance.lookupsDisabled = false;
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
        },
      ]);
    });

    it('does not re-fetch default labels', async () => {
      const datasource: PrometheusDatasource = ({
        metadataRequest: jest.fn(() => ({ data: { data: [] as any[] } })),
        getTimeRange: jest.fn(() => ({ start: 0, end: 1 })),
      } as any) as PrometheusDatasource;

      const instance = new LanguageProvider(datasource);
      instance.lookupsDisabled = false;
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
      expect((datasource.metadataRequest as Mock).mock.calls.length).toBe(2);
      const promise2 = instance.provideCompletionItems(args);
      expect((datasource.metadataRequest as Mock).mock.calls.length).toBe(2);
      await Promise.all([promise1, promise2]);
      expect((datasource.metadataRequest as Mock).mock.calls.length).toBe(2);
    });
  });

  describe('dynamic lookup protection for big installations', () => {
    it('dynamic lookup is enabled if number of metrics is reasonably low', async () => {
      const datasource: PrometheusDatasource = ({
        metadataRequest: () => ({ data: { data: ['foo'] as string[] } }),
        getTimeRange: () => ({ start: 0, end: 1 }),
      } as any) as PrometheusDatasource;

      const instance = new LanguageProvider(datasource, { lookupMetricsThreshold: 1 });
      expect(instance.lookupsDisabled).toBeTruthy();
      await instance.start();
      expect(instance.lookupsDisabled).toBeFalsy();
    });

    it('dynamic lookup is disabled if number of metrics is higher than threshold', async () => {
      const datasource: PrometheusDatasource = ({
        metadataRequest: () => ({ data: { data: ['foo', 'bar'] as string[] } }),
        getTimeRange: () => ({ start: 0, end: 1 }),
      } as any) as PrometheusDatasource;

      const instance = new LanguageProvider(datasource, { lookupMetricsThreshold: 1 });
      expect(instance.lookupsDisabled).toBeTruthy();
      await instance.start();
      expect(instance.lookupsDisabled).toBeTruthy();
    });

    it('does not issue label-based metadata requests when lookup is disabled', async () => {
      const datasource: PrometheusDatasource = ({
        metadataRequest: jest.fn(() => ({ data: { data: ['foo', 'bar'] as string[] } })),
        getTimeRange: jest.fn(() => ({ start: 0, end: 1 })),
      } as any) as PrometheusDatasource;

      const instance = new LanguageProvider(datasource, { lookupMetricsThreshold: 1 });
      const value = Plain.deserialize('{}');
      const ed = new SlateEditor({ value });
      const valueWithSelection = ed.moveForward(1).value;
      const args = {
        text: '',
        prefix: '',
        wrapperClasses: ['context-labels'],
        value: valueWithSelection,
      };
      expect(instance.lookupsDisabled).toBeTruthy();
      expect((datasource.metadataRequest as Mock).mock.calls.length).toBe(0);
      await instance.start();
      expect(instance.lookupsDisabled).toBeTruthy();
      // Capture request count to metadata
      const callCount = (datasource.metadataRequest as Mock).mock.calls.length;
      expect((datasource.metadataRequest as Mock).mock.calls.length).toBeGreaterThan(0);
      await instance.provideCompletionItems(args);
      expect((datasource.metadataRequest as Mock).mock.calls.length).toBe(callCount);
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
