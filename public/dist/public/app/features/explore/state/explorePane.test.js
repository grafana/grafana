var _a;
import { __assign, __awaiter, __generator } from "tslib";
import { DefaultTimeZone, serializeStateToUrlParam, toUtc } from '@grafana/data';
import { ExploreId } from 'app/types';
import { refreshExplore } from './explorePane';
import { setDataSourceSrv } from '@grafana/runtime';
import { configureStore } from '../../../store/configureStore';
import { of } from 'rxjs';
jest.mock('../../dashboard/services/TimeSrv', function () { return ({
    getTimeSrv: jest.fn().mockReturnValue({
        init: jest.fn(),
    }),
}); });
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
            initialized: true,
            containerWidth: 1920,
            eventBridge: {},
            queries: [],
            range: testRange,
            refreshInterval: {
                label: 'Off',
                value: 0,
            },
            cache: [],
        },
        _a),
};
function setupStore(state) {
    var _a;
    return configureStore(__assign(__assign({}, defaultInitialState), { explore: (_a = {},
            _a[ExploreId.left] = __assign(__assign({}, defaultInitialState.explore[ExploreId.left]), (state || {})),
            _a) }));
}
function setup(state) {
    var datasources = {
        newDs: {
            testDatasource: jest.fn(),
            init: jest.fn(),
            query: jest.fn(),
            name: 'newDs',
            meta: { id: 'newDs' },
            getRef: function () { return ({ uid: 'newDs' }); },
        },
        someDs: {
            testDatasource: jest.fn(),
            init: jest.fn(),
            query: jest.fn(),
            name: 'someDs',
            meta: { id: 'someDs' },
            getRef: function () { return ({ uid: 'someDs' }); },
        },
    };
    setDataSourceSrv({
        getList: function () {
            return Object.values(datasources).map(function (d) { return ({ name: d.name }); });
        },
        getInstanceSettings: function (name) {
            return { name: name, getRef: function () { return ({ uid: name }); } };
        },
        get: function (name) {
            return Promise.resolve(name
                ? datasources[name]
                : {
                    testDatasource: jest.fn(),
                    init: jest.fn(),
                    name: 'default',
                });
        },
    });
    var _a = setupStore(__assign({ datasourceInstance: datasources.someDs }, (state || {}))), dispatch = _a.dispatch, getState = _a.getState;
    return {
        dispatch: dispatch,
        getState: getState,
        datasources: datasources,
    };
}
describe('refreshExplore', function () {
    it('should change data source when datasource in url changes', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, dispatch, getState;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = setup(), dispatch = _a.dispatch, getState = _a.getState;
                    return [4 /*yield*/, dispatch(refreshExplore(ExploreId.left, serializeStateToUrlParam({ datasource: 'newDs', queries: [], range: testRange })))];
                case 1:
                    _c.sent();
                    expect((_b = getState().explore[ExploreId.left].datasourceInstance) === null || _b === void 0 ? void 0 : _b.name).toBe('newDs');
                    return [2 /*return*/];
            }
        });
    }); });
    it('should change and run new queries from the URL', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, dispatch, getState, datasources, state;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = setup(), dispatch = _a.dispatch, getState = _a.getState, datasources = _a.datasources;
                    datasources.someDs.query.mockReturnValueOnce(of({}));
                    return [4 /*yield*/, dispatch(refreshExplore(ExploreId.left, serializeStateToUrlParam({ datasource: 'someDs', queries: [{ expr: 'count()', refId: 'A' }], range: testRange })))];
                case 1:
                    _c.sent();
                    state = getState().explore[ExploreId.left];
                    expect((_b = state.datasourceInstance) === null || _b === void 0 ? void 0 : _b.name).toBe('someDs');
                    expect(state.queries.length).toBe(1);
                    expect(state.queries).toMatchObject([{ expr: 'count()' }]);
                    expect(datasources.someDs.query).toHaveBeenCalledTimes(1);
                    return [2 /*return*/];
            }
        });
    }); });
    it('should not do anything if pane is not initialized', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, dispatch, getState, state;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setup({
                        initialized: false,
                    }), dispatch = _a.dispatch, getState = _a.getState;
                    state = getState();
                    return [4 /*yield*/, dispatch(refreshExplore(ExploreId.left, serializeStateToUrlParam({ datasource: 'newDs', queries: [{ expr: 'count()', refId: 'A' }], range: testRange })))];
                case 1:
                    _b.sent();
                    expect(state).toEqual(getState());
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=explorePane.test.js.map