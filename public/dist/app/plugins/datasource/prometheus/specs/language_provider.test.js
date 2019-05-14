import Plain from 'slate-plain-serializer';
import LanguageProvider from '../language_provider';
describe('Language completion provider', function () {
    var datasource = {
        metadataRequest: function () { return ({ data: { data: [] } }); },
    };
    describe('empty query suggestions', function () {
        it('returns default suggestions on emtpty context', function () {
            var instance = new LanguageProvider(datasource);
            var value = Plain.deserialize('');
            var result = instance.provideCompletionItems({ text: '', prefix: '', value: value, wrapperClasses: [] });
            expect(result.context).toBeUndefined();
            expect(result.refresher).toBeUndefined();
            expect(result.suggestions).toMatchObject([
                {
                    label: 'Functions',
                },
            ]);
        });
        it('returns default suggestions with metrics on emtpty context when metrics were provided', function () {
            var instance = new LanguageProvider(datasource, { metrics: ['foo', 'bar'] });
            var value = Plain.deserialize('');
            var result = instance.provideCompletionItems({ text: '', prefix: '', value: value, wrapperClasses: [] });
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
        it('returns default suggestions with history on emtpty context when history was provided', function () {
            var instance = new LanguageProvider(datasource);
            var value = Plain.deserialize('');
            var history = [
                {
                    query: { refId: '1', expr: 'metric' },
                },
            ];
            var result = instance.provideCompletionItems({ text: '', prefix: '', value: value, wrapperClasses: [] }, { history: history });
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
    describe('range suggestions', function () {
        it('returns range suggestions in range context', function () {
            var instance = new LanguageProvider(datasource);
            var value = Plain.deserialize('1');
            var result = instance.provideCompletionItems({
                text: '1',
                prefix: '1',
                value: value,
                wrapperClasses: ['context-range'],
            });
            expect(result.context).toBe('context-range');
            expect(result.refresher).toBeUndefined();
            expect(result.suggestions).toMatchObject([
                {
                    items: [
                        { label: '1m' },
                        { label: '5m' },
                        { label: '10m' },
                        { label: '30m' },
                        { label: '1h' },
                        { label: '1d' },
                    ],
                    label: 'Range vector',
                },
            ]);
        });
    });
    describe('metric suggestions', function () {
        it('returns metrics and function suggestions in an unknown context', function () {
            var instance = new LanguageProvider(datasource, { metrics: ['foo', 'bar'] });
            var value = Plain.deserialize('a');
            var result = instance.provideCompletionItems({ text: 'a', prefix: 'a', value: value, wrapperClasses: [] });
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
        it('returns metrics and function  suggestions after a binary operator', function () {
            var instance = new LanguageProvider(datasource, { metrics: ['foo', 'bar'] });
            var value = Plain.deserialize('*');
            var result = instance.provideCompletionItems({ text: '*', prefix: '', value: value, wrapperClasses: [] });
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
        it('returns no suggestions at the beginning of a non-empty function', function () {
            var instance = new LanguageProvider(datasource, { metrics: ['foo', 'bar'] });
            var value = Plain.deserialize('sum(up)');
            var range = value.selection.merge({
                anchorOffset: 4,
            });
            var valueWithSelection = value.change().select(range).value;
            var result = instance.provideCompletionItems({
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
    describe('label suggestions', function () {
        it('returns default label suggestions on label context and no metric', function () {
            var instance = new LanguageProvider(datasource);
            var value = Plain.deserialize('{}');
            var range = value.selection.merge({
                anchorOffset: 1,
            });
            var valueWithSelection = value.change().select(range).value;
            var result = instance.provideCompletionItems({
                text: '',
                prefix: '',
                wrapperClasses: ['context-labels'],
                value: valueWithSelection,
            });
            expect(result.context).toBe('context-labels');
            expect(result.suggestions).toEqual([{ items: [{ label: 'job' }, { label: 'instance' }], label: 'Labels' }]);
        });
        it('returns label suggestions on label context and metric', function () {
            var instance = new LanguageProvider(datasource, { labelKeys: { '{__name__="metric"}': ['bar'] } });
            var value = Plain.deserialize('metric{}');
            var range = value.selection.merge({
                anchorOffset: 7,
            });
            var valueWithSelection = value.change().select(range).value;
            var result = instance.provideCompletionItems({
                text: '',
                prefix: '',
                wrapperClasses: ['context-labels'],
                value: valueWithSelection,
            });
            expect(result.context).toBe('context-labels');
            expect(result.suggestions).toEqual([{ items: [{ label: 'bar' }], label: 'Labels' }]);
        });
        it('returns label suggestions on label context but leaves out labels that already exist', function () {
            var instance = new LanguageProvider(datasource, {
                labelKeys: { '{job1="foo",job2!="foo",job3=~"foo"}': ['bar', 'job1', 'job2', 'job3'] },
            });
            var value = Plain.deserialize('{job1="foo",job2!="foo",job3=~"foo",}');
            var range = value.selection.merge({
                anchorOffset: 36,
            });
            var valueWithSelection = value.change().select(range).value;
            var result = instance.provideCompletionItems({
                text: '',
                prefix: '',
                wrapperClasses: ['context-labels'],
                value: valueWithSelection,
            });
            expect(result.context).toBe('context-labels');
            expect(result.suggestions).toEqual([{ items: [{ label: 'bar' }], label: 'Labels' }]);
        });
        it('returns label value suggestions inside a label value context after a negated matching operator', function () {
            var instance = new LanguageProvider(datasource, {
                labelKeys: { '{}': ['label'] },
                labelValues: { '{}': { label: ['a', 'b', 'c'] } },
            });
            var value = Plain.deserialize('{label!=}');
            var range = value.selection.merge({ anchorOffset: 8 });
            var valueWithSelection = value.change().select(range).value;
            var result = instance.provideCompletionItems({
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
        it('returns a refresher on label context and unavailable metric', function () {
            var instance = new LanguageProvider(datasource, { labelKeys: { '{__name__="foo"}': ['bar'] } });
            var value = Plain.deserialize('metric{}');
            var range = value.selection.merge({
                anchorOffset: 7,
            });
            var valueWithSelection = value.change().select(range).value;
            var result = instance.provideCompletionItems({
                text: '',
                prefix: '',
                wrapperClasses: ['context-labels'],
                value: valueWithSelection,
            });
            expect(result.context).toBeUndefined();
            expect(result.refresher).toBeInstanceOf(Promise);
            expect(result.suggestions).toEqual([]);
        });
        it('returns label values on label context when given a metric and a label key', function () {
            var instance = new LanguageProvider(datasource, {
                labelKeys: { '{__name__="metric"}': ['bar'] },
                labelValues: { '{__name__="metric"}': { bar: ['baz'] } },
            });
            var value = Plain.deserialize('metric{bar=ba}');
            var range = value.selection.merge({
                anchorOffset: 13,
            });
            var valueWithSelection = value.change().select(range).value;
            var result = instance.provideCompletionItems({
                text: '=ba',
                prefix: 'ba',
                wrapperClasses: ['context-labels'],
                labelKey: 'bar',
                value: valueWithSelection,
            });
            expect(result.context).toBe('context-label-values');
            expect(result.suggestions).toEqual([{ items: [{ label: 'baz' }], label: 'Label values for "bar"' }]);
        });
        it('returns label suggestions on aggregation context and metric w/ selector', function () {
            var instance = new LanguageProvider(datasource, { labelKeys: { '{__name__="metric",foo="xx"}': ['bar'] } });
            var value = Plain.deserialize('sum(metric{foo="xx"}) by ()');
            var range = value.selection.merge({
                anchorOffset: 26,
            });
            var valueWithSelection = value.change().select(range).value;
            var result = instance.provideCompletionItems({
                text: '',
                prefix: '',
                wrapperClasses: ['context-aggregation'],
                value: valueWithSelection,
            });
            expect(result.context).toBe('context-aggregation');
            expect(result.suggestions).toEqual([{ items: [{ label: 'bar' }], label: 'Labels' }]);
        });
        it('returns label suggestions on aggregation context and metric w/o selector', function () {
            var instance = new LanguageProvider(datasource, { labelKeys: { '{__name__="metric"}': ['bar'] } });
            var value = Plain.deserialize('sum(metric) by ()');
            var range = value.selection.merge({
                anchorOffset: 16,
            });
            var valueWithSelection = value.change().select(range).value;
            var result = instance.provideCompletionItems({
                text: '',
                prefix: '',
                wrapperClasses: ['context-aggregation'],
                value: valueWithSelection,
            });
            expect(result.context).toBe('context-aggregation');
            expect(result.suggestions).toEqual([{ items: [{ label: 'bar' }], label: 'Labels' }]);
        });
        it('returns label suggestions inside a multi-line aggregation context', function () {
            var instance = new LanguageProvider(datasource, {
                labelKeys: { '{__name__="metric"}': ['label1', 'label2', 'label3'] },
            });
            var value = Plain.deserialize('sum(\nmetric\n)\nby ()');
            var aggregationTextBlock = value.document.getBlocksAsArray()[3];
            var range = value.selection.moveToStartOf(aggregationTextBlock).merge({ anchorOffset: 4 });
            var valueWithSelection = value.change().select(range).value;
            var result = instance.provideCompletionItems({
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
        it('returns label suggestions inside an aggregation context with a range vector', function () {
            var instance = new LanguageProvider(datasource, {
                labelKeys: { '{__name__="metric"}': ['label1', 'label2', 'label3'] },
            });
            var value = Plain.deserialize('sum(rate(metric[1h])) by ()');
            var range = value.selection.merge({
                anchorOffset: 26,
            });
            var valueWithSelection = value.change().select(range).value;
            var result = instance.provideCompletionItems({
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
        it('returns label suggestions inside an aggregation context with a range vector and label', function () {
            var instance = new LanguageProvider(datasource, {
                labelKeys: { '{__name__="metric",label1="value"}': ['label1', 'label2', 'label3'] },
            });
            var value = Plain.deserialize('sum(rate(metric{label1="value"}[1h])) by ()');
            var range = value.selection.merge({
                anchorOffset: 42,
            });
            var valueWithSelection = value.change().select(range).value;
            var result = instance.provideCompletionItems({
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
        it('returns no suggestions inside an unclear aggregation context using alternate syntax', function () {
            var instance = new LanguageProvider(datasource, {
                labelKeys: { '{__name__="metric"}': ['label1', 'label2', 'label3'] },
            });
            var value = Plain.deserialize('sum by ()');
            var range = value.selection.merge({
                anchorOffset: 8,
            });
            var valueWithSelection = value.change().select(range).value;
            var result = instance.provideCompletionItems({
                text: '',
                prefix: '',
                wrapperClasses: ['context-aggregation'],
                value: valueWithSelection,
            });
            expect(result.context).toBe('context-aggregation');
            expect(result.suggestions).toEqual([]);
        });
        it('returns label suggestions inside an aggregation context using alternate syntax', function () {
            var instance = new LanguageProvider(datasource, {
                labelKeys: { '{__name__="metric"}': ['label1', 'label2', 'label3'] },
            });
            var value = Plain.deserialize('sum by () (metric)');
            var range = value.selection.merge({
                anchorOffset: 8,
            });
            var valueWithSelection = value.change().select(range).value;
            var result = instance.provideCompletionItems({
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
//# sourceMappingURL=language_provider.test.js.map