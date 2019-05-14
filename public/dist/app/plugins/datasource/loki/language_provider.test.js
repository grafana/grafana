var _this = this;
import * as tslib_1 from "tslib";
import Plain from 'slate-plain-serializer';
import LanguageProvider from './language_provider';
describe('Language completion provider', function () {
    var datasource = {
        metadataRequest: function () { return ({ data: { data: [] } }); },
    };
    describe('empty query suggestions', function () {
        it('returns no suggestions on emtpty context', function () {
            var instance = new LanguageProvider(datasource);
            var value = Plain.deserialize('');
            var result = instance.provideCompletionItems({ text: '', prefix: '', value: value, wrapperClasses: [] });
            expect(result.context).toBeUndefined();
            expect(result.refresher).toBeUndefined();
            expect(result.suggestions.length).toEqual(0);
        });
        it('returns default suggestions with history on emtpty context when history was provided', function () {
            var instance = new LanguageProvider(datasource);
            var value = Plain.deserialize('');
            var history = [
                {
                    query: { refId: '1', expr: '{app="foo"}' },
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
                            label: '{app="foo"}',
                        },
                    ],
                },
            ]);
        });
        it('returns no suggestions within regexp', function () {
            var instance = new LanguageProvider(datasource);
            var value = Plain.deserialize('{} ()');
            var range = value.selection.merge({
                anchorOffset: 4,
            });
            var valueWithSelection = value.change().select(range).value;
            var history = [
                {
                    query: { refId: '1', expr: '{app="foo"}' },
                },
            ];
            var result = instance.provideCompletionItems({
                text: '',
                prefix: '',
                value: valueWithSelection,
                wrapperClasses: [],
            }, { history: history });
            expect(result.context).toBeUndefined();
            expect(result.refresher).toBeUndefined();
            expect(result.suggestions.length).toEqual(0);
        });
    });
    describe('label suggestions', function () {
        it('returns default label suggestions on label context', function () {
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
            expect(result.suggestions).toEqual([{ items: [{ label: 'job' }, { label: 'namespace' }], label: 'Labels' }]);
        });
    });
});
describe('Query imports', function () {
    var datasource = {
        metadataRequest: function () { return ({ data: { data: [] } }); },
    };
    it('returns empty queries for unknown origin datasource', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var instance, result;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    instance = new LanguageProvider(datasource);
                    return [4 /*yield*/, instance.importQueries([{ refId: 'bar', expr: 'foo' }], 'unknown')];
                case 1:
                    result = _a.sent();
                    expect(result).toEqual([{ refId: 'bar', expr: '' }]);
                    return [2 /*return*/];
            }
        });
    }); });
    describe('prometheus query imports', function () {
        it('returns empty query from metric-only query', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var instance, result;
            return tslib_1.__generator(this, function (_a) {
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
        it('returns empty query from selector query if label is not available', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var datasourceWithLabels, instance, result;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasourceWithLabels = {
                            metadataRequest: function (url) { return (url === '/api/prom/label' ? { data: { data: ['other'] } } : { data: { data: [] } }); },
                        };
                        instance = new LanguageProvider(datasourceWithLabels);
                        return [4 /*yield*/, instance.importPrometheusQuery('{foo="bar"}')];
                    case 1:
                        result = _a.sent();
                        expect(result).toEqual('{}');
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns selector query from selector query with common labels', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var datasourceWithLabels, instance, result;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasourceWithLabels = {
                            metadataRequest: function (url) { return (url === '/api/prom/label' ? { data: { data: ['foo'] } } : { data: { data: [] } }); },
                        };
                        instance = new LanguageProvider(datasourceWithLabels);
                        return [4 /*yield*/, instance.importPrometheusQuery('metric{foo="bar",baz="42"}')];
                    case 1:
                        result = _a.sent();
                        expect(result).toEqual('{foo="bar"}');
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns selector query from selector query with all labels if logging label list is empty', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var datasourceWithLabels, instance, result;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasourceWithLabels = {
                            metadataRequest: function (url) { return (url === '/api/prom/label' ? { data: { data: [] } } : { data: { data: [] } }); },
                        };
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
//# sourceMappingURL=language_provider.test.js.map