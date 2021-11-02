var _a;
import { __assign, __awaiter, __generator } from "tslib";
import { addQueryRowAction, addResultsToCache, cancelQueries, cancelQueriesAction, clearCache, importQueries, loadLogsVolumeData, queryReducer, runQueries, scanStartAction, scanStopAction, } from './query';
import { ExploreId } from 'app/types';
import { interval, of } from 'rxjs';
import { ArrayVector, DefaultTimeZone, LoadingState, MutableDataFrame, toUtc, } from '@grafana/data';
import { thunkTester } from 'test/core/thunk/thunkTester';
import { makeExplorePaneState } from './utils';
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { configureStore } from '../../../store/configureStore';
import { setTimeSrv } from '../../dashboard/services/TimeSrv';
import { config } from '@grafana/runtime';
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { config: __assign(__assign({}, jest.requireActual('@grafana/runtime').config), { featureToggles: {
            fullRangeLogsVolume: true,
            autoLoadFullRangeLogsVolume: false,
        } }) })); });
var t = toUtc();
var testRange = {
    from: t,
    to: t,
    raw: {
        from: t,
        to: t,
    },
};
var defaultInitialState = {
    user: {
        orgId: '1',
        timeZone: DefaultTimeZone,
    },
    explore: (_a = {},
        _a[ExploreId.left] = {
            datasourceInstance: {
                query: jest.fn(),
                getRef: jest.fn(),
                meta: {
                    id: 'something',
                },
            },
            initialized: true,
            containerWidth: 1920,
            eventBridge: { emit: function () { } },
            queries: [{ expr: 'test' }],
            range: testRange,
            refreshInterval: {
                label: 'Off',
                value: 0,
            },
            cache: [],
        },
        _a),
};
function setupQueryResponse(state) {
    var _a;
    ((_a = state.explore[ExploreId.left].datasourceInstance) === null || _a === void 0 ? void 0 : _a.query).mockReturnValueOnce(of({
        error: { message: 'test error' },
        data: [
            new MutableDataFrame({
                fields: [{ name: 'test', values: new ArrayVector() }],
                meta: {
                    preferredVisualisationType: 'graph',
                },
            }),
        ],
    }));
}
describe('runQueries', function () {
    it('should pass dataFrames to state even if there is error in response', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, dispatch, getState;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    setTimeSrv({
                        init: function () { },
                    });
                    _a = configureStore(__assign({}, defaultInitialState)), dispatch = _a.dispatch, getState = _a.getState;
                    setupQueryResponse(getState());
                    return [4 /*yield*/, dispatch(runQueries(ExploreId.left))];
                case 1:
                    _b.sent();
                    expect(getState().explore[ExploreId.left].showMetrics).toBeTruthy();
                    expect(getState().explore[ExploreId.left].graphResult).toBeDefined();
                    return [2 /*return*/];
            }
        });
    }); });
});
describe('running queries', function () {
    it('should cancel running query when cancelQueries is dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
        var unsubscribable, exploreId, initialState, dispatchedActions;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    unsubscribable = interval(1000);
                    unsubscribable.subscribe();
                    exploreId = ExploreId.left;
                    initialState = {
                        explore: (_a = {},
                            _a[exploreId] = {
                                datasourceInstance: { name: 'testDs' },
                                initialized: true,
                                loading: true,
                                querySubscription: unsubscribable,
                                queries: ['A'],
                                range: testRange,
                            },
                            _a),
                        user: {
                            orgId: 'A',
                        },
                    };
                    return [4 /*yield*/, thunkTester(initialState)
                            .givenThunk(cancelQueries)
                            .whenThunkIsDispatched(exploreId)];
                case 1:
                    dispatchedActions = _b.sent();
                    expect(dispatchedActions).toEqual([scanStopAction({ exploreId: exploreId }), cancelQueriesAction({ exploreId: exploreId })]);
                    return [2 /*return*/];
            }
        });
    }); });
});
describe('importing queries', function () {
    describe('when importing queries between the same type of data source', function () {
        it('remove datasource property from all of the queries', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, dispatch, getState;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = configureStore(__assign(__assign({}, defaultInitialState), { explore: (_b = {},
                                _b[ExploreId.left] = __assign(__assign({}, defaultInitialState.explore[ExploreId.left]), { datasourceInstance: { name: 'testDs', type: 'postgres' } }),
                                _b) })), dispatch = _a.dispatch, getState = _a.getState;
                        return [4 /*yield*/, dispatch(importQueries(ExploreId.left, [
                                { datasource: { type: 'postgresql' }, refId: 'refId_A' },
                                { datasource: { type: 'postgresql' }, refId: 'refId_B' },
                            ], { name: 'Postgres1', type: 'postgres' }, { name: 'Postgres2', type: 'postgres' }))];
                    case 1:
                        _c.sent();
                        expect(getState().explore[ExploreId.left].queries[0]).toHaveProperty('refId', 'refId_A');
                        expect(getState().explore[ExploreId.left].queries[1]).toHaveProperty('refId', 'refId_B');
                        expect(getState().explore[ExploreId.left].queries[0]).not.toHaveProperty('datasource');
                        expect(getState().explore[ExploreId.left].queries[1]).not.toHaveProperty('datasource');
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
describe('reducer', function () {
    describe('scanning', function () {
        it('should start scanning', function () {
            var initialState = __assign(__assign({}, makeExplorePaneState()), { scanning: false });
            reducerTester()
                .givenReducer(queryReducer, initialState)
                .whenActionIsDispatched(scanStartAction({ exploreId: ExploreId.left }))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { scanning: true }));
        });
        it('should stop scanning', function () {
            var initialState = __assign(__assign({}, makeExplorePaneState()), { scanning: true, scanRange: {} });
            reducerTester()
                .givenReducer(queryReducer, initialState)
                .whenActionIsDispatched(scanStopAction({ exploreId: ExploreId.left }))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { scanning: false, scanRange: undefined }));
        });
    });
    describe('query rows', function () {
        it('adds a new query row', function () {
            reducerTester()
                .givenReducer(queryReducer, {
                queries: [],
            })
                .whenActionIsDispatched(addQueryRowAction({
                exploreId: ExploreId.left,
                query: { refId: 'A', key: 'mockKey' },
                index: 0,
            }))
                .thenStateShouldEqual({
                queries: [{ refId: 'A', key: 'mockKey' }],
                queryKeys: ['mockKey-0'],
            });
        });
    });
    describe('caching', function () {
        it('should add response to cache', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, dispatch, getState;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = configureStore(__assign(__assign({}, defaultInitialState), { explore: (_b = {},
                                _b[ExploreId.left] = __assign(__assign({}, defaultInitialState.explore[ExploreId.left]), { queryResponse: {
                                        series: [{ name: 'test name' }],
                                        state: LoadingState.Done,
                                    }, absoluteRange: { from: 1621348027000, to: 1621348050000 } }),
                                _b) })), dispatch = _a.dispatch, getState = _a.getState;
                        return [4 /*yield*/, dispatch(addResultsToCache(ExploreId.left))];
                    case 1:
                        _c.sent();
                        expect(getState().explore[ExploreId.left].cache).toEqual([
                            { key: 'from=1621348027000&to=1621348050000', value: { series: [{ name: 'test name' }], state: 'Done' } },
                        ]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should not add response to cache if response is still loading', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, dispatch, getState;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = configureStore(__assign(__assign({}, defaultInitialState), { explore: (_b = {},
                                _b[ExploreId.left] = __assign(__assign({}, defaultInitialState.explore[ExploreId.left]), { queryResponse: { series: [{ name: 'test name' }], state: LoadingState.Loading }, absoluteRange: { from: 1621348027000, to: 1621348050000 } }),
                                _b) })), dispatch = _a.dispatch, getState = _a.getState;
                        return [4 /*yield*/, dispatch(addResultsToCache(ExploreId.left))];
                    case 1:
                        _c.sent();
                        expect(getState().explore[ExploreId.left].cache).toEqual([]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should not add duplicate response to cache', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, dispatch, getState;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = configureStore(__assign(__assign({}, defaultInitialState), { explore: (_b = {},
                                _b[ExploreId.left] = __assign(__assign({}, defaultInitialState.explore[ExploreId.left]), { queryResponse: {
                                        series: [{ name: 'test name' }],
                                        state: LoadingState.Done,
                                    }, absoluteRange: { from: 1621348027000, to: 1621348050000 }, cache: [
                                        {
                                            key: 'from=1621348027000&to=1621348050000',
                                            value: { series: [{ name: 'old test name' }], state: LoadingState.Done },
                                        },
                                    ] }),
                                _b) })), dispatch = _a.dispatch, getState = _a.getState;
                        return [4 /*yield*/, dispatch(addResultsToCache(ExploreId.left))];
                    case 1:
                        _c.sent();
                        expect(getState().explore[ExploreId.left].cache).toHaveLength(1);
                        expect(getState().explore[ExploreId.left].cache).toEqual([
                            { key: 'from=1621348027000&to=1621348050000', value: { series: [{ name: 'old test name' }], state: 'Done' } },
                        ]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should clear cache', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, dispatch, getState;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = configureStore(__assign(__assign({}, defaultInitialState), { explore: (_b = {},
                                _b[ExploreId.left] = __assign(__assign({}, defaultInitialState.explore[ExploreId.left]), { cache: [
                                        {
                                            key: 'from=1621348027000&to=1621348050000',
                                            value: { series: [{ name: 'old test name' }], state: 'Done' },
                                        },
                                    ] }),
                                _b) })), dispatch = _a.dispatch, getState = _a.getState;
                        return [4 /*yield*/, dispatch(clearCache(ExploreId.left))];
                    case 1:
                        _c.sent();
                        expect(getState().explore[ExploreId.left].cache).toEqual([]);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('logs volume', function () {
        var dispatch, getState, unsubscribes, mockLogsVolumeDataProvider;
        beforeEach(function () {
            var _a;
            mockLogsVolumeDataProvider = function () {
                return of({ state: LoadingState.Loading, error: undefined, data: [] }, { state: LoadingState.Done, error: undefined, data: [{}] });
            };
            var store = configureStore(__assign(__assign({}, defaultInitialState), { explore: (_a = {},
                    _a[ExploreId.left] = __assign(__assign({}, defaultInitialState.explore[ExploreId.left]), { datasourceInstance: {
                            query: jest.fn(),
                            getRef: jest.fn(),
                            meta: {
                                id: 'something',
                            },
                            getLogsVolumeDataProvider: function () {
                                return mockLogsVolumeDataProvider();
                            },
                        } }),
                    _a) }));
            dispatch = store.dispatch;
            getState = store.getState;
            setupQueryResponse(getState());
            unsubscribes = [];
            mockLogsVolumeDataProvider = function () {
                return {
                    subscribe: function () {
                        var unsubscribe = jest.fn();
                        unsubscribes.push(unsubscribe);
                        return {
                            unsubscribe: unsubscribe,
                        };
                    },
                };
            };
        });
        it('should cancel any unfinished logs volume queries', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, dispatch(runQueries(ExploreId.left))];
                    case 1:
                        _a.sent();
                        // no subscriptions created yet
                        expect(unsubscribes).toHaveLength(0);
                        return [4 /*yield*/, dispatch(loadLogsVolumeData(ExploreId.left))];
                    case 2:
                        _a.sent();
                        // loading in progress - one subscription created, not cleaned up yet
                        expect(unsubscribes).toHaveLength(1);
                        expect(unsubscribes[0]).not.toBeCalled();
                        setupQueryResponse(getState());
                        return [4 /*yield*/, dispatch(runQueries(ExploreId.left))];
                    case 3:
                        _a.sent();
                        // new query was run - first subscription is cleaned up, no new subscriptions yet
                        expect(unsubscribes).toHaveLength(1);
                        expect(unsubscribes[0]).toBeCalled();
                        return [4 /*yield*/, dispatch(loadLogsVolumeData(ExploreId.left))];
                    case 4:
                        _a.sent();
                        // new subscription is created, only the old was was cleaned up
                        expect(unsubscribes).toHaveLength(2);
                        expect(unsubscribes[0]).toBeCalled();
                        expect(unsubscribes[1]).not.toBeCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should load logs volume after running the query', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        config.featureToggles.autoLoadFullRangeLogsVolume = true;
                        return [4 /*yield*/, dispatch(runQueries(ExploreId.left))];
                    case 1:
                        _a.sent();
                        expect(unsubscribes).toHaveLength(1);
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=query.test.js.map