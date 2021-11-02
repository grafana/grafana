import { __assign, __awaiter, __generator } from "tslib";
import { serializeStateToUrlParam } from '@grafana/data/src/utils/url';
import { exploreReducer, navigateToExplore, splitCloseAction } from './main';
import { thunkTester } from 'test/core/thunk/thunkTester';
import { MockDataSourceApi } from '../../../../test/mocks/datasource_srv';
import { ExploreId } from '../../../types';
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { locationService } from '@grafana/runtime';
var getNavigateToExploreContext = function (openInNewWindow) { return __awaiter(void 0, void 0, void 0, function () {
    var url, panel, datasource, get, getDataSourceSrv, getTimeSrv, getExploreUrl, dispatchedActions;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                url = '/explore';
                panel = {
                    datasource: { uid: 'mocked datasource' },
                    targets: [{ refId: 'A' }],
                };
                datasource = new MockDataSourceApi(panel.datasource.uid);
                get = jest.fn().mockResolvedValue(datasource);
                getDataSourceSrv = jest.fn().mockReturnValue({ get: get });
                getTimeSrv = jest.fn();
                getExploreUrl = jest.fn().mockResolvedValue(url);
                return [4 /*yield*/, thunkTester({})
                        .givenThunk(navigateToExplore)
                        .whenThunkIsDispatched(panel, { getDataSourceSrv: getDataSourceSrv, getTimeSrv: getTimeSrv, getExploreUrl: getExploreUrl, openInNewWindow: openInNewWindow })];
            case 1:
                dispatchedActions = _a.sent();
                return [2 /*return*/, {
                        url: url,
                        panel: panel,
                        get: get,
                        getDataSourceSrv: getDataSourceSrv,
                        getTimeSrv: getTimeSrv,
                        getExploreUrl: getExploreUrl,
                        dispatchedActions: dispatchedActions,
                    }];
        }
    });
}); };
describe('navigateToExplore', function () {
    describe('when navigateToExplore thunk is dispatched', function () {
        describe('and openInNewWindow is undefined', function () {
            var openInNewWindow = undefined;
            it('then it should dispatch correct actions', function () { return __awaiter(void 0, void 0, void 0, function () {
                var url;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getNavigateToExploreContext(openInNewWindow)];
                        case 1:
                            url = (_a.sent()).url;
                            expect(locationService.getLocation().pathname).toEqual(url);
                            return [2 /*return*/];
                    }
                });
            }); });
            it('then getDataSourceSrv should have been once', function () { return __awaiter(void 0, void 0, void 0, function () {
                var getDataSourceSrv;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getNavigateToExploreContext(openInNewWindow)];
                        case 1:
                            getDataSourceSrv = (_a.sent()).getDataSourceSrv;
                            expect(getDataSourceSrv).toHaveBeenCalledTimes(1);
                            return [2 /*return*/];
                    }
                });
            }); });
            it('then getTimeSrv should have been called once', function () { return __awaiter(void 0, void 0, void 0, function () {
                var getTimeSrv;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getNavigateToExploreContext(openInNewWindow)];
                        case 1:
                            getTimeSrv = (_a.sent()).getTimeSrv;
                            expect(getTimeSrv).toHaveBeenCalledTimes(1);
                            return [2 /*return*/];
                    }
                });
            }); });
            it('then getExploreUrl should have been called with correct arguments', function () { return __awaiter(void 0, void 0, void 0, function () {
                var _a, getExploreUrl, panel, getDataSourceSrv, getTimeSrv;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, getNavigateToExploreContext(openInNewWindow)];
                        case 1:
                            _a = _b.sent(), getExploreUrl = _a.getExploreUrl, panel = _a.panel, getDataSourceSrv = _a.getDataSourceSrv, getTimeSrv = _a.getTimeSrv;
                            expect(getExploreUrl).toHaveBeenCalledTimes(1);
                            expect(getExploreUrl).toHaveBeenCalledWith({
                                panel: panel,
                                datasourceSrv: getDataSourceSrv(),
                                timeSrv: getTimeSrv(),
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and openInNewWindow is defined', function () {
            var openInNewWindow = jest.fn();
            it('then it should dispatch no actions', function () { return __awaiter(void 0, void 0, void 0, function () {
                var dispatchedActions;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getNavigateToExploreContext(openInNewWindow)];
                        case 1:
                            dispatchedActions = (_a.sent()).dispatchedActions;
                            expect(dispatchedActions).toEqual([]);
                            return [2 /*return*/];
                    }
                });
            }); });
            it('then getDataSourceSrv should have been once', function () { return __awaiter(void 0, void 0, void 0, function () {
                var getDataSourceSrv;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getNavigateToExploreContext(openInNewWindow)];
                        case 1:
                            getDataSourceSrv = (_a.sent()).getDataSourceSrv;
                            expect(getDataSourceSrv).toHaveBeenCalledTimes(1);
                            return [2 /*return*/];
                    }
                });
            }); });
            it('then getTimeSrv should have been called once', function () { return __awaiter(void 0, void 0, void 0, function () {
                var getTimeSrv;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getNavigateToExploreContext(openInNewWindow)];
                        case 1:
                            getTimeSrv = (_a.sent()).getTimeSrv;
                            expect(getTimeSrv).toHaveBeenCalledTimes(1);
                            return [2 /*return*/];
                    }
                });
            }); });
            it('then getExploreUrl should have been called with correct arguments', function () { return __awaiter(void 0, void 0, void 0, function () {
                var _a, getExploreUrl, panel, getDataSourceSrv, getTimeSrv;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, getNavigateToExploreContext(openInNewWindow)];
                        case 1:
                            _a = _b.sent(), getExploreUrl = _a.getExploreUrl, panel = _a.panel, getDataSourceSrv = _a.getDataSourceSrv, getTimeSrv = _a.getTimeSrv;
                            expect(getExploreUrl).toHaveBeenCalledTimes(1);
                            expect(getExploreUrl).toHaveBeenCalledWith({
                                panel: panel,
                                datasourceSrv: getDataSourceSrv(),
                                timeSrv: getTimeSrv(),
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
            it('then openInNewWindow should have been called with correct arguments', function () { return __awaiter(void 0, void 0, void 0, function () {
                var openInNewWindowFunc, url;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            openInNewWindowFunc = jest.fn();
                            return [4 /*yield*/, getNavigateToExploreContext(openInNewWindowFunc)];
                        case 1:
                            url = (_a.sent()).url;
                            expect(openInNewWindowFunc).toHaveBeenCalledTimes(1);
                            expect(openInNewWindowFunc).toHaveBeenCalledWith(url);
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
});
describe('Explore reducer', function () {
    describe('split view', function () {
        describe('split close', function () {
            it('should keep right pane as left when left is closed', function () {
                var leftItemMock = {
                    containerWidth: 100,
                };
                var rightItemMock = {
                    containerWidth: 200,
                };
                var initialState = {
                    left: leftItemMock,
                    right: rightItemMock,
                };
                // closing left item
                reducerTester()
                    .givenReducer(exploreReducer, initialState)
                    .whenActionIsDispatched(splitCloseAction({ itemId: ExploreId.left }))
                    .thenStateShouldEqual({
                    left: rightItemMock,
                    right: undefined,
                });
            });
            it('should reset right pane when it is closed ', function () {
                var leftItemMock = {
                    containerWidth: 100,
                };
                var rightItemMock = {
                    containerWidth: 200,
                };
                var initialState = {
                    left: leftItemMock,
                    right: rightItemMock,
                };
                // closing left item
                reducerTester()
                    .givenReducer(exploreReducer, initialState)
                    .whenActionIsDispatched(splitCloseAction({ itemId: ExploreId.right }))
                    .thenStateShouldEqual({
                    left: leftItemMock,
                    right: undefined,
                });
            });
        });
    });
});
export var setup = function (urlStateOverrides) {
    var urlStateDefaults = {
        datasource: 'some-datasource',
        queries: [],
        range: {
            from: '',
            to: '',
        },
    };
    var urlState = __assign(__assign({}, urlStateDefaults), urlStateOverrides);
    var serializedUrlState = serializeStateToUrlParam(urlState);
    var initialState = {
        split: false,
    };
    return {
        initialState: initialState,
        serializedUrlState: serializedUrlState,
    };
};
//# sourceMappingURL=main.test.js.map