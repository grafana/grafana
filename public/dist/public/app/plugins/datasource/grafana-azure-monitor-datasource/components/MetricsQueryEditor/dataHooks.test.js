import { __assign, __awaiter, __generator } from "tslib";
import { renderHook } from '@testing-library/react-hooks';
import { useAsyncState, useMetricNames, useResourceGroups, useResourceNames, useResourceTypes, } from './dataHooks';
import { AzureQueryType } from '../../types';
import createMockDatasource from '../../__mocks__/datasource';
var WAIT_OPTIONS = {
    timeout: 1000,
};
function createWaitableMock() {
    var resolve;
    var mock = jest.fn();
    mock.mockImplementation(function () {
        resolve && resolve();
    });
    mock.waitToBeCalled = function () {
        return new Promise(function (_resolve) { return (resolve = _resolve); });
    };
    return mock;
}
var opt = function (text, value) { return ({ text: text, value: value }); };
describe('AzureMonitor: useAsyncState', function () {
    var MOCKED_RANDOM_VALUE = 0.42069;
    beforeEach(function () {
        jest.spyOn(global.Math, 'random').mockReturnValue(MOCKED_RANDOM_VALUE);
    });
    afterEach(function () {
        jest.spyOn(global.Math, 'random').mockRestore();
    });
    it('should return data from an async function', function () { return __awaiter(void 0, void 0, void 0, function () {
        var apiCall, setError, _a, result, waitForNextUpdate;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    apiCall = function () { return Promise.resolve(['a', 'b', 'c']); };
                    setError = jest.fn();
                    _a = renderHook(function () { return useAsyncState(apiCall, setError, []); }), result = _a.result, waitForNextUpdate = _a.waitForNextUpdate;
                    return [4 /*yield*/, waitForNextUpdate()];
                case 1:
                    _b.sent();
                    expect(result.current).toEqual(['a', 'b', 'c']);
                    return [2 /*return*/];
            }
        });
    }); });
    it('should report errors through setError', function () { return __awaiter(void 0, void 0, void 0, function () {
        var error, apiCall, setError, _a, result, waitForNextUpdate;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    error = new Error();
                    apiCall = function () { return Promise.reject(error); };
                    setError = createWaitableMock();
                    _a = renderHook(function () { return useAsyncState(apiCall, setError, []); }), result = _a.result, waitForNextUpdate = _a.waitForNextUpdate;
                    return [4 /*yield*/, Promise.race([waitForNextUpdate(), setError.waitToBeCalled()])];
                case 1:
                    _b.sent();
                    expect(result.current).toEqual([]);
                    expect(setError).toHaveBeenCalledWith(MOCKED_RANDOM_VALUE, error);
                    return [2 /*return*/];
            }
        });
    }); });
    it('should clear the error once the request is successful', function () { return __awaiter(void 0, void 0, void 0, function () {
        var apiCall, setError, waitForNextUpdate;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    apiCall = function () { return Promise.resolve(['a', 'b', 'c']); };
                    setError = createWaitableMock();
                    waitForNextUpdate = renderHook(function () { return useAsyncState(apiCall, setError, []); }).waitForNextUpdate;
                    return [4 /*yield*/, Promise.race([waitForNextUpdate(), setError.waitToBeCalled()])];
                case 1:
                    _a.sent();
                    expect(setError).toHaveBeenCalledWith(MOCKED_RANDOM_VALUE, undefined);
                    return [2 /*return*/];
            }
        });
    }); });
});
describe('AzureMonitor: metrics dataHooks', function () {
    var bareQuery = {
        refId: 'A',
        queryType: AzureQueryType.AzureMonitor,
        subscription: 'sub-abc-123',
    };
    var testTable = [
        {
            name: 'useResourceGroups',
            hook: useResourceGroups,
            emptyQueryPartial: {},
            validQueryPartial: {
                resourceGroup: 'web-app-development',
            },
            invalidQueryPartial: {
                resourceGroup: 'wrong-resource-group`',
            },
            templateVariableQueryPartial: {
                resourceGroup: '$rg',
            },
            expectedOptions: [
                {
                    label: 'Web App - Production',
                    value: 'web-app-production',
                },
                {
                    label: 'Web App - Development',
                    value: 'web-app-development',
                },
            ],
            expectedClearedQueryPartial: {
                resourceGroup: undefined,
            },
        },
        {
            name: 'useResourceTypes',
            hook: useResourceTypes,
            emptyQueryPartial: {
                resourceGroup: 'web-app-development',
            },
            validQueryPartial: {
                resourceGroup: 'web-app-development',
                metricDefinition: 'azure/vm',
            },
            invalidQueryPartial: {
                resourceGroup: 'web-app-development',
                metricDefinition: 'azure/invalid-resource-type',
            },
            templateVariableQueryPartial: {
                resourceGroup: 'web-app-development',
                metricDefinition: '$rt',
            },
            expectedOptions: [
                {
                    label: 'Virtual Machine',
                    value: 'azure/vm',
                },
                {
                    label: 'Database',
                    value: 'azure/db',
                },
            ],
            expectedClearedQueryPartial: {
                resourceGroup: 'web-app-development',
                metricDefinition: undefined,
            },
        },
        {
            name: 'useResourceNames',
            hook: useResourceNames,
            emptyQueryPartial: {
                resourceGroup: 'web-app-development',
                metricDefinition: 'azure/vm',
            },
            validQueryPartial: {
                resourceGroup: 'web-app-development',
                metricDefinition: 'azure/vm',
                resourceName: 'web-server',
            },
            invalidQueryPartial: {
                resourceGroup: 'web-app-development',
                metricDefinition: 'azure/vm',
                resourceName: 'resource-that-doesnt-exist',
            },
            templateVariableQueryPartial: {
                resourceGroup: 'web-app-development',
                metricDefinition: 'azure/vm',
                resourceName: '$variable',
            },
            expectedOptions: [
                {
                    label: 'Web server',
                    value: 'web-server',
                },
                {
                    label: 'Job server',
                    value: 'job-server',
                },
            ],
            expectedClearedQueryPartial: {
                resourceGroup: 'web-app-development',
                metricDefinition: 'azure/vm',
                resourceName: undefined,
            },
        },
        {
            name: 'useMetricNames',
            hook: useMetricNames,
            emptyQueryPartial: {
                resourceGroup: 'web-app-development',
                metricDefinition: 'azure/vm',
                resourceName: 'web-server',
                metricNamespace: 'azure/vm',
            },
            validQueryPartial: {
                resourceGroup: 'web-app-development',
                metricDefinition: 'azure/vm',
                resourceName: 'web-server',
                metricNamespace: 'azure/vm',
            },
            invalidQueryPartial: {
                resourceGroup: 'web-app-development',
                metricDefinition: 'azure/vm',
                resourceName: 'web-server',
                metricNamespace: 'azure/vm',
                metricName: 'invalid-metric',
            },
            templateVariableQueryPartial: {
                resourceGroup: 'web-app-development',
                metricDefinition: 'azure/vm',
                resourceName: 'web-server',
                metricNamespace: 'azure/vm',
                metricName: '$variable',
            },
            expectedOptions: [
                {
                    label: 'Percentage CPU',
                    value: 'percentage-cpu',
                },
                {
                    label: 'Free memory',
                    value: 'free-memory',
                },
            ],
            expectedClearedQueryPartial: {
                resourceGroup: 'web-app-development',
                metricDefinition: 'azure/vm',
                resourceName: 'web-server',
                metricNamespace: 'azure/vm',
                metricName: undefined,
            },
        },
    ];
    var datasource;
    var onChange;
    var setError;
    beforeEach(function () {
        onChange = jest.fn();
        setError = jest.fn();
        datasource = createMockDatasource();
        datasource.getVariables = jest.fn().mockReturnValue(['$sub', '$rg', '$rt', '$variable']);
        datasource.getResourceGroups = jest
            .fn()
            .mockResolvedValue([
            opt('Web App - Production', 'web-app-production'),
            opt('Web App - Development', 'web-app-development'),
        ]);
        datasource.getMetricDefinitions = jest
            .fn()
            .mockResolvedValue([opt('Virtual Machine', 'azure/vm'), opt('Database', 'azure/db')]);
        datasource.getResourceNames = jest
            .fn()
            .mockResolvedValue([opt('Web server', 'web-server'), opt('Job server', 'job-server')]);
        datasource.getMetricNames = jest
            .fn()
            .mockResolvedValue([opt('Percentage CPU', 'percentage-cpu'), opt('Free memory', 'free-memory')]);
    });
    describe.each(testTable)('scenario %#: $name', function (scenario) {
        it('returns values', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, _a, result, waitForNextUpdate;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        query = __assign(__assign({}, bareQuery), { azureMonitor: scenario.emptyQueryPartial });
                        _a = renderHook(function () { return scenario.hook(query, datasource, onChange, setError); }), result = _a.result, waitForNextUpdate = _a.waitForNextUpdate;
                        return [4 /*yield*/, waitForNextUpdate(WAIT_OPTIONS)];
                    case 1:
                        _b.sent();
                        expect(result.current).toEqual(scenario.expectedOptions);
                        return [2 /*return*/];
                }
            });
        }); });
        it('does not call onChange when the property has not been set', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, waitForNextUpdate;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = __assign(__assign({}, bareQuery), { azureMonitor: scenario.emptyQueryPartial });
                        waitForNextUpdate = renderHook(function () { return scenario.hook(query, datasource, onChange, setError); }).waitForNextUpdate;
                        return [4 /*yield*/, waitForNextUpdate(WAIT_OPTIONS)];
                    case 1:
                        _a.sent();
                        expect(onChange).not.toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it('does not clear the property when it is a valid option', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, waitForNextUpdate;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = __assign(__assign({}, bareQuery), { azureMonitor: scenario.validQueryPartial });
                        waitForNextUpdate = renderHook(function () { return scenario.hook(query, datasource, onChange, setError); }).waitForNextUpdate;
                        return [4 /*yield*/, waitForNextUpdate(WAIT_OPTIONS)];
                    case 1:
                        _a.sent();
                        expect(onChange).not.toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it('does not clear the property when it is a template variable', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, waitForNextUpdate;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = __assign(__assign({}, bareQuery), { azureMonitor: scenario.templateVariableQueryPartial });
                        waitForNextUpdate = renderHook(function () { return scenario.hook(query, datasource, onChange, setError); }).waitForNextUpdate;
                        return [4 /*yield*/, waitForNextUpdate(WAIT_OPTIONS)];
                    case 1:
                        _a.sent();
                        expect(onChange).not.toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it('clears the property when it is not a valid option', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, waitForNextUpdate;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = __assign(__assign({}, bareQuery), { azureMonitor: scenario.invalidQueryPartial });
                        waitForNextUpdate = renderHook(function () { return scenario.hook(query, datasource, onChange, setError); }).waitForNextUpdate;
                        return [4 /*yield*/, waitForNextUpdate(WAIT_OPTIONS)];
                    case 1:
                        _a.sent();
                        expect(onChange).toHaveBeenCalledWith(__assign(__assign({}, query), { azureMonitor: scenario.expectedClearedQueryPartial }));
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=dataHooks.test.js.map