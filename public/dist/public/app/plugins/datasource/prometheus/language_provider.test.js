import { __assign, __awaiter, __generator } from "tslib";
import Plain from 'slate-plain-serializer';
import { Editor as SlateEditor } from 'slate';
import LanguageProvider from './language_provider';
import { SearchFunctionType } from '@grafana/ui';
describe('Language completion provider', function () {
    var datasource = {
        metadataRequest: function () { return ({ data: { data: [] } }); },
        getTimeRangeParams: function () { return ({ start: '0', end: '1' }); },
    };
    describe('cleanText', function () {
        var cleanText = new LanguageProvider(datasource).cleanText;
        it('does not remove metric or label keys', function () {
            expect(cleanText('foo')).toBe('foo');
            expect(cleanText('foo_bar')).toBe('foo_bar');
        });
        it('keeps trailing space but removes leading', function () {
            expect(cleanText('foo ')).toBe('foo ');
            expect(cleanText(' foo')).toBe('foo');
        });
        it('removes label syntax', function () {
            expect(cleanText('foo="bar')).toBe('bar');
            expect(cleanText('foo!="bar')).toBe('bar');
            expect(cleanText('foo=~"bar')).toBe('bar');
            expect(cleanText('foo!~"bar')).toBe('bar');
            expect(cleanText('{bar')).toBe('bar');
        });
        it('removes previous operators', function () {
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
        it('removes aggregation syntax', function () {
            expect(cleanText('(bar')).toBe('bar');
            expect(cleanText('(foo,bar')).toBe('bar');
            expect(cleanText('(foo, bar')).toBe('bar');
        });
        it('removes range syntax', function () {
            expect(cleanText('[1m')).toBe('1m');
        });
    });
    describe('fetchSeries', function () {
        it('should use match[] parameter', function () {
            var languageProvider = new LanguageProvider(datasource);
            var fetchSeries = languageProvider.fetchSeries;
            var requestSpy = jest.spyOn(languageProvider, 'request');
            fetchSeries('{job="grafana"}');
            expect(requestSpy).toHaveBeenCalled();
            expect(requestSpy).toHaveBeenCalledWith('/api/v1/series', {}, { end: '1', 'match[]': '{job="grafana"}', start: '0' });
        });
    });
    describe('empty query suggestions', function () {
        it('returns no suggestions on empty context', function () { return __awaiter(void 0, void 0, void 0, function () {
            var instance, value, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        instance = new LanguageProvider(datasource);
                        value = Plain.deserialize('');
                        return [4 /*yield*/, instance.provideCompletionItems({ text: '', prefix: '', value: value, wrapperClasses: [] })];
                    case 1:
                        result = _a.sent();
                        expect(result.context).toBeUndefined();
                        expect(result.suggestions).toMatchObject([]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns no suggestions with metrics on empty context even when metrics were provided', function () { return __awaiter(void 0, void 0, void 0, function () {
            var instance, value, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        instance = new LanguageProvider(datasource);
                        instance.metrics = ['foo', 'bar'];
                        value = Plain.deserialize('');
                        return [4 /*yield*/, instance.provideCompletionItems({ text: '', prefix: '', value: value, wrapperClasses: [] })];
                    case 1:
                        result = _a.sent();
                        expect(result.context).toBeUndefined();
                        expect(result.suggestions).toMatchObject([]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns history on empty context when history was provided', function () { return __awaiter(void 0, void 0, void 0, function () {
            var instance, value, history, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        instance = new LanguageProvider(datasource);
                        value = Plain.deserialize('');
                        history = [
                            {
                                ts: 0,
                                query: { refId: '1', expr: 'metric' },
                            },
                        ];
                        return [4 /*yield*/, instance.provideCompletionItems({ text: '', prefix: '', value: value, wrapperClasses: [] }, { history: history })];
                    case 1:
                        result = _a.sent();
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
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('range suggestions', function () {
        it('returns range suggestions in range context', function () { return __awaiter(void 0, void 0, void 0, function () {
            var instance, value, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        instance = new LanguageProvider(datasource);
                        value = Plain.deserialize('1');
                        return [4 /*yield*/, instance.provideCompletionItems({
                                text: '1',
                                prefix: '1',
                                value: value,
                                wrapperClasses: ['context-range'],
                            })];
                    case 1:
                        result = _a.sent();
                        expect(result.context).toBe('context-range');
                        expect(result.suggestions).toMatchObject([
                            {
                                items: [
                                    { label: '$__interval', sortValue: '$__interval' },
                                    { label: '$__rate_interval', sortValue: '$__rate_interval' },
                                    { label: '$__range', sortValue: '$__range' },
                                    { label: '1m', sortValue: '00:01:00' },
                                    { label: '5m', sortValue: '00:05:00' },
                                    { label: '10m', sortValue: '00:10:00' },
                                    { label: '30m', sortValue: '00:30:00' },
                                    { label: '1h', sortValue: '01:00:00' },
                                    { label: '1d', sortValue: '24:00:00' },
                                ],
                                label: 'Range vector',
                            },
                        ]);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('metric suggestions', function () {
        it('returns history, metrics and function suggestions in an uknown context ', function () { return __awaiter(void 0, void 0, void 0, function () {
            var instance, history, value, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        instance = new LanguageProvider(datasource);
                        instance.metrics = ['foo', 'bar'];
                        history = [
                            {
                                ts: 0,
                                query: { refId: '1', expr: 'metric' },
                            },
                        ];
                        value = Plain.deserialize('m');
                        value = value.setSelection({ anchor: { offset: 1 }, focus: { offset: 1 } });
                        return [4 /*yield*/, instance.provideCompletionItems({ text: 'm', prefix: 'm', value: value, wrapperClasses: [] }, { history: history })];
                    case 1:
                        result = _a.sent();
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
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns no suggestions directly after a binary operator', function () { return __awaiter(void 0, void 0, void 0, function () {
            var instance, value, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        instance = new LanguageProvider(datasource);
                        instance.metrics = ['foo', 'bar'];
                        value = Plain.deserialize('*');
                        return [4 /*yield*/, instance.provideCompletionItems({ text: '*', prefix: '', value: value, wrapperClasses: [] })];
                    case 1:
                        result = _a.sent();
                        expect(result.context).toBeUndefined();
                        expect(result.suggestions).toMatchObject([]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns metric suggestions with prefix after a binary operator', function () { return __awaiter(void 0, void 0, void 0, function () {
            var instance, value, ed, valueWithSelection, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        instance = new LanguageProvider(datasource);
                        instance.metrics = ['foo', 'bar'];
                        value = Plain.deserialize('foo + b');
                        ed = new SlateEditor({ value: value });
                        valueWithSelection = ed.moveForward(7).value;
                        return [4 /*yield*/, instance.provideCompletionItems({
                                text: 'foo + b',
                                prefix: 'b',
                                value: valueWithSelection,
                                wrapperClasses: [],
                            })];
                    case 1:
                        result = _a.sent();
                        expect(result.context).toBeUndefined();
                        expect(result.suggestions).toMatchObject([
                            {
                                label: 'Functions',
                            },
                            {
                                label: 'Metrics',
                            },
                        ]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns no suggestions at the beginning of a non-empty function', function () { return __awaiter(void 0, void 0, void 0, function () {
            var instance, value, ed, valueWithSelection, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        instance = new LanguageProvider(datasource);
                        value = Plain.deserialize('sum(up)');
                        ed = new SlateEditor({ value: value });
                        valueWithSelection = ed.moveForward(4).value;
                        return [4 /*yield*/, instance.provideCompletionItems({
                                text: '',
                                prefix: '',
                                value: valueWithSelection,
                                wrapperClasses: [],
                            })];
                    case 1:
                        result = _a.sent();
                        expect(result.context).toBeUndefined();
                        expect(result.suggestions.length).toEqual(0);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('label suggestions', function () {
        it('returns default label suggestions on label context and no metric', function () { return __awaiter(void 0, void 0, void 0, function () {
            var instance, value, ed, valueWithSelection, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        instance = new LanguageProvider(datasource);
                        value = Plain.deserialize('{}');
                        ed = new SlateEditor({ value: value });
                        valueWithSelection = ed.moveForward(1).value;
                        return [4 /*yield*/, instance.provideCompletionItems({
                                text: '',
                                prefix: '',
                                wrapperClasses: ['context-labels'],
                                value: valueWithSelection,
                            })];
                    case 1:
                        result = _a.sent();
                        expect(result.context).toBe('context-labels');
                        expect(result.suggestions).toEqual([
                            {
                                items: [{ label: 'job' }, { label: 'instance' }],
                                label: 'Labels',
                                searchFunctionType: SearchFunctionType.Fuzzy,
                            },
                        ]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns label suggestions on label context and metric', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasources, instance, value, ed, valueWithSelection, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasources = {
                            metadataRequest: function () { return ({ data: { data: [{ __name__: 'metric', bar: 'bazinga' }] } }); },
                            getTimeRangeParams: function () { return ({ start: '0', end: '1' }); },
                        };
                        instance = new LanguageProvider(datasources);
                        value = Plain.deserialize('metric{}');
                        ed = new SlateEditor({ value: value });
                        valueWithSelection = ed.moveForward(7).value;
                        return [4 /*yield*/, instance.provideCompletionItems({
                                text: '',
                                prefix: '',
                                wrapperClasses: ['context-labels'],
                                value: valueWithSelection,
                            })];
                    case 1:
                        result = _a.sent();
                        expect(result.context).toBe('context-labels');
                        expect(result.suggestions).toEqual([
                            { items: [{ label: 'bar' }], label: 'Labels', searchFunctionType: SearchFunctionType.Fuzzy },
                        ]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns label suggestions on label context but leaves out labels that already exist', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasource, instance, value, ed, valueWithSelection, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasource = {
                            metadataRequest: function () { return ({
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
                            }); },
                            getTimeRangeParams: function () { return ({ start: '0', end: '1' }); },
                        };
                        instance = new LanguageProvider(datasource);
                        value = Plain.deserialize('{job1="foo",job2!="foo",job3=~"foo",__name__="metric",}');
                        ed = new SlateEditor({ value: value });
                        valueWithSelection = ed.moveForward(54).value;
                        return [4 /*yield*/, instance.provideCompletionItems({
                                text: '',
                                prefix: '',
                                wrapperClasses: ['context-labels'],
                                value: valueWithSelection,
                            })];
                    case 1:
                        result = _a.sent();
                        expect(result.context).toBe('context-labels');
                        expect(result.suggestions).toEqual([
                            { items: [{ label: 'bar' }], label: 'Labels', searchFunctionType: SearchFunctionType.Fuzzy },
                        ]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns label value suggestions inside a label value context after a negated matching operator', function () { return __awaiter(void 0, void 0, void 0, function () {
            var instance, value, ed, valueWithSelection, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        instance = new LanguageProvider(__assign(__assign({}, datasource), { metadataRequest: function () {
                                return { data: { data: ['value1', 'value2'] } };
                            } }));
                        value = Plain.deserialize('{job!=}');
                        ed = new SlateEditor({ value: value });
                        valueWithSelection = ed.moveForward(6).value;
                        return [4 /*yield*/, instance.provideCompletionItems({
                                text: '!=',
                                prefix: '',
                                wrapperClasses: ['context-labels'],
                                labelKey: 'job',
                                value: valueWithSelection,
                            })];
                    case 1:
                        result = _a.sent();
                        expect(result.context).toBe('context-label-values');
                        expect(result.suggestions).toEqual([
                            {
                                items: [{ label: 'value1' }, { label: 'value2' }],
                                label: 'Label values for "job"',
                                searchFunctionType: SearchFunctionType.Fuzzy,
                            },
                        ]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns a refresher on label context and unavailable metric', function () { return __awaiter(void 0, void 0, void 0, function () {
            var instance, value, ed, valueWithSelection, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        instance = new LanguageProvider(datasource);
                        value = Plain.deserialize('metric{}');
                        ed = new SlateEditor({ value: value });
                        valueWithSelection = ed.moveForward(7).value;
                        return [4 /*yield*/, instance.provideCompletionItems({
                                text: '',
                                prefix: '',
                                wrapperClasses: ['context-labels'],
                                value: valueWithSelection,
                            })];
                    case 1:
                        result = _a.sent();
                        expect(result.context).toBeUndefined();
                        expect(result.suggestions).toEqual([]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns label values on label context when given a metric and a label key', function () { return __awaiter(void 0, void 0, void 0, function () {
            var instance, value, ed, valueWithSelection, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        instance = new LanguageProvider(__assign(__assign({}, datasource), { metadataRequest: function () { return simpleMetricLabelsResponse; } }));
                        value = Plain.deserialize('metric{bar=ba}');
                        ed = new SlateEditor({ value: value });
                        valueWithSelection = ed.moveForward(13).value;
                        return [4 /*yield*/, instance.provideCompletionItems({
                                text: '=ba',
                                prefix: 'ba',
                                wrapperClasses: ['context-labels'],
                                labelKey: 'bar',
                                value: valueWithSelection,
                            })];
                    case 1:
                        result = _a.sent();
                        expect(result.context).toBe('context-label-values');
                        expect(result.suggestions).toEqual([
                            { items: [{ label: 'baz' }], label: 'Label values for "bar"', searchFunctionType: SearchFunctionType.Fuzzy },
                        ]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns label suggestions on aggregation context and metric w/ selector', function () { return __awaiter(void 0, void 0, void 0, function () {
            var instance, value, ed, valueWithSelection, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        instance = new LanguageProvider(__assign(__assign({}, datasource), { metadataRequest: function () { return simpleMetricLabelsResponse; } }));
                        value = Plain.deserialize('sum(metric{foo="xx"}) by ()');
                        ed = new SlateEditor({ value: value });
                        valueWithSelection = ed.moveForward(26).value;
                        return [4 /*yield*/, instance.provideCompletionItems({
                                text: '',
                                prefix: '',
                                wrapperClasses: ['context-aggregation'],
                                value: valueWithSelection,
                            })];
                    case 1:
                        result = _a.sent();
                        expect(result.context).toBe('context-aggregation');
                        expect(result.suggestions).toEqual([
                            { items: [{ label: 'bar' }], label: 'Labels', searchFunctionType: SearchFunctionType.Fuzzy },
                        ]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns label suggestions on aggregation context and metric w/o selector', function () { return __awaiter(void 0, void 0, void 0, function () {
            var instance, value, ed, valueWithSelection, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        instance = new LanguageProvider(__assign(__assign({}, datasource), { metadataRequest: function () { return simpleMetricLabelsResponse; } }));
                        value = Plain.deserialize('sum(metric) by ()');
                        ed = new SlateEditor({ value: value });
                        valueWithSelection = ed.moveForward(16).value;
                        return [4 /*yield*/, instance.provideCompletionItems({
                                text: '',
                                prefix: '',
                                wrapperClasses: ['context-aggregation'],
                                value: valueWithSelection,
                            })];
                    case 1:
                        result = _a.sent();
                        expect(result.context).toBe('context-aggregation');
                        expect(result.suggestions).toEqual([
                            { items: [{ label: 'bar' }], label: 'Labels', searchFunctionType: SearchFunctionType.Fuzzy },
                        ]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns label suggestions inside a multi-line aggregation context', function () { return __awaiter(void 0, void 0, void 0, function () {
            var instance, value, aggregationTextBlock, ed, valueWithSelection, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        instance = new LanguageProvider(__assign(__assign({}, datasource), { metadataRequest: function () { return simpleMetricLabelsResponse; } }));
                        value = Plain.deserialize('sum(\nmetric\n)\nby ()');
                        aggregationTextBlock = value.document.getBlocks().get(3);
                        ed = new SlateEditor({ value: value });
                        ed.moveToStartOfNode(aggregationTextBlock);
                        valueWithSelection = ed.moveForward(4).value;
                        return [4 /*yield*/, instance.provideCompletionItems({
                                text: '',
                                prefix: '',
                                wrapperClasses: ['context-aggregation'],
                                value: valueWithSelection,
                            })];
                    case 1:
                        result = _a.sent();
                        expect(result.context).toBe('context-aggregation');
                        expect(result.suggestions).toEqual([
                            {
                                items: [{ label: 'bar' }],
                                label: 'Labels',
                                searchFunctionType: SearchFunctionType.Fuzzy,
                            },
                        ]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns label suggestions inside an aggregation context with a range vector', function () { return __awaiter(void 0, void 0, void 0, function () {
            var instance, value, ed, valueWithSelection, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        instance = new LanguageProvider(__assign(__assign({}, datasource), { metadataRequest: function () { return simpleMetricLabelsResponse; } }));
                        value = Plain.deserialize('sum(rate(metric[1h])) by ()');
                        ed = new SlateEditor({ value: value });
                        valueWithSelection = ed.moveForward(26).value;
                        return [4 /*yield*/, instance.provideCompletionItems({
                                text: '',
                                prefix: '',
                                wrapperClasses: ['context-aggregation'],
                                value: valueWithSelection,
                            })];
                    case 1:
                        result = _a.sent();
                        expect(result.context).toBe('context-aggregation');
                        expect(result.suggestions).toEqual([
                            {
                                items: [{ label: 'bar' }],
                                label: 'Labels',
                                searchFunctionType: SearchFunctionType.Fuzzy,
                            },
                        ]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns label suggestions inside an aggregation context with a range vector and label', function () { return __awaiter(void 0, void 0, void 0, function () {
            var instance, value, ed, valueWithSelection, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        instance = new LanguageProvider(__assign(__assign({}, datasource), { metadataRequest: function () { return simpleMetricLabelsResponse; } }));
                        value = Plain.deserialize('sum(rate(metric{label1="value"}[1h])) by ()');
                        ed = new SlateEditor({ value: value });
                        valueWithSelection = ed.moveForward(42).value;
                        return [4 /*yield*/, instance.provideCompletionItems({
                                text: '',
                                prefix: '',
                                wrapperClasses: ['context-aggregation'],
                                value: valueWithSelection,
                            })];
                    case 1:
                        result = _a.sent();
                        expect(result.context).toBe('context-aggregation');
                        expect(result.suggestions).toEqual([
                            {
                                items: [{ label: 'bar' }],
                                label: 'Labels',
                                searchFunctionType: SearchFunctionType.Fuzzy,
                            },
                        ]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns no suggestions inside an unclear aggregation context using alternate syntax', function () { return __awaiter(void 0, void 0, void 0, function () {
            var instance, value, ed, valueWithSelection, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        instance = new LanguageProvider(datasource);
                        value = Plain.deserialize('sum by ()');
                        ed = new SlateEditor({ value: value });
                        valueWithSelection = ed.moveForward(8).value;
                        return [4 /*yield*/, instance.provideCompletionItems({
                                text: '',
                                prefix: '',
                                wrapperClasses: ['context-aggregation'],
                                value: valueWithSelection,
                            })];
                    case 1:
                        result = _a.sent();
                        expect(result.context).toBe('context-aggregation');
                        expect(result.suggestions).toEqual([]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns label suggestions inside an aggregation context using alternate syntax', function () { return __awaiter(void 0, void 0, void 0, function () {
            var instance, value, ed, valueWithSelection, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        instance = new LanguageProvider(__assign(__assign({}, datasource), { metadataRequest: function () { return simpleMetricLabelsResponse; } }));
                        value = Plain.deserialize('sum by () (metric)');
                        ed = new SlateEditor({ value: value });
                        valueWithSelection = ed.moveForward(8).value;
                        return [4 /*yield*/, instance.provideCompletionItems({
                                text: '',
                                prefix: '',
                                wrapperClasses: ['context-aggregation'],
                                value: valueWithSelection,
                            })];
                    case 1:
                        result = _a.sent();
                        expect(result.context).toBe('context-aggregation');
                        expect(result.suggestions).toEqual([
                            {
                                items: [{ label: 'bar' }],
                                label: 'Labels',
                                searchFunctionType: SearchFunctionType.Fuzzy,
                            },
                        ]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('does not re-fetch default labels', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasource, instance, value, ed, valueWithSelection, args, promise1, promise2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasource = {
                            metadataRequest: jest.fn(function () { return ({ data: { data: [] } }); }),
                            getTimeRangeParams: jest.fn(function () { return ({ start: '0', end: '1' }); }),
                        };
                        instance = new LanguageProvider(datasource);
                        value = Plain.deserialize('{}');
                        ed = new SlateEditor({ value: value });
                        valueWithSelection = ed.moveForward(1).value;
                        args = {
                            text: '',
                            prefix: '',
                            wrapperClasses: ['context-labels'],
                            value: valueWithSelection,
                        };
                        promise1 = instance.provideCompletionItems(args);
                        // one call for 2 default labels job, instance
                        expect(datasource.metadataRequest.mock.calls.length).toBe(2);
                        promise2 = instance.provideCompletionItems(args);
                        expect(datasource.metadataRequest.mock.calls.length).toBe(2);
                        return [4 /*yield*/, Promise.all([promise1, promise2])];
                    case 1:
                        _a.sent();
                        expect(datasource.metadataRequest.mock.calls.length).toBe(2);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('disabled metrics lookup', function () {
        it('does not issue any metadata requests when lookup is disabled', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasource, instance, value, ed, valueWithSelection, args;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasource = {
                            metadataRequest: jest.fn(function () { return ({ data: { data: ['foo', 'bar'] } }); }),
                            getTimeRangeParams: jest.fn(function () { return ({ start: '0', end: '1' }); }),
                            lookupsDisabled: true,
                        };
                        instance = new LanguageProvider(datasource);
                        value = Plain.deserialize('{}');
                        ed = new SlateEditor({ value: value });
                        valueWithSelection = ed.moveForward(1).value;
                        args = {
                            text: '',
                            prefix: '',
                            wrapperClasses: ['context-labels'],
                            value: valueWithSelection,
                        };
                        expect(datasource.metadataRequest.mock.calls.length).toBe(0);
                        return [4 /*yield*/, instance.start()];
                    case 1:
                        _a.sent();
                        expect(datasource.metadataRequest.mock.calls.length).toBe(0);
                        return [4 /*yield*/, instance.provideCompletionItems(args)];
                    case 2:
                        _a.sent();
                        expect(datasource.metadataRequest.mock.calls.length).toBe(0);
                        return [2 /*return*/];
                }
            });
        }); });
        it('issues metadata requests when lookup is not disabled', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasource, instance;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasource = {
                            metadataRequest: jest.fn(function () { return ({ data: { data: ['foo', 'bar'] } }); }),
                            getTimeRangeParams: jest.fn(function () { return ({ start: '0', end: '1' }); }),
                            lookupsDisabled: false,
                        };
                        instance = new LanguageProvider(datasource);
                        expect(datasource.metadataRequest.mock.calls.length).toBe(0);
                        return [4 /*yield*/, instance.start()];
                    case 1:
                        _a.sent();
                        expect(datasource.metadataRequest.mock.calls.length).toBeGreaterThan(0);
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
var simpleMetricLabelsResponse = {
    data: {
        data: [
            {
                __name__: 'metric',
                bar: 'baz',
            },
        ],
    },
};
//# sourceMappingURL=language_provider.test.js.map