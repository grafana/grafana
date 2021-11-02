import { __assign, __awaiter, __generator } from "tslib";
import { findNewName, nameExits, testDataSource, getDataSourceUsingUidOrId, } from './actions';
import { getMockPlugin, getMockPlugins } from '../../plugins/__mocks__/pluginMocks';
import { thunkTester } from 'test/core/thunk/thunkTester';
import { initDataSourceSettingsSucceeded, initDataSourceSettingsFailed, testDataSourceStarting, testDataSourceSucceeded, testDataSourceFailed, } from './reducers';
import { initDataSourceSettings } from '../state/actions';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { of } from 'rxjs';
jest.mock('app/core/services/backend_srv');
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: jest.fn() })); });
var getBackendSrvMock = function () {
    return ({
        get: jest.fn().mockReturnValue({
            testDatasource: jest.fn().mockReturnValue({
                status: '',
                message: '',
            }),
        }),
        withNoBackendCache: jest.fn().mockImplementationOnce(function (cb) { return cb(); }),
    });
};
var failDataSourceTest = function (error) { return __awaiter(void 0, void 0, void 0, function () {
    var dependencies, state, dispatchedActions;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                dependencies = {
                    getDatasourceSrv: function () {
                        return ({
                            get: jest.fn().mockReturnValue({
                                testDatasource: jest.fn().mockImplementation(function () {
                                    throw error;
                                }),
                            }),
                        });
                    },
                    getBackendSrv: getBackendSrvMock,
                };
                state = {
                    testingStatus: {
                        message: '',
                        status: '',
                    },
                };
                return [4 /*yield*/, thunkTester(state)
                        .givenThunk(testDataSource)
                        .whenThunkIsDispatched('Azure Monitor', dependencies)];
            case 1:
                dispatchedActions = _a.sent();
                return [2 /*return*/, dispatchedActions];
        }
    });
}); };
describe('getDataSourceUsingUidOrId', function () {
    var uidResponse = {
        ok: true,
        data: {
            id: 111,
            uid: 'abcdefg',
        },
    };
    var idResponse = {
        ok: true,
        data: {
            id: 222,
            uid: 'xyz',
        },
    };
    it('should return UID response data', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    getBackendSrv.mockReturnValueOnce({
                        fetch: function (options) {
                            return of(uidResponse);
                        },
                    });
                    _a = expect;
                    return [4 /*yield*/, getDataSourceUsingUidOrId('abcdefg')];
                case 1:
                    _a.apply(void 0, [_b.sent()]).toBe(uidResponse.data);
                    return [2 /*return*/];
            }
        });
    }); });
    it('should return ID response data', function () { return __awaiter(void 0, void 0, void 0, function () {
        var uidResponse, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    uidResponse = {
                        ok: false,
                    };
                    getBackendSrv
                        .mockReturnValueOnce({
                        fetch: function (options) {
                            return of(uidResponse);
                        },
                    })
                        .mockReturnValueOnce({
                        fetch: function (options) {
                            return of(idResponse);
                        },
                    });
                    _a = expect;
                    return [4 /*yield*/, getDataSourceUsingUidOrId(222)];
                case 1:
                    _a.apply(void 0, [_b.sent()]).toBe(idResponse.data);
                    return [2 /*return*/];
            }
        });
    }); });
    it('should return empty response data', function () { return __awaiter(void 0, void 0, void 0, function () {
        var uidResponse, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    // @ts-ignore
                    delete window.location;
                    window.location = {};
                    uidResponse = {
                        ok: false,
                    };
                    getBackendSrv
                        .mockReturnValueOnce({
                        fetch: function (options) {
                            return of(uidResponse);
                        },
                    })
                        .mockReturnValueOnce({
                        fetch: function (options) {
                            return of(idResponse);
                        },
                    });
                    _a = expect;
                    return [4 /*yield*/, getDataSourceUsingUidOrId('222')];
                case 1:
                    _a.apply(void 0, [_b.sent()]).toStrictEqual({});
                    expect(window.location.href).toBe('/datasources/edit/xyz');
                    return [2 /*return*/];
            }
        });
    }); });
});
describe('Name exists', function () {
    var plugins = getMockPlugins(5);
    it('should be true', function () {
        var name = 'pretty cool plugin-1';
        expect(nameExits(plugins, name)).toEqual(true);
    });
    it('should be false', function () {
        var name = 'pretty cool plugin-6';
        expect(nameExits(plugins, name));
    });
});
describe('Find new name', function () {
    it('should create a new name', function () {
        var plugins = getMockPlugins(5);
        var name = 'pretty cool plugin-1';
        expect(findNewName(plugins, name)).toEqual('pretty cool plugin-6');
    });
    it('should create new name without suffix', function () {
        var plugin = getMockPlugin();
        plugin.name = 'prometheus';
        var plugins = [plugin];
        var name = 'prometheus';
        expect(findNewName(plugins, name)).toEqual('prometheus-1');
    });
    it('should handle names that end with -', function () {
        var plugin = getMockPlugin();
        var plugins = [plugin];
        var name = 'pretty cool plugin-';
        expect(findNewName(plugins, name)).toEqual('pretty cool plugin-');
    });
});
describe('initDataSourceSettings', function () {
    describe('when pageId is missing', function () {
        it('then initDataSourceSettingsFailed should be dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var dispatchedActions;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, thunkTester({}).givenThunk(initDataSourceSettings).whenThunkIsDispatched('')];
                    case 1:
                        dispatchedActions = _a.sent();
                        expect(dispatchedActions).toEqual([initDataSourceSettingsFailed(new Error('Invalid ID'))]);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when pageId is a valid', function () {
        it('then initDataSourceSettingsSucceeded should be dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var dataSource, dataSourceMeta, dependencies, state, dispatchedActions;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dataSource = { type: 'app' };
                        dataSourceMeta = { id: 'some id' };
                        dependencies = {
                            loadDataSource: jest.fn(function () { return function (dispatch, getState) { return dataSource; }; }),
                            loadDataSourceMeta: jest.fn(function () { return function (dispatch, getState) { }; }),
                            getDataSource: jest.fn().mockReturnValue(dataSource),
                            getDataSourceMeta: jest.fn().mockReturnValue(dataSourceMeta),
                            importDataSourcePlugin: jest.fn().mockReturnValue({}),
                        };
                        state = {
                            dataSourceSettings: {},
                            dataSources: {},
                        };
                        return [4 /*yield*/, thunkTester(state)
                                .givenThunk(initDataSourceSettings)
                                .whenThunkIsDispatched(256, dependencies)];
                    case 1:
                        dispatchedActions = _a.sent();
                        expect(dispatchedActions).toEqual([initDataSourceSettingsSucceeded({})]);
                        expect(dependencies.loadDataSource).toHaveBeenCalledTimes(1);
                        expect(dependencies.loadDataSource).toHaveBeenCalledWith(256);
                        expect(dependencies.loadDataSourceMeta).toHaveBeenCalledTimes(1);
                        expect(dependencies.loadDataSourceMeta).toHaveBeenCalledWith(dataSource);
                        expect(dependencies.getDataSource).toHaveBeenCalledTimes(1);
                        expect(dependencies.getDataSource).toHaveBeenCalledWith({}, 256);
                        expect(dependencies.getDataSourceMeta).toHaveBeenCalledTimes(1);
                        expect(dependencies.getDataSourceMeta).toHaveBeenCalledWith({}, 'app');
                        expect(dependencies.importDataSourcePlugin).toHaveBeenCalledTimes(1);
                        expect(dependencies.importDataSourcePlugin).toHaveBeenCalledWith(dataSourceMeta);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when plugin loading fails', function () {
        it('then initDataSourceSettingsFailed should be dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var dataSource, dependencies, state, dispatchedActions;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dataSource = { type: 'app' };
                        dependencies = {
                            loadDataSource: jest.fn(function () { return function (dispatch, getState) { return dataSource; }; }),
                            loadDataSourceMeta: jest.fn().mockImplementation(function () {
                                throw new Error('Error loading plugin');
                            }),
                            getDataSource: jest.fn(),
                            getDataSourceMeta: jest.fn(),
                            importDataSourcePlugin: jest.fn(),
                        };
                        state = {
                            dataSourceSettings: {},
                            dataSources: {},
                        };
                        return [4 /*yield*/, thunkTester(state)
                                .givenThunk(initDataSourceSettings)
                                .whenThunkIsDispatched(301, dependencies)];
                    case 1:
                        dispatchedActions = _a.sent();
                        expect(dispatchedActions).toEqual([initDataSourceSettingsFailed(new Error('Error loading plugin'))]);
                        expect(dependencies.loadDataSource).toHaveBeenCalledTimes(1);
                        expect(dependencies.loadDataSource).toHaveBeenCalledWith(301);
                        expect(dependencies.loadDataSourceMeta).toHaveBeenCalledTimes(1);
                        expect(dependencies.loadDataSourceMeta).toHaveBeenCalledWith(dataSource);
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
describe('testDataSource', function () {
    describe('when a datasource is tested', function () {
        it('then testDataSourceStarting and testDataSourceSucceeded should be dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var dependencies, state, dispatchedActions;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dependencies = {
                            getDatasourceSrv: function () {
                                return ({
                                    get: jest.fn().mockReturnValue({
                                        testDatasource: jest.fn().mockReturnValue({
                                            status: '',
                                            message: '',
                                        }),
                                    }),
                                });
                            },
                            getBackendSrv: getBackendSrvMock,
                        };
                        state = {
                            testingStatus: {
                                status: '',
                                message: '',
                            },
                        };
                        return [4 /*yield*/, thunkTester(state)
                                .givenThunk(testDataSource)
                                .whenThunkIsDispatched('Azure Monitor', dependencies)];
                    case 1:
                        dispatchedActions = _a.sent();
                        expect(dispatchedActions).toEqual([testDataSourceStarting(), testDataSourceSucceeded(state.testingStatus)]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('then testDataSourceFailed should be dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var dependencies, result, state, dispatchedActions;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dependencies = {
                            getDatasourceSrv: function () {
                                return ({
                                    get: jest.fn().mockReturnValue({
                                        testDatasource: jest.fn().mockImplementation(function () {
                                            throw new Error('Error testing datasource');
                                        }),
                                    }),
                                });
                            },
                            getBackendSrv: getBackendSrvMock,
                        };
                        result = {
                            message: 'Error testing datasource',
                        };
                        state = {
                            testingStatus: {
                                message: '',
                                status: '',
                            },
                        };
                        return [4 /*yield*/, thunkTester(state)
                                .givenThunk(testDataSource)
                                .whenThunkIsDispatched('Azure Monitor', dependencies)];
                    case 1:
                        dispatchedActions = _a.sent();
                        expect(dispatchedActions).toEqual([testDataSourceStarting(), testDataSourceFailed(result)]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('then testDataSourceFailed should be dispatched with response error message', function () { return __awaiter(void 0, void 0, void 0, function () {
            var result, dispatchedActions;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        result = {
                            message: 'Error testing datasource',
                        };
                        return [4 /*yield*/, failDataSourceTest({
                                message: 'Error testing datasource',
                                data: { message: 'Response error message' },
                                statusText: 'Bad Request',
                            })];
                    case 1:
                        dispatchedActions = _a.sent();
                        expect(dispatchedActions).toEqual([testDataSourceStarting(), testDataSourceFailed(result)]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('then testDataSourceFailed should be dispatched with response data message', function () { return __awaiter(void 0, void 0, void 0, function () {
            var result, dispatchedActions;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        result = {
                            message: 'Response error message',
                        };
                        return [4 /*yield*/, failDataSourceTest({
                                data: { message: 'Response error message' },
                                statusText: 'Bad Request',
                            })];
                    case 1:
                        dispatchedActions = _a.sent();
                        expect(dispatchedActions).toEqual([testDataSourceStarting(), testDataSourceFailed(result)]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('then testDataSourceFailed should be dispatched with response statusText', function () { return __awaiter(void 0, void 0, void 0, function () {
            var result, dispatchedActions;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        result = {
                            message: 'HTTP error Bad Request',
                        };
                        return [4 /*yield*/, failDataSourceTest({ data: {}, statusText: 'Bad Request' })];
                    case 1:
                        dispatchedActions = _a.sent();
                        expect(dispatchedActions).toEqual([testDataSourceStarting(), testDataSourceFailed(result)]);
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=actions.test.js.map