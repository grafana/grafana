import { __awaiter } from "tslib";
import { snakeCase } from 'lodash';
import { EMPTY, interval, Observable, of } from 'rxjs';
import { thunkTester } from 'test/core/thunk/thunkTester';
import { assertIsDefined } from 'test/helpers/asserts';
import { LoadingState, MutableDataFrame, SupplementaryQueryType, } from '@grafana/data';
import { createAsyncThunk } from 'app/types';
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { configureStore } from '../../../store/configureStore';
import { setTimeSrv } from '../../dashboard/services/TimeSrv';
import { makeLogs } from '../__mocks__/makeLogs';
import { supplementaryQueryTypes } from '../utils/supplementaryQueries';
import { saveCorrelationsAction } from './explorePane';
import { createDefaultInitialState } from './helpers';
import { addQueryRowAction, addResultsToCache, cancelQueries, cancelQueriesAction, cleanSupplementaryQueryAction, clearCache, importQueries, queryReducer, runQueries, scanStartAction, scanStopAction, setSupplementaryQueryEnabled, addQueryRow, cleanSupplementaryQueryDataProviderAction, clearLogs, queryStreamUpdatedAction, changeQueries, } from './query';
import * as actions from './query';
import { makeExplorePaneState } from './utils';
const { testRange, defaultInitialState } = createDefaultInitialState();
const exploreId = 'left';
const cleanUpMock = jest.fn();
const datasources = [
    {
        name: 'testDs',
        type: 'postgres',
        uid: 'ds1',
        getRef: () => {
            return { type: 'postgres', uid: 'ds1' };
        },
    },
    {
        name: 'testDs2',
        type: 'mysql',
        uid: 'ds2',
        getRef: () => {
            return { type: 'mysql', uid: 'ds2' };
        },
    },
];
jest.mock('app/features/dashboard/services/TimeSrv', () => (Object.assign(Object.assign({}, jest.requireActual('app/features/dashboard/services/TimeSrv')), { getTimeSrv: () => ({
        init: jest.fn(),
        timeRange: jest.fn().mockReturnValue({}),
    }) })));
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getTemplateSrv: () => ({
        updateTimeRange: jest.fn(),
    }), getDataSourceSrv: () => {
        return {
            get: (ref) => {
                if (!ref) {
                    return datasources[0];
                }
                return (datasources.find((ds) => (typeof ref === 'string' ? ds.uid === ref : ds.uid === ref.uid)) || datasources[0]);
            },
        };
    } })));
function setupQueryResponse(state) {
    const leftDatasourceInstance = assertIsDefined(state.explore.panes.left.datasourceInstance);
    jest.mocked(leftDatasourceInstance.query).mockReturnValueOnce(of({
        error: { message: 'test error' },
        data: [
            new MutableDataFrame({
                fields: [{ name: 'test', values: [] }],
                meta: {
                    preferredVisualisationType: 'graph',
                },
            }),
        ],
    }));
}
function setupStore(queries, datasourceInstance) {
    return __awaiter(this, void 0, void 0, function* () {
        let dispatch, getState;
        const store = configureStore(Object.assign(Object.assign({}, defaultInitialState), { explore: {
                panes: {
                    [exploreId]: Object.assign(Object.assign({}, defaultInitialState.explore.panes[exploreId]), { queries: queries, datasourceInstance: datasourceInstance }),
                },
            } }));
        dispatch = store.dispatch;
        getState = store.getState;
        setupQueryResponse(getState());
        yield dispatch(addQueryRow(exploreId, 1));
        return getState;
    });
}
describe('runQueries', () => {
    const setupTests = () => {
        setTimeSrv({ init() { } });
        return configureStore(Object.assign({}, defaultInitialState));
    };
    it('should pass dataFrames to state even if there is error in response', () => __awaiter(void 0, void 0, void 0, function* () {
        const { dispatch, getState } = setupTests();
        setupQueryResponse(getState());
        yield dispatch(saveCorrelationsAction({ exploreId: 'left', correlations: [] }));
        yield dispatch(runQueries({ exploreId: 'left' }));
        expect(getState().explore.panes.left.showMetrics).toBeTruthy();
        expect(getState().explore.panes.left.graphResult).toBeDefined();
    }));
    it('should modify the request-id for all supplementary queries', () => {
        var _a;
        const { dispatch, getState } = setupTests();
        setupQueryResponse(getState());
        dispatch(saveCorrelationsAction({ exploreId: 'left', correlations: [] }));
        dispatch(runQueries({ exploreId: 'left' }));
        const state = getState().explore.panes.left;
        expect((_a = state.queryResponse.request) === null || _a === void 0 ? void 0 : _a.requestId).toBe('explore_left');
        const datasource = state.datasourceInstance;
        for (const type of supplementaryQueryTypes) {
            expect(datasource.getDataProvider).toHaveBeenCalledWith(type, expect.objectContaining({
                requestId: `explore_left_${snakeCase(type)}_0`,
            }));
        }
    });
    it('should set state to done if query completes without emitting', () => __awaiter(void 0, void 0, void 0, function* () {
        const { dispatch, getState } = setupTests();
        const leftDatasourceInstance = assertIsDefined(getState().explore.panes.left.datasourceInstance);
        jest.mocked(leftDatasourceInstance.query).mockReturnValueOnce(EMPTY);
        yield dispatch(saveCorrelationsAction({ exploreId: 'left', correlations: [] }));
        yield dispatch(runQueries({ exploreId: 'left' }));
        yield new Promise((resolve) => setTimeout(() => resolve(''), 500));
        expect(getState().explore.panes.left.queryResponse.state).toBe(LoadingState.Done);
    }));
    it('shows results only after correlations are loaded', () => __awaiter(void 0, void 0, void 0, function* () {
        const { dispatch, getState } = setupTests();
        setupQueryResponse(getState());
        yield dispatch(runQueries({ exploreId: 'left' }));
        expect(getState().explore.panes.left.graphResult).not.toBeDefined();
        yield dispatch(saveCorrelationsAction({ exploreId: 'left', correlations: [] }));
        expect(getState().explore.panes.left.graphResult).toBeDefined();
    }));
});
describe('running queries', () => {
    it('should cancel running query when cancelQueries is dispatched', () => __awaiter(void 0, void 0, void 0, function* () {
        const unsubscribable = interval(1000);
        unsubscribable.subscribe();
        const exploreId = 'left';
        const initialState = {
            explore: {
                panes: {
                    [exploreId]: {
                        datasourceInstance: { name: 'testDs' },
                        initialized: true,
                        loading: true,
                        querySubscription: unsubscribable,
                        queries: ['A'],
                        range: testRange,
                        supplementaryQueries: {
                            [SupplementaryQueryType.LogsVolume]: { enabled: true },
                            [SupplementaryQueryType.LogsSample]: { enabled: true },
                        },
                    },
                },
            },
            user: {
                orgId: 'A',
            },
        };
        const dispatchedActions = yield thunkTester(initialState)
            .givenThunk(cancelQueries)
            .whenThunkIsDispatched(exploreId);
        expect(dispatchedActions).toEqual([
            scanStopAction({ exploreId }),
            cancelQueriesAction({ exploreId }),
            cleanSupplementaryQueryDataProviderAction({ exploreId, type: SupplementaryQueryType.LogsVolume }),
            cleanSupplementaryQueryAction({ exploreId, type: SupplementaryQueryType.LogsVolume }),
            cleanSupplementaryQueryDataProviderAction({ exploreId, type: SupplementaryQueryType.LogsSample }),
            cleanSupplementaryQueryAction({ exploreId, type: SupplementaryQueryType.LogsSample }),
        ]);
    }));
});
describe('changeQueries', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });
    // Due to how spyOn works (it removes `type`, `match` and `toString` from the spied function, on which we rely on in the reducer),
    // we are repeating the following tests twice, once to chck the resulting state and once to check that the correct actions are dispatched.
    describe('calls the correct actions', () => {
        it('should import queries when datasource is changed', () => __awaiter(void 0, void 0, void 0, function* () {
            jest.spyOn(actions, 'importQueries');
            jest.spyOn(actions, 'changeQueriesAction');
            const originalQueries = [{ refId: 'A', datasource: datasources[0].getRef() }];
            const { dispatch } = configureStore(Object.assign(Object.assign({}, defaultInitialState), { explore: {
                    panes: {
                        left: Object.assign(Object.assign({}, defaultInitialState.explore.panes.left), { datasourceInstance: datasources[0], queries: originalQueries }),
                    },
                } }));
            yield dispatch(changeQueries({
                queries: [{ refId: 'A', datasource: datasources[1].getRef() }],
                exploreId: 'left',
            }));
            expect(actions.changeQueriesAction).not.toHaveBeenCalled();
            expect(actions.importQueries).toHaveBeenCalledWith('left', originalQueries, datasources[0], datasources[1], originalQueries[0].refId);
        }));
        it('should not import queries when datasource is not changed', () => __awaiter(void 0, void 0, void 0, function* () {
            jest.spyOn(actions, 'importQueries');
            jest.spyOn(actions, 'changeQueriesAction');
            const { dispatch } = configureStore(Object.assign(Object.assign({}, defaultInitialState), { explore: {
                    panes: {
                        left: Object.assign(Object.assign({}, defaultInitialState.explore.panes.left), { datasourceInstance: datasources[0], queries: [{ refId: 'A', datasource: datasources[0].getRef() }] }),
                    },
                } }));
            yield dispatch(changeQueries({
                queries: [{ refId: 'A', datasource: datasources[0].getRef(), queryType: 'someValue' }],
                exploreId: 'left',
            }));
            expect(actions.changeQueriesAction).toHaveBeenCalled();
            expect(actions.importQueries).not.toHaveBeenCalled();
        }));
    });
    describe('correctly modifies the state', () => {
        it('should import queries when datasource is changed', () => __awaiter(void 0, void 0, void 0, function* () {
            const originalQueries = [{ refId: 'A', datasource: datasources[0].getRef() }];
            const { dispatch, getState } = configureStore(Object.assign(Object.assign({}, defaultInitialState), { explore: {
                    panes: {
                        left: Object.assign(Object.assign({}, defaultInitialState.explore.panes.left), { datasourceInstance: datasources[0], queries: originalQueries }),
                    },
                } }));
            yield dispatch(changeQueries({
                queries: [{ refId: 'A', datasource: datasources[1].getRef() }],
                exploreId: 'left',
            }));
            expect(getState().explore.panes.left.queries[0]).toHaveProperty('refId', 'A');
            expect(getState().explore.panes.left.queries[0]).toHaveProperty('datasource', datasources[1].getRef());
        }));
        it('should not import queries when datasource is not changed', () => __awaiter(void 0, void 0, void 0, function* () {
            const { dispatch, getState } = configureStore(Object.assign(Object.assign({}, defaultInitialState), { explore: {
                    panes: {
                        left: Object.assign(Object.assign({}, defaultInitialState.explore.panes.left), { datasourceInstance: datasources[0], queries: [{ refId: 'A', datasource: datasources[0].getRef() }] }),
                    },
                } }));
            yield dispatch(changeQueries({
                queries: [{ refId: 'A', datasource: datasources[0].getRef(), queryType: 'someValue' }],
                exploreId: 'left',
            }));
            expect(getState().explore.panes.left.queries[0]).toHaveProperty('refId', 'A');
            expect(getState().explore.panes.left.queries[0]).toHaveProperty('datasource', datasources[0].getRef());
            expect(getState().explore.panes.left.queries[0]).toEqual({
                refId: 'A',
                datasource: datasources[0].getRef(),
                queryType: 'someValue',
            });
        }));
    });
    it('runs remaining queries when one query is removed', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(actions, 'runQueries').mockImplementation(createAsyncThunk('@explore/runQueries', () => { }));
        const originalQueries = [
            { refId: 'A', datasource: datasources[0].getRef() },
            { refId: 'B', datasource: datasources[0].getRef() },
        ];
        const { dispatch } = configureStore(Object.assign(Object.assign({}, defaultInitialState), { explore: {
                panes: {
                    left: Object.assign(Object.assign({}, defaultInitialState.explore.panes.left), { datasourceInstance: datasources[0], queries: originalQueries }),
                },
            } }));
        yield dispatch(changeQueries({
            queries: [originalQueries[0]],
            exploreId: 'left',
        }));
        expect(actions.runQueries).toHaveBeenCalled();
    }));
});
describe('importing queries', () => {
    describe('when importing queries between the same type of data source', () => {
        it('remove datasource property from all of the queries', () => __awaiter(void 0, void 0, void 0, function* () {
            const { dispatch, getState } = configureStore(Object.assign(Object.assign({}, defaultInitialState), { explore: {
                    panes: {
                        left: Object.assign(Object.assign({}, defaultInitialState.explore.panes.left), { datasourceInstance: datasources[0] }),
                    },
                } }));
            yield dispatch(importQueries('left', [
                { datasource: { type: 'postgresql', uid: 'ds1' }, refId: 'refId_A' },
                { datasource: { type: 'postgresql', uid: 'ds1' }, refId: 'refId_B' },
            ], datasources[0], datasources[1]));
            expect(getState().explore.panes.left.queries[0]).toHaveProperty('refId', 'refId_A');
            expect(getState().explore.panes.left.queries[1]).toHaveProperty('refId', 'refId_B');
            expect(getState().explore.panes.left.queries[0]).toHaveProperty('datasource.uid', 'ds2');
            expect(getState().explore.panes.left.queries[1]).toHaveProperty('datasource.uid', 'ds2');
        }));
    });
});
describe('adding new query rows', () => {
    it('should add another query row if there are two rows already', () => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        const queries = [
            {
                datasource: { type: 'loki', uid: 'ds3' },
                refId: 'C',
            },
            {
                datasource: { type: 'loki', uid: 'ds4' },
                refId: 'D',
            },
        ];
        const datasourceInstance = {
            query: jest.fn(),
            getRef: jest.fn(),
            meta: {
                id: 'loki',
                mixed: false,
            },
        };
        const getState = yield setupStore(queries, datasourceInstance);
        expect((_b = (_a = getState().explore.panes[exploreId].datasourceInstance) === null || _a === void 0 ? void 0 : _a.meta) === null || _b === void 0 ? void 0 : _b.id).toBe('loki');
        expect((_d = (_c = getState().explore.panes[exploreId].datasourceInstance) === null || _c === void 0 ? void 0 : _c.meta) === null || _d === void 0 ? void 0 : _d.mixed).toBe(false);
        expect(getState().explore.panes[exploreId].queries).toHaveLength(3);
        expect(getState().explore.panes[exploreId].queryKeys).toEqual(['ds3-0', 'ds4-1', 'ds4-2']);
    }));
    it('should add query row whith root ds (without overriding the default ds) when there is not yet a row', () => __awaiter(void 0, void 0, void 0, function* () {
        var _e, _f, _g, _h, _j, _k;
        const queries = [];
        const datasourceInstance = {
            query: jest.fn(),
            getRef: jest.fn(),
            meta: {
                id: 'mixed',
                mixed: true,
            },
        };
        const getState = yield setupStore(queries, datasourceInstance);
        expect((_f = (_e = getState().explore.panes[exploreId].datasourceInstance) === null || _e === void 0 ? void 0 : _e.meta) === null || _f === void 0 ? void 0 : _f.id).toBe('mixed');
        expect((_h = (_g = getState().explore.panes[exploreId].datasourceInstance) === null || _g === void 0 ? void 0 : _g.meta) === null || _h === void 0 ? void 0 : _h.mixed).toBe(true);
        expect(getState().explore.panes[exploreId].queries).toHaveLength(1);
        expect((_k = (_j = getState().explore.panes[exploreId].queries[0]) === null || _j === void 0 ? void 0 : _j.datasource) === null || _k === void 0 ? void 0 : _k.type).toBe('postgres');
        expect(getState().explore.panes[exploreId].queryKeys).toEqual(['ds1-0']);
    }));
    it('should add query row whith root ds (with overriding the default ds) when there is not yet a row', () => __awaiter(void 0, void 0, void 0, function* () {
        var _l, _m, _o, _p, _q, _r;
        const queries = [];
        const datasourceInstance = {
            query: jest.fn(),
            getRef: () => {
                return { type: 'loki', uid: 'uid-loki' };
            },
            meta: {
                id: 'loki',
                mixed: false,
            },
        };
        const getState = yield setupStore(queries, datasourceInstance);
        expect((_m = (_l = getState().explore.panes[exploreId].datasourceInstance) === null || _l === void 0 ? void 0 : _l.meta) === null || _m === void 0 ? void 0 : _m.id).toBe('loki');
        expect((_p = (_o = getState().explore.panes[exploreId].datasourceInstance) === null || _o === void 0 ? void 0 : _o.meta) === null || _p === void 0 ? void 0 : _p.mixed).toBe(false);
        expect(getState().explore.panes[exploreId].queries).toHaveLength(1);
        expect((_r = (_q = getState().explore.panes[exploreId].queries[0]) === null || _q === void 0 ? void 0 : _q.datasource) === null || _r === void 0 ? void 0 : _r.type).toBe('loki');
        expect(getState().explore.panes[exploreId].queryKeys).toEqual(['uid-loki-0']);
    }));
    it('should add another query row if there are two rows already', () => __awaiter(void 0, void 0, void 0, function* () {
        var _s, _t, _u, _v, _w, _x;
        const queries = [
            {
                datasource: { type: 'postgres', uid: 'ds3' },
                refId: 'C',
            },
            {
                datasource: { type: 'loki', uid: 'ds4' },
                refId: 'D',
            },
        ];
        const datasourceInstance = {
            query: jest.fn(),
            getRef: jest.fn(),
            meta: {
                id: 'mixed',
                mixed: true,
            },
        };
        const getState = yield setupStore(queries, datasourceInstance);
        expect((_t = (_s = getState().explore.panes[exploreId].datasourceInstance) === null || _s === void 0 ? void 0 : _s.meta) === null || _t === void 0 ? void 0 : _t.id).toBe('mixed');
        expect((_v = (_u = getState().explore.panes[exploreId].datasourceInstance) === null || _u === void 0 ? void 0 : _u.meta) === null || _v === void 0 ? void 0 : _v.mixed).toBe(true);
        expect(getState().explore.panes[exploreId].queries).toHaveLength(3);
        expect((_x = (_w = getState().explore.panes[exploreId].queries[2]) === null || _w === void 0 ? void 0 : _w.datasource) === null || _x === void 0 ? void 0 : _x.type).toBe('loki');
        expect(getState().explore.panes[exploreId].queryKeys).toEqual(['ds3-0', 'ds4-1', 'ds4-2']);
    }));
});
describe('reducer', () => {
    describe('scanning', () => {
        it('should start scanning', () => {
            const initialState = Object.assign(Object.assign({}, makeExplorePaneState()), { scanning: false });
            reducerTester()
                .givenReducer(queryReducer, initialState)
                .whenActionIsDispatched(scanStartAction({ exploreId: 'left' }))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { scanning: true }));
        });
        it('should stop scanning', () => {
            const initialState = Object.assign(Object.assign({}, makeExplorePaneState()), { scanning: true, scanRange: {} });
            reducerTester()
                .givenReducer(queryReducer, initialState)
                .whenActionIsDispatched(scanStopAction({ exploreId: 'left' }))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { scanning: false, scanRange: undefined }));
        });
    });
    describe('query rows', () => {
        it('should add query row when there is no query row yet', () => {
            reducerTester()
                .givenReducer(queryReducer, {
                queries: [],
            })
                .whenActionIsDispatched(addQueryRowAction({
                exploreId: 'left',
                query: { refId: 'A', key: 'mockKey' },
                index: 0,
            }))
                .thenStateShouldEqual({
                queries: [{ refId: 'A', key: 'mockKey' }],
                queryKeys: ['mockKey-0'],
            });
        });
        it('should add query row when there is already one query row', () => {
            reducerTester()
                .givenReducer(queryReducer, {
                queries: [{ refId: 'A', key: 'initialRow', datasource: { type: 'loki' } }],
            })
                .whenActionIsDispatched(addQueryRowAction({
                exploreId: 'left',
                query: { refId: 'B', key: 'mockKey', datasource: { type: 'loki' } },
                index: 0,
            }))
                .thenStateShouldEqual({
                queries: [
                    { refId: 'A', key: 'initialRow', datasource: { type: 'loki' } },
                    { refId: 'B', key: 'mockKey', datasource: { type: 'loki' } },
                ],
                queryKeys: ['initialRow-0', 'mockKey-1'],
            });
        });
        describe('addQueryRow', () => {
            it('adds a query from root datasource if root is not mixed and there are no queries', () => __awaiter(void 0, void 0, void 0, function* () {
                var _a;
                const { dispatch, getState } = configureStore(Object.assign(Object.assign({}, defaultInitialState), { explore: Object.assign(Object.assign({}, defaultInitialState.explore), { panes: {
                            left: Object.assign(Object.assign({}, defaultInitialState.explore.panes.left), { queries: [], datasourceInstance: {
                                    meta: {
                                        mixed: false,
                                    },
                                    getRef() {
                                        return { type: 'loki', uid: 'uid-loki' };
                                    },
                                } }),
                        } }) }));
                yield dispatch(addQueryRow('left', 0));
                expect((_a = getState().explore.panes.left) === null || _a === void 0 ? void 0 : _a.queries).toEqual([
                    expect.objectContaining({ datasource: { type: 'loki', uid: 'uid-loki' } }),
                ]);
            }));
            it('adds a query from root datasource if root is not mixed and there are queries without a datasource specified', () => __awaiter(void 0, void 0, void 0, function* () {
                var _b;
                const { dispatch, getState } = configureStore(Object.assign(Object.assign({}, defaultInitialState), { explore: {
                        panes: {
                            left: Object.assign(Object.assign({}, defaultInitialState.explore.panes.left), { queries: [{ expr: 1 }], datasourceInstance: {
                                    meta: {
                                        mixed: false,
                                    },
                                    getRef() {
                                        return { type: 'loki', uid: 'uid-loki' };
                                    },
                                } }),
                        },
                    } }));
                yield dispatch(addQueryRow('left', 0));
                expect((_b = getState().explore.panes.left) === null || _b === void 0 ? void 0 : _b.queries).toEqual([
                    expect.anything(),
                    expect.objectContaining({ datasource: { type: 'loki', uid: 'uid-loki' } }),
                ]);
            }));
            it('adds a query from default datasource if root is mixed and there are no queries', () => __awaiter(void 0, void 0, void 0, function* () {
                var _c;
                const { dispatch, getState } = configureStore(Object.assign(Object.assign({}, defaultInitialState), { explore: {
                        panes: {
                            left: Object.assign(Object.assign({}, defaultInitialState.explore.panes.left), { queries: [], datasourceInstance: {
                                    meta: {
                                        mixed: true,
                                    },
                                    getRef() {
                                        return { type: 'mixed', uid: '-- Mixed --' };
                                    },
                                } }),
                        },
                    } }));
                yield dispatch(addQueryRow('left', 0));
                expect((_c = getState().explore.panes.left) === null || _c === void 0 ? void 0 : _c.queries).toEqual([
                    expect.objectContaining({ datasource: { type: 'postgres', uid: 'ds1' } }),
                ]);
            }));
        });
    });
    describe('caching', () => {
        it('should add response to cache', () => __awaiter(void 0, void 0, void 0, function* () {
            const { dispatch, getState } = configureStore(Object.assign(Object.assign({}, defaultInitialState), { explore: {
                    panes: {
                        left: Object.assign(Object.assign({}, defaultInitialState.explore.panes.left), { queryResponse: {
                                series: [{ name: 'test name' }],
                                state: LoadingState.Done,
                            }, absoluteRange: { from: 1621348027000, to: 1621348050000 } }),
                    },
                } }));
            yield dispatch(addResultsToCache('left'));
            expect(getState().explore.panes.left.cache).toEqual([
                { key: 'from=1621348027000&to=1621348050000', value: { series: [{ name: 'test name' }], state: 'Done' } },
            ]);
        }));
        it('should not add response to cache if response is still loading', () => __awaiter(void 0, void 0, void 0, function* () {
            const { dispatch, getState } = configureStore(Object.assign(Object.assign({}, defaultInitialState), { explore: {
                    panes: {
                        left: Object.assign(Object.assign({}, defaultInitialState.explore.panes.left), { queryResponse: { series: [{ name: 'test name' }], state: LoadingState.Loading }, absoluteRange: { from: 1621348027000, to: 1621348050000 } }),
                    },
                } }));
            yield dispatch(addResultsToCache('left'));
            expect(getState().explore.panes.left.cache).toEqual([]);
        }));
        it('should not add duplicate response to cache', () => __awaiter(void 0, void 0, void 0, function* () {
            const { dispatch, getState } = configureStore(Object.assign(Object.assign({}, defaultInitialState), { explore: {
                    panes: {
                        left: Object.assign(Object.assign({}, defaultInitialState.explore.panes.left), { queryResponse: {
                                series: [{ name: 'test name' }],
                                state: LoadingState.Done,
                            }, absoluteRange: { from: 1621348027000, to: 1621348050000 }, cache: [
                                {
                                    key: 'from=1621348027000&to=1621348050000',
                                    value: { series: [{ name: 'old test name' }], state: LoadingState.Done },
                                },
                            ] }),
                    },
                } }));
            yield dispatch(addResultsToCache('left'));
            expect(getState().explore.panes.left.cache).toHaveLength(1);
            expect(getState().explore.panes.left.cache).toEqual([
                { key: 'from=1621348027000&to=1621348050000', value: { series: [{ name: 'old test name' }], state: 'Done' } },
            ]);
        }));
        it('should clear cache', () => __awaiter(void 0, void 0, void 0, function* () {
            const { dispatch, getState } = configureStore(Object.assign(Object.assign({}, defaultInitialState), { explore: {
                    panes: {
                        left: Object.assign(Object.assign({}, defaultInitialState.explore.panes.left), { cache: [
                                {
                                    key: 'from=1621348027000&to=1621348050000',
                                    value: { series: [{ name: 'old test name' }], state: 'Done' },
                                },
                            ] }),
                    },
                } }));
            yield dispatch(clearCache('left'));
            expect(getState().explore.panes.left.cache).toEqual([]);
        }));
    });
    describe('when data source does not support log volume supplementary query', () => {
        it('cleans up query subscription correctly (regression #70049)', () => __awaiter(void 0, void 0, void 0, function* () {
            const store = configureStore(Object.assign(Object.assign({}, defaultInitialState), { explore: {
                    panes: {
                        left: Object.assign(Object.assign({}, defaultInitialState.explore.panes.left), { datasourceInstance: {
                                getRef: jest.fn(),
                                meta: {
                                    id: 'something',
                                },
                                query(request) {
                                    return new Observable(() => cleanUpMock);
                                },
                            } }),
                    },
                } }));
            const dispatch = store.dispatch;
            cleanUpMock.mockClear();
            yield dispatch(runQueries({ exploreId: 'left' }));
            yield dispatch(cancelQueries('left'));
            expect(cleanUpMock).toBeCalledTimes(1);
        }));
    });
    describe('supplementary queries', () => {
        let dispatch, getState, unsubscribes, mockDataProvider;
        beforeEach(() => {
            unsubscribes = [];
            mockDataProvider = () => {
                return {
                    subscribe: () => {
                        const unsubscribe = jest.fn();
                        unsubscribes.push(unsubscribe);
                        return {
                            unsubscribe,
                        };
                    },
                };
            };
            const store = configureStore(Object.assign(Object.assign({}, defaultInitialState), { explore: {
                    panes: {
                        left: Object.assign(Object.assign({}, defaultInitialState.explore.panes.left), { datasourceInstance: {
                                query: jest.fn(),
                                getRef: jest.fn(),
                                meta: {
                                    id: 'something',
                                },
                                getDataProvider: () => {
                                    return mockDataProvider();
                                },
                                getSupportedSupplementaryQueryTypes: () => [
                                    SupplementaryQueryType.LogsVolume,
                                    SupplementaryQueryType.LogsSample,
                                ],
                                getSupplementaryQuery: jest.fn(),
                            } }),
                    },
                } }));
            dispatch = store.dispatch;
            getState = store.getState;
            setupQueryResponse(getState());
        });
        it('should cancel any unfinished supplementary queries when a new query is run', () => __awaiter(void 0, void 0, void 0, function* () {
            dispatch(runQueries({ exploreId: 'left' }));
            // first query is run automatically
            // loading in progress - subscriptions for both supplementary queries are created, not cleaned up yet
            expect(unsubscribes).toHaveLength(2);
            expect(unsubscribes[0]).not.toBeCalled();
            expect(unsubscribes[1]).not.toBeCalled();
            setupQueryResponse(getState());
            dispatch(runQueries({ exploreId: 'left' }));
            // a new query is run while supplementary queries are not resolve yet...
            expect(unsubscribes[0]).toBeCalled();
            expect(unsubscribes[1]).toBeCalled();
            // first subscriptions are cleaned up, a new subscriptions are created automatically
            expect(unsubscribes).toHaveLength(4);
            expect(unsubscribes[2]).not.toBeCalled();
            expect(unsubscribes[3]).not.toBeCalled();
        }));
        it('should cancel all supported supplementary queries when the main query is canceled', () => {
            dispatch(runQueries({ exploreId: 'left' }));
            expect(unsubscribes).toHaveLength(2);
            expect(unsubscribes[0]).not.toBeCalled();
            expect(unsubscribes[1]).not.toBeCalled();
            dispatch(cancelQueries('left'));
            expect(unsubscribes).toHaveLength(2);
            expect(unsubscribes[0]).toBeCalled();
            expect(unsubscribes[1]).toBeCalled();
            for (const type of supplementaryQueryTypes) {
                expect(getState().explore.panes.left.supplementaryQueries[type].data).toBeUndefined();
                expect(getState().explore.panes.left.supplementaryQueries[type].dataProvider).toBeUndefined();
            }
        });
        it('should load supplementary queries after running the query', () => {
            dispatch(runQueries({ exploreId: 'left' }));
            expect(unsubscribes).toHaveLength(2);
        });
        it('should clean any incomplete supplementary queries data when main query is canceled', () => {
            mockDataProvider = () => {
                return of({ state: LoadingState.Loading, error: undefined, data: [] });
            };
            dispatch(runQueries({ exploreId: 'left' }));
            for (const type of supplementaryQueryTypes) {
                expect(getState().explore.panes.left.supplementaryQueries[type].data).toBeDefined();
                expect(getState().explore.panes.left.supplementaryQueries[type].data.state).toBe(LoadingState.Loading);
                expect(getState().explore.panes.left.supplementaryQueries[type].dataProvider).toBeDefined();
            }
            for (const type of supplementaryQueryTypes) {
                expect(getState().explore.panes.left.supplementaryQueries[type].data).toBeDefined();
                expect(getState().explore.panes.left.supplementaryQueries[type].data.state).toBe(LoadingState.Loading);
                expect(getState().explore.panes.left.supplementaryQueries[type].dataProvider).toBeDefined();
            }
            dispatch(cancelQueries('left'));
            for (const type of supplementaryQueryTypes) {
                expect(getState().explore.panes.left.supplementaryQueries[type].data).toBeUndefined();
                expect(getState().explore.panes.left.supplementaryQueries[type].data).toBeUndefined();
            }
        });
        it('keeps complete supplementary data when main query is canceled', () => __awaiter(void 0, void 0, void 0, function* () {
            mockDataProvider = () => {
                return of({ state: LoadingState.Loading, error: undefined, data: [] }, { state: LoadingState.Done, error: undefined, data: [{}] });
            };
            dispatch(runQueries({ exploreId: 'left' }));
            for (const types of supplementaryQueryTypes) {
                expect(getState().explore.panes.left.supplementaryQueries[types].data).toBeDefined();
                expect(getState().explore.panes.left.supplementaryQueries[types].data.state).toBe(LoadingState.Done);
                expect(getState().explore.panes.left.supplementaryQueries[types].dataProvider).toBeDefined();
            }
            dispatch(cancelQueries('left'));
            for (const types of supplementaryQueryTypes) {
                expect(getState().explore.panes.left.supplementaryQueries[types].data).toBeDefined();
                expect(getState().explore.panes.left.supplementaryQueries[types].data.state).toBe(LoadingState.Done);
                expect(getState().explore.panes.left.supplementaryQueries[types].dataProvider).toBeUndefined();
            }
        }));
        it('do not load disabled supplementary query data', () => {
            mockDataProvider = () => {
                return of({ state: LoadingState.Done, error: undefined, data: [{}] });
            };
            // turn logs volume off (but keep logs sample on)
            dispatch(setSupplementaryQueryEnabled('left', false, SupplementaryQueryType.LogsVolume));
            expect(getState().explore.panes.left.supplementaryQueries[SupplementaryQueryType.LogsVolume].enabled).toBe(false);
            expect(getState().explore.panes.left.supplementaryQueries[SupplementaryQueryType.LogsSample].enabled).toBe(true);
            // verify that if we run a query, it will: 1) not do logs volume, 2) do logs sample 3) provider will still be set for both
            dispatch(runQueries({ exploreId: 'left' }));
            expect(getState().explore.panes.left.supplementaryQueries[SupplementaryQueryType.LogsVolume].data).toBeUndefined();
            expect(getState().explore.panes.left.supplementaryQueries[SupplementaryQueryType.LogsVolume].dataSubscription).toBeUndefined();
            expect(getState().explore.panes.left.supplementaryQueries[SupplementaryQueryType.LogsVolume].dataProvider).toBeDefined();
            expect(getState().explore.panes.left.supplementaryQueries[SupplementaryQueryType.LogsSample].data).toBeDefined();
            expect(getState().explore.panes.left.supplementaryQueries[SupplementaryQueryType.LogsSample].dataSubscription).toBeDefined();
            expect(getState().explore.panes.left.supplementaryQueries[SupplementaryQueryType.LogsSample].dataProvider).toBeDefined();
        });
        it('load data of supplementary query that gets enabled', () => __awaiter(void 0, void 0, void 0, function* () {
            // first we start with both supplementary queries disabled
            dispatch(setSupplementaryQueryEnabled('left', false, SupplementaryQueryType.LogsVolume));
            dispatch(setSupplementaryQueryEnabled('left', false, SupplementaryQueryType.LogsSample));
            // runQueries sets up providers, but does not run queries
            dispatch(runQueries({ exploreId: 'left' }));
            expect(getState().explore.panes.left.supplementaryQueries[SupplementaryQueryType.LogsVolume].dataProvider).toBeDefined();
            expect(getState().explore.panes.left.supplementaryQueries[SupplementaryQueryType.LogsSample].dataProvider).toBeDefined();
            // we turn 1 supplementary query (logs volume) on
            dispatch(setSupplementaryQueryEnabled('left', true, SupplementaryQueryType.LogsVolume));
            // verify it was turned on
            expect(getState().explore.panes.left.supplementaryQueries[SupplementaryQueryType.LogsVolume].enabled).toBe(true);
            // verify that other stay off
            expect(getState().explore.panes.left.supplementaryQueries[SupplementaryQueryType.LogsSample].enabled).toBe(false);
            expect(getState().explore.panes.left.supplementaryQueries[SupplementaryQueryType.LogsVolume].dataSubscription).toBeDefined();
            expect(getState().explore.panes.left.supplementaryQueries[SupplementaryQueryType.LogsSample].dataSubscription).toBeUndefined();
        }));
    });
    describe('clear live logs', () => {
        it('should clear current log rows', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            const logRows = makeLogs(10);
            const { dispatch, getState } = configureStore(Object.assign(Object.assign({}, defaultInitialState), { explore: {
                    panes: {
                        ['left']: Object.assign(Object.assign({}, defaultInitialState.explore.panes['left']), { queryResponse: {
                                state: LoadingState.Streaming,
                            }, logsResult: {
                                hasUniqueLabels: false,
                                rows: logRows,
                            } }),
                    },
                } }));
            expect((_b = (_a = getState().explore.panes['left']) === null || _a === void 0 ? void 0 : _a.logsResult) === null || _b === void 0 ? void 0 : _b.rows.length).toBe(logRows.length);
            yield dispatch(clearLogs({ exploreId: 'left' }));
            expect((_d = (_c = getState().explore.panes['left']) === null || _c === void 0 ? void 0 : _c.logsResult) === null || _d === void 0 ? void 0 : _d.rows.length).toBe(0);
            expect((_e = getState().explore.panes['left']) === null || _e === void 0 ? void 0 : _e.clearedAtIndex).toBe(logRows.length - 1);
        }));
        it('should filter new log rows', () => __awaiter(void 0, void 0, void 0, function* () {
            var _f, _g, _h, _j, _k;
            const oldLogRows = makeLogs(10);
            const newLogRows = makeLogs(5);
            const allLogRows = [...oldLogRows, ...newLogRows];
            const { dispatch, getState } = configureStore(Object.assign(Object.assign({}, defaultInitialState), { explore: {
                    panes: {
                        ['left']: Object.assign(Object.assign({}, defaultInitialState.explore.panes['left']), { isLive: true, queryResponse: {
                                state: LoadingState.Streaming,
                            }, logsResult: {
                                hasUniqueLabels: false,
                                rows: oldLogRows,
                            } }),
                    },
                } }));
            expect((_g = (_f = getState().explore.panes['left']) === null || _f === void 0 ? void 0 : _f.logsResult) === null || _g === void 0 ? void 0 : _g.rows.length).toBe(oldLogRows.length);
            yield dispatch(clearLogs({ exploreId: 'left' }));
            yield dispatch(queryStreamUpdatedAction({
                exploreId: 'left',
                response: {
                    request: true,
                    traceFrames: [],
                    nodeGraphFrames: [],
                    rawPrometheusFrames: [],
                    flameGraphFrames: [],
                    logsResult: {
                        hasUniqueLabels: false,
                        rows: allLogRows,
                    },
                },
            }));
            expect((_j = (_h = getState().explore.panes['left']) === null || _h === void 0 ? void 0 : _h.logsResult) === null || _j === void 0 ? void 0 : _j.rows.length).toBe(newLogRows.length);
            expect((_k = getState().explore.panes['left']) === null || _k === void 0 ? void 0 : _k.clearedAtIndex).toBe(oldLogRows.length - 1);
        }));
    });
});
//# sourceMappingURL=query.test.js.map