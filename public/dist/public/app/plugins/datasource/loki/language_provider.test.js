import { __awaiter, __generator } from "tslib";
import Plain from 'slate-plain-serializer';
import LanguageProvider from './language_provider';
import { makeMockLokiDatasource } from './mocks';
jest.mock('app/store/store', function () { return ({
    store: {
        getState: jest.fn().mockReturnValue({
            explore: {
                left: {
                    mode: 'Logs',
                },
            },
        }),
    },
}); });
describe('Language completion provider', function () {
    var datasource = makeMockLokiDatasource({});
    describe('query suggestions', function () {
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
                        expect(result.suggestions.length).toEqual(0);
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
                                query: { refId: '1', expr: '{app="foo"}' },
                                ts: 1,
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
                                        label: '{app="foo"}',
                                    },
                                ],
                            },
                        ]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns function and history suggestions', function () { return __awaiter(void 0, void 0, void 0, function () {
            var instance, input, history, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        instance = new LanguageProvider(datasource);
                        input = createTypeaheadInput('m', 'm', undefined, 1, [], instance);
                        history = [
                            {
                                query: { refId: '1', expr: '{app="foo"}' },
                                ts: 1,
                            },
                        ];
                        return [4 /*yield*/, instance.provideCompletionItems(input, { history: history })];
                    case 1:
                        result = _a.sent();
                        expect(result.context).toBeUndefined();
                        expect(result.suggestions.length).toEqual(2);
                        expect(result.suggestions[0].label).toEqual('History');
                        expect(result.suggestions[1].label).toEqual('Functions');
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns pipe operations on pipe context', function () { return __awaiter(void 0, void 0, void 0, function () {
            var instance, input, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        instance = new LanguageProvider(datasource);
                        input = createTypeaheadInput('{app="test"} | ', ' ', '', 15, ['context-pipe']);
                        return [4 /*yield*/, instance.provideCompletionItems(input)];
                    case 1:
                        result = _a.sent();
                        expect(result.context).toBeUndefined();
                        expect(result.suggestions.length).toEqual(2);
                        expect(result.suggestions[0].label).toEqual('Operators');
                        expect(result.suggestions[1].label).toEqual('Parsers');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('fetchSeries', function () {
        it('should use match[] parameter', function () {
            var datasource = makeMockLokiDatasource({}, { '{foo="bar"}': [{ label1: 'label_val1' }] });
            var languageProvider = new LanguageProvider(datasource);
            var fetchSeries = languageProvider.fetchSeries;
            var requestSpy = jest.spyOn(languageProvider, 'request');
            fetchSeries('{job="grafana"}');
            expect(requestSpy).toHaveBeenCalledWith('/loki/api/v1/series', {
                end: 1560163909000,
                'match[]': '{job="grafana"}',
                start: 1560153109000,
            });
        });
    });
    describe('label key suggestions', function () {
        it('returns all label suggestions on empty selector', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasource, provider, input, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasource = makeMockLokiDatasource({ label1: [], label2: [] });
                        return [4 /*yield*/, getLanguageProvider(datasource)];
                    case 1:
                        provider = _a.sent();
                        input = createTypeaheadInput('{}', '', '', 1);
                        return [4 /*yield*/, provider.provideCompletionItems(input)];
                    case 2:
                        result = _a.sent();
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
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns all label suggestions on selector when starting to type', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasource, provider, input, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasource = makeMockLokiDatasource({ label1: [], label2: [] });
                        return [4 /*yield*/, getLanguageProvider(datasource)];
                    case 1:
                        provider = _a.sent();
                        input = createTypeaheadInput('{l}', '', '', 2);
                        return [4 /*yield*/, provider.provideCompletionItems(input)];
                    case 2:
                        result = _a.sent();
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
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('label suggestions facetted', function () {
        it('returns facetted label suggestions based on selector', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasource, provider, input, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasource = makeMockLokiDatasource({ label1: [], label2: [] }, { '{foo="bar"}': [{ label1: 'label_val1' }] });
                        return [4 /*yield*/, getLanguageProvider(datasource)];
                    case 1:
                        provider = _a.sent();
                        input = createTypeaheadInput('{foo="bar",}', '', '', 11);
                        return [4 /*yield*/, provider.provideCompletionItems(input)];
                    case 2:
                        result = _a.sent();
                        expect(result.context).toBe('context-labels');
                        expect(result.suggestions).toEqual([{ items: [{ label: 'label1' }], label: 'Labels' }]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns facetted label suggestions for multipule selectors', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasource, provider, input, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasource = makeMockLokiDatasource({ label1: [], label2: [] }, { '{baz="42",foo="bar"}': [{ label2: 'label_val2' }] });
                        return [4 /*yield*/, getLanguageProvider(datasource)];
                    case 1:
                        provider = _a.sent();
                        input = createTypeaheadInput('{baz="42",foo="bar",}', '', '', 20);
                        return [4 /*yield*/, provider.provideCompletionItems(input)];
                    case 2:
                        result = _a.sent();
                        expect(result.context).toBe('context-labels');
                        expect(result.suggestions).toEqual([{ items: [{ label: 'label2' }], label: 'Labels' }]);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('label suggestions', function () {
        it('returns label values suggestions from Loki', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasource, provider, input, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasource = makeMockLokiDatasource({ label1: ['label1_val1', 'label1_val2'], label2: [] });
                        return [4 /*yield*/, getLanguageProvider(datasource)];
                    case 1:
                        provider = _a.sent();
                        input = createTypeaheadInput('{label1=}', '=', 'label1');
                        return [4 /*yield*/, provider.provideCompletionItems(input)];
                    case 2:
                        result = _a.sent();
                        return [4 /*yield*/, provider.provideCompletionItems(input)];
                    case 3:
                        result = _a.sent();
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
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns label values suggestions from Loki when re-editing', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasource, provider, input, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasource = makeMockLokiDatasource({ label1: ['label1_val1', 'label1_val2'], label2: [] });
                        return [4 /*yield*/, getLanguageProvider(datasource)];
                    case 1:
                        provider = _a.sent();
                        input = createTypeaheadInput('{label1="label1_v"}', 'label1_v', 'label1', 17, [
                            'attr-value',
                            'context-labels',
                        ]);
                        return [4 /*yield*/, provider.provideCompletionItems(input)];
                    case 2:
                        result = _a.sent();
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
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('label values', function () {
        it('should fetch label values if not cached', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasource, provider, requestSpy, labelValues;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasource = makeMockLokiDatasource({ testkey: ['label1_val1', 'label1_val2'], label2: [] });
                        return [4 /*yield*/, getLanguageProvider(datasource)];
                    case 1:
                        provider = _a.sent();
                        requestSpy = jest.spyOn(provider, 'request');
                        return [4 /*yield*/, provider.fetchLabelValues('testkey')];
                    case 2:
                        labelValues = _a.sent();
                        expect(requestSpy).toHaveBeenCalled();
                        expect(labelValues).toEqual(['label1_val1', 'label1_val2']);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should return cached values', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasource, provider, requestSpy, labelValues, nextLabelValues;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasource = makeMockLokiDatasource({ testkey: ['label1_val1', 'label1_val2'], label2: [] });
                        return [4 /*yield*/, getLanguageProvider(datasource)];
                    case 1:
                        provider = _a.sent();
                        requestSpy = jest.spyOn(provider, 'request');
                        return [4 /*yield*/, provider.fetchLabelValues('testkey')];
                    case 2:
                        labelValues = _a.sent();
                        expect(requestSpy).toHaveBeenCalledTimes(1);
                        expect(labelValues).toEqual(['label1_val1', 'label1_val2']);
                        return [4 /*yield*/, provider.fetchLabelValues('testkey')];
                    case 3:
                        nextLabelValues = _a.sent();
                        expect(requestSpy).toHaveBeenCalledTimes(1);
                        expect(nextLabelValues).toEqual(['label1_val1', 'label1_val2']);
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
describe('Request URL', function () {
    it('should contain range params', function () { return __awaiter(void 0, void 0, void 0, function () {
        var datasourceWithLabels, rangeParams, datasourceSpy, instance, expectedUrl;
        return __generator(this, function (_a) {
            datasourceWithLabels = makeMockLokiDatasource({ other: [] });
            rangeParams = datasourceWithLabels.getTimeRangeParams();
            datasourceSpy = jest.spyOn(datasourceWithLabels, 'metadataRequest');
            instance = new LanguageProvider(datasourceWithLabels);
            instance.fetchLabels();
            expectedUrl = '/loki/api/v1/label';
            expect(datasourceSpy).toHaveBeenCalledWith(expectedUrl, rangeParams);
            return [2 /*return*/];
        });
    }); });
});
describe('Query imports', function () {
    var datasource = makeMockLokiDatasource({});
    it('returns empty queries for unknown origin datasource', function () { return __awaiter(void 0, void 0, void 0, function () {
        var instance, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    instance = new LanguageProvider(datasource);
                    return [4 /*yield*/, instance.importQueries([{ refId: 'bar', expr: 'foo' }], {
                            meta: { id: 'unknown' },
                        })];
                case 1:
                    result = _a.sent();
                    expect(result).toEqual([{ refId: 'bar', expr: '' }]);
                    return [2 /*return*/];
            }
        });
    }); });
    describe('prometheus query imports', function () {
        it('always results in range query type', function () { return __awaiter(void 0, void 0, void 0, function () {
            var instance, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        instance = new LanguageProvider(datasource);
                        return [4 /*yield*/, instance.importQueries([{ refId: 'bar', expr: '{job="grafana"}', instant: true, range: false }], {
                                meta: { id: 'prometheus' },
                            })];
                    case 1:
                        result = _a.sent();
                        expect(result).toEqual([{ refId: 'bar', expr: '{job="grafana"}', range: true }]);
                        expect(result).not.toHaveProperty('instant');
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns empty query from metric-only query', function () { return __awaiter(void 0, void 0, void 0, function () {
            var instance, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        instance = new LanguageProvider(datasource);
                        return [4 /*yield*/, instance.importPrometheusQuery('foo')];
                    case 1:
                        result = _a.sent();
                        expect(result).toEqual('');
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns empty query from selector query if label is not available', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasourceWithLabels, instance, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasourceWithLabels = makeMockLokiDatasource({ other: [] });
                        instance = new LanguageProvider(datasourceWithLabels);
                        return [4 /*yield*/, instance.importPrometheusQuery('{foo="bar"}')];
                    case 1:
                        result = _a.sent();
                        expect(result).toEqual('{}');
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns selector query from selector query with common labels', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasourceWithLabels, instance, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasourceWithLabels = makeMockLokiDatasource({ foo: [] });
                        instance = new LanguageProvider(datasourceWithLabels);
                        return [4 /*yield*/, instance.importPrometheusQuery('metric{foo="bar",baz="42"}')];
                    case 1:
                        result = _a.sent();
                        expect(result).toEqual('{foo="bar"}');
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns selector query from selector query with all labels if logging label list is empty', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasourceWithLabels, instance, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasourceWithLabels = makeMockLokiDatasource({});
                        instance = new LanguageProvider(datasourceWithLabels);
                        return [4 /*yield*/, instance.importPrometheusQuery('metric{foo="bar",baz="42"}')];
                    case 1:
                        result = _a.sent();
                        expect(result).toEqual('{baz="42",foo="bar"}');
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
function getLanguageProvider(datasource) {
    return __awaiter(this, void 0, void 0, function () {
        var instance;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    instance = new LanguageProvider(datasource);
                    return [4 /*yield*/, instance.start()];
                case 1:
                    _a.sent();
                    return [2 /*return*/, instance];
            }
        });
    });
}
/**
 * @param value Value of the full input
 * @param text Last piece of text (not sure but in case of {label=} this would be just '=')
 * @param labelKey Label by which to search for values. Cutting corners a bit here as this should be inferred from value
 */
function createTypeaheadInput(value, text, labelKey, anchorOffset, wrapperClasses, instance) {
    var deserialized = Plain.deserialize(value);
    var range = deserialized.selection.setAnchor(deserialized.selection.anchor.setOffset(anchorOffset || 1));
    var valueWithSelection = deserialized.setSelection(range);
    return {
        text: text,
        prefix: instance ? instance.cleanText(text) : '',
        wrapperClasses: wrapperClasses || ['context-labels'],
        value: valueWithSelection,
        labelKey: labelKey,
    };
}
//# sourceMappingURL=language_provider.test.js.map