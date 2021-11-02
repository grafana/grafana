import { __awaiter, __generator } from "tslib";
import { dispatch } from 'app/store/store';
import gfunc from '../gfunc';
import { TemplateSrvStub } from 'test/specs/helpers';
import { silenceConsoleOutput } from 'test/core/utils/silenceConsoleOutput';
import { actions } from '../state/actions';
import { getAltSegmentsSelectables, getTagsSelectables, getTagsAsSegmentsSelectables } from '../state/providers';
import { createStore } from '../state/store';
jest.mock('app/core/utils/promiseToDigest', function () { return ({
    promiseToDigest: function (scope) {
        return function (p) { return p; };
    },
}); });
jest.mock('app/store/store', function () { return ({
    dispatch: jest.fn(),
}); });
var mockDispatch = dispatch;
/**
 * Simulate switching to text editor, changing the query and switching back to visual editor
 */
function changeTarget(ctx, target) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.dispatch(actions.toggleEditorMode())];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, ctx.dispatch(actions.updateQuery({ query: target }))];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, ctx.dispatch(actions.runQuery())];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, ctx.dispatch(actions.toggleEditorMode())];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
describe('Graphite actions', function () { return __awaiter(void 0, void 0, void 0, function () {
    var ctx;
    return __generator(this, function (_a) {
        ctx = {
            datasource: {
                metricFindQuery: jest.fn(function () { return Promise.resolve([]); }),
                getFuncDefs: jest.fn(function () { return Promise.resolve(gfunc.getFuncDefs('1.0')); }),
                getFuncDef: gfunc.getFuncDef,
                waitForFuncDefsLoaded: jest.fn(function () { return Promise.resolve(null); }),
                createFuncInstance: gfunc.createFuncInstance,
                getTagsAutoComplete: jest.fn().mockReturnValue(Promise.resolve([])),
            },
            target: { target: 'aliasByNode(scaleToSeconds(test.prod.*,1),2)' },
        };
        beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        jest.clearAllMocks();
                        ctx.state = null;
                        ctx.dispatch = createStore(function (state) {
                            ctx.state = state;
                        });
                        return [4 /*yield*/, ctx.dispatch(actions.init({
                                datasource: ctx.datasource,
                                target: ctx.target,
                                refresh: jest.fn(),
                                queries: [],
                                //@ts-ignore
                                templateSrv: new TemplateSrvStub(),
                            }))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        describe('init', function () {
            it('should validate metric key exists', function () {
                expect(ctx.datasource.metricFindQuery.mock.calls[0][0]).toBe('test.prod.*');
            });
            it('should not delete last segment if no metrics are found', function () {
                expect(ctx.state.segments[2].value).not.toBe('select metric');
                expect(ctx.state.segments[2].value).toBe('*');
            });
            it('should parse expression and build function model', function () {
                expect(ctx.state.queryModel.functions.length).toBe(2);
            });
        });
        describe('when toggling edit mode to raw and back again', function () {
            beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.dispatch(actions.toggleEditorMode())];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, ctx.dispatch(actions.toggleEditorMode())];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should validate metric key exists', function () {
                var lastCallIndex = ctx.datasource.metricFindQuery.mock.calls.length - 1;
                expect(ctx.datasource.metricFindQuery.mock.calls[lastCallIndex][0]).toBe('test.prod.*');
            });
            it('should delete last segment if no metrics are found', function () {
                expect(ctx.state.segments[0].value).toBe('test');
                expect(ctx.state.segments[1].value).toBe('prod');
                expect(ctx.state.segments[2].value).toBe('select metric');
            });
            it('should parse expression and build function model', function () {
                expect(ctx.state.queryModel.functions.length).toBe(2);
            });
        });
        describe('when middle segment value of test.prod.* is changed', function () {
            beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
                var segment;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            segment = { type: 'metric', value: 'test', expandable: true };
                            return [4 /*yield*/, ctx.dispatch(actions.segmentValueChanged({ segment: segment, index: 1 }))];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should validate metric key exists', function () {
                var lastCallIndex = ctx.datasource.metricFindQuery.mock.calls.length - 1;
                expect(ctx.datasource.metricFindQuery.mock.calls[lastCallIndex][0]).toBe('test.test.*');
            });
            it('should delete last segment if no metrics are found', function () {
                expect(ctx.state.segments[0].value).toBe('test');
                expect(ctx.state.segments[1].value).toBe('test');
                expect(ctx.state.segments[2].value).toBe('select metric');
            });
            it('should parse expression and build function model', function () {
                expect(ctx.state.queryModel.functions.length).toBe(2);
            });
        });
        describe('when adding function', function () {
            beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ctx.state.datasource.metricFindQuery = function () { return Promise.resolve([{ expandable: false }]); };
                            return [4 /*yield*/, changeTarget(ctx, 'test.prod.*.count')];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, ctx.dispatch(actions.addFunction({ name: 'aliasByNode' }))];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should add function with correct node number', function () {
                expect(ctx.state.queryModel.functions[0].params[0]).toBe(2);
            });
            it('should update target', function () {
                expect(ctx.state.target.target).toBe('aliasByNode(test.prod.*.count, 2)');
            });
            it('should call refresh', function () {
                expect(ctx.state.refresh).toHaveBeenCalled();
            });
        });
        describe('when adding function before any metric segment', function () {
            beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ctx.state.datasource.metricFindQuery = function () { return Promise.resolve([{ expandable: true }]); };
                            return [4 /*yield*/, changeTarget(ctx, '')];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, ctx.dispatch(actions.addFunction({ name: 'asPercent' }))];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should add function and remove select metric link', function () {
                expect(ctx.state.segments.length).toBe(0);
            });
        });
        describe('when initializing a target with single param func using variable', function () {
            beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ctx.state.datasource.metricFindQuery = function () { return Promise.resolve([]); };
                            return [4 /*yield*/, changeTarget(ctx, 'movingAverage(prod.count, $var)')];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should add 2 segments', function () {
                expect(ctx.state.segments.length).toBe(2);
            });
            it('should add function param', function () {
                expect(ctx.state.queryModel.functions[0].params.length).toBe(1);
            });
        });
        describe('when changing the query from the outside', function () {
            it('should update the model', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ctx.state.datasource.metricFindQuery = function () { return Promise.resolve([{ text: '*' }]); };
                            return [4 /*yield*/, changeTarget(ctx, 'my.query.*')];
                        case 1:
                            _a.sent();
                            expect(ctx.state.target.target).toBe('my.query.*');
                            expect(ctx.state.segments[0].value).toBe('my');
                            expect(ctx.state.segments[1].value).toBe('query');
                            return [4 /*yield*/, ctx.dispatch(actions.queryChanged({ target: 'new.metrics.*', refId: 'A' }))];
                        case 2:
                            _a.sent();
                            expect(ctx.state.target.target).toBe('new.metrics.*');
                            expect(ctx.state.segments[0].value).toBe('new');
                            expect(ctx.state.segments[1].value).toBe('metrics');
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('when initializing target without metric expression and function with series-ref', function () {
            beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ctx.state.datasource.metricFindQuery = function () { return Promise.resolve([]); };
                            return [4 /*yield*/, changeTarget(ctx, 'asPercent(metric.node.count, #A)')];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should add segments', function () {
                expect(ctx.state.segments.length).toBe(3);
            });
            it('should have correct func params', function () {
                expect(ctx.state.queryModel.functions[0].params.length).toBe(1);
            });
        });
        describe('when getting altSegments and metricFindQuery returns empty array', function () {
            beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            ctx.state.datasource.metricFindQuery = function () { return Promise.resolve([]); };
                            return [4 /*yield*/, changeTarget(ctx, 'test.count')];
                        case 1:
                            _b.sent();
                            _a = ctx;
                            return [4 /*yield*/, getAltSegmentsSelectables(ctx.state, 1, '')];
                        case 2:
                            _a.altSegments = _b.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should have no segments', function () {
                expect(ctx.altSegments.length).toBe(0);
            });
        });
        describe('when autocomplete for metric names is not available', function () {
            silenceConsoleOutput();
            beforeEach(function () {
                ctx.state.datasource.getTagsAutoComplete = jest.fn().mockReturnValue(Promise.resolve([]));
                ctx.state.datasource.metricFindQuery = jest.fn().mockReturnValue(new Promise(function () {
                    throw new Error();
                }));
            });
            it('getAltSegmentsSelectables should handle autocomplete errors', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, expect(function () { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, getAltSegmentsSelectables(ctx.state, 0, 'any')];
                                        case 1:
                                            _a.sent();
                                            expect(mockDispatch).toBeCalledWith(expect.objectContaining({
                                                type: 'appNotifications/notifyApp',
                                            }));
                                            return [2 /*return*/];
                                    }
                                });
                            }); }).not.toThrow()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('getAltSegmentsSelectables should display the error message only once', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getAltSegmentsSelectables(ctx.state, 0, 'any')];
                        case 1:
                            _a.sent();
                            expect(mockDispatch.mock.calls.length).toBe(1);
                            return [4 /*yield*/, getAltSegmentsSelectables(ctx.state, 0, 'any')];
                        case 2:
                            _a.sent();
                            expect(mockDispatch.mock.calls.length).toBe(1);
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('when autocomplete for tags is not available', function () {
            silenceConsoleOutput();
            beforeEach(function () {
                ctx.datasource.metricFindQuery = jest.fn().mockReturnValue(Promise.resolve([]));
                ctx.datasource.getTagsAutoComplete = jest.fn().mockReturnValue(new Promise(function () {
                    throw new Error();
                }));
            });
            it('getTagsSelectables should handle autocomplete errors', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, expect(function () { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, getTagsSelectables(ctx.state, 0, 'any')];
                                        case 1:
                                            _a.sent();
                                            expect(mockDispatch).toBeCalledWith(expect.objectContaining({
                                                type: 'appNotifications/notifyApp',
                                            }));
                                            return [2 /*return*/];
                                    }
                                });
                            }); }).not.toThrow()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('getTagsSelectables should display the error message only once', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getTagsSelectables(ctx.state, 0, 'any')];
                        case 1:
                            _a.sent();
                            expect(mockDispatch.mock.calls.length).toBe(1);
                            return [4 /*yield*/, getTagsSelectables(ctx.state, 0, 'any')];
                        case 2:
                            _a.sent();
                            expect(mockDispatch.mock.calls.length).toBe(1);
                            return [2 /*return*/];
                    }
                });
            }); });
            it('getTagsAsSegmentsSelectables should handle autocomplete errors', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, expect(function () { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, getTagsAsSegmentsSelectables(ctx.state, 'any')];
                                        case 1:
                                            _a.sent();
                                            expect(mockDispatch).toBeCalledWith(expect.objectContaining({
                                                type: 'appNotifications/notifyApp',
                                            }));
                                            return [2 /*return*/];
                                    }
                                });
                            }); }).not.toThrow()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('getTagsAsSegmentsSelectables should display the error message only once', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getTagsAsSegmentsSelectables(ctx.state, 'any')];
                        case 1:
                            _a.sent();
                            expect(mockDispatch.mock.calls.length).toBe(1);
                            return [4 /*yield*/, getTagsAsSegmentsSelectables(ctx.state, 'any')];
                        case 2:
                            _a.sent();
                            expect(mockDispatch.mock.calls.length).toBe(1);
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('targetChanged', function () {
            beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
                var newQuery;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            newQuery = 'aliasByNode(scaleToSeconds(test.prod.*, 1), 2)';
                            ctx.state.datasource.metricFindQuery = function () { return Promise.resolve([{ expandable: false }]); };
                            return [4 /*yield*/, changeTarget(ctx, newQuery)];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should rebuild target after expression model', function () {
                expect(ctx.state.target.target).toBe('aliasByNode(scaleToSeconds(test.prod.*, 1), 2)');
            });
            it('should call refresh', function () {
                expect(ctx.state.refresh).toHaveBeenCalled();
            });
        });
        describe('when updating targets with nested query', function () {
            beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ctx.state.datasource.metricFindQuery = function () { return Promise.resolve([{ expandable: false }]); };
                            return [4 /*yield*/, changeTarget(ctx, 'scaleToSeconds(#A, 60)')];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should add function params', function () {
                expect(ctx.state.queryModel.segments.length).toBe(1);
                expect(ctx.state.queryModel.segments[0].value).toBe('#A');
                expect(ctx.state.queryModel.functions[0].params.length).toBe(1);
                expect(ctx.state.queryModel.functions[0].params[0]).toBe(60);
            });
            it('target should remain the same', function () {
                expect(ctx.state.target.target).toBe('scaleToSeconds(#A, 60)');
            });
            it('targetFull should include nested queries', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.dispatch(actions.queriesChanged([
                                {
                                    target: 'nested.query.count',
                                    refId: 'A',
                                },
                            ]))];
                        case 1:
                            _a.sent();
                            expect(ctx.state.target.target).toBe('scaleToSeconds(#A, 60)');
                            expect(ctx.state.target.targetFull).toBe('scaleToSeconds(nested.query.count, 60)');
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('target interpolation', function () {
            beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ctx.datasource.metricFindQuery = function () { return Promise.resolve([{ expandable: false }]); };
                            ctx.state.target.refId = 'A';
                            return [4 /*yield*/, changeTarget(ctx, 'sumSeries(#B)')];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('when updating target used in other query, targetFull of other query should update', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ctx.state.queries = [ctx.state.target, { target: 'metrics.foo.count', refId: 'B' }];
                            return [4 /*yield*/, changeTarget(ctx, 'sumSeries(#B)')];
                        case 1:
                            _a.sent();
                            expect(ctx.state.queryModel.target.targetFull).toBe('sumSeries(metrics.foo.count)');
                            return [2 /*return*/];
                    }
                });
            }); });
            it('when updating target from a query from other data source, targetFull of other query should not update', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ctx.state.queries = [ctx.state.target, { someOtherProperty: 'metrics.foo.count', refId: 'B' }];
                            return [4 /*yield*/, changeTarget(ctx, 'sumSeries(#B)')];
                        case 1:
                            _a.sent();
                            expect(ctx.state.queryModel.target.targetFull).toBeUndefined();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('when adding seriesByTag function', function () {
            beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ctx.state.datasource.metricFindQuery = function () { return Promise.resolve([{ expandable: false }]); };
                            return [4 /*yield*/, changeTarget(ctx, '')];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, ctx.dispatch(actions.addFunction({ name: 'seriesByTag' }))];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should update functions', function () {
                expect(ctx.state.queryModel.getSeriesByTagFuncIndex()).toBe(0);
            });
            it('should update seriesByTagUsed flag', function () {
                expect(ctx.state.queryModel.seriesByTagUsed).toBe(true);
            });
            it('should update target', function () {
                expect(ctx.state.target.target).toBe('seriesByTag()');
            });
            it('should call refresh', function () {
                expect(ctx.state.refresh).toHaveBeenCalled();
            });
        });
        describe('when parsing seriesByTag function', function () {
            beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ctx.state.datasource.metricFindQuery = function () { return Promise.resolve([{ expandable: false }]); };
                            return [4 /*yield*/, changeTarget(ctx, "seriesByTag('tag1=value1', 'tag2!=~value2')")];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should add tags', function () {
                var expected = [
                    { key: 'tag1', operator: '=', value: 'value1' },
                    { key: 'tag2', operator: '!=~', value: 'value2' },
                ];
                expect(ctx.state.queryModel.tags).toEqual(expected);
            });
        });
        describe('when tag added', function () {
            beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ctx.state.datasource.metricFindQuery = function () { return Promise.resolve([{ expandable: false }]); };
                            return [4 /*yield*/, changeTarget(ctx, 'seriesByTag()')];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, ctx.dispatch(actions.addNewTag({ segment: { value: 'tag1' } }))];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should update tags with default value', function () {
                var expected = [{ key: 'tag1', operator: '=', value: '' }];
                expect(ctx.state.queryModel.tags).toEqual(expected);
            });
            it('should update target', function () {
                var expected = "seriesByTag('tag1=')";
                expect(ctx.state.target.target).toEqual(expected);
            });
        });
        describe('when tag changed', function () {
            beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ctx.state.datasource.metricFindQuery = function () { return Promise.resolve([{ expandable: false }]); };
                            return [4 /*yield*/, changeTarget(ctx, "seriesByTag('tag1=value1', 'tag2!=~value2')")];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, ctx.dispatch(actions.tagChanged({ tag: { key: 'tag1', operator: '=', value: 'new_value' }, index: 0 }))];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should update tags', function () {
                var expected = [
                    { key: 'tag1', operator: '=', value: 'new_value' },
                    { key: 'tag2', operator: '!=~', value: 'value2' },
                ];
                expect(ctx.state.queryModel.tags).toEqual(expected);
            });
            it('should update target', function () {
                var expected = "seriesByTag('tag1=new_value', 'tag2!=~value2')";
                expect(ctx.state.target.target).toEqual(expected);
            });
        });
        describe('when tag removed', function () {
            beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ctx.state.datasource.metricFindQuery = function () { return Promise.resolve([{ expandable: false }]); };
                            return [4 /*yield*/, changeTarget(ctx, "seriesByTag('tag1=value1', 'tag2!=~value2')")];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, ctx.dispatch(actions.tagChanged({ tag: { key: ctx.state.removeTagValue, operator: '=', value: '' }, index: 0 }))];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should update tags', function () {
                var expected = [{ key: 'tag2', operator: '!=~', value: 'value2' }];
                expect(ctx.state.queryModel.tags).toEqual(expected);
            });
            it('should update target', function () {
                var expected = "seriesByTag('tag2!=~value2')";
                expect(ctx.state.target.target).toEqual(expected);
            });
        });
        return [2 /*return*/];
    });
}); });
//# sourceMappingURL=store.test.js.map