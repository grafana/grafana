import { __assign, __awaiter, __generator } from "tslib";
import { QueryRunners, variableDummyRefId } from './queryRunners';
import { getDefaultTimeRange, VariableSupportType } from '@grafana/data';
import { VariableRefresh } from '../types';
import { of } from 'rxjs';
describe('QueryRunners', function () {
    describe('when using a legacy data source', function () {
        var getLegacyTestContext = function (variable) {
            var defaultTimeRange = getDefaultTimeRange();
            variable = variable !== null && variable !== void 0 ? variable : { query: 'A query' };
            var timeSrv = {
                timeRange: jest.fn().mockReturnValue(defaultTimeRange),
            };
            var datasource = { metricFindQuery: jest.fn().mockResolvedValue([{ text: 'A', value: 'A' }]) };
            var runner = new QueryRunners().getRunnerForDatasource(datasource);
            var runRequest = jest.fn().mockReturnValue(of({}));
            var runnerArgs = { datasource: datasource, variable: variable, searchFilter: 'A searchFilter', timeSrv: timeSrv, runRequest: runRequest };
            var request = {};
            return { timeSrv: timeSrv, datasource: datasource, runner: runner, variable: variable, runnerArgs: runnerArgs, request: request, defaultTimeRange: defaultTimeRange };
        };
        describe('and calling getRunnerForDatasource', function () {
            it('then it should return LegacyQueryRunner', function () {
                var runner = getLegacyTestContext().runner;
                expect(runner.type).toEqual(VariableSupportType.Legacy);
            });
        });
        describe('and calling getTarget', function () {
            it('then it should return correct target', function () {
                var _a = getLegacyTestContext(), runner = _a.runner, datasource = _a.datasource, variable = _a.variable;
                var target = runner.getTarget({ datasource: datasource, variable: variable });
                expect(target).toEqual('A query');
            });
        });
        describe('and calling runRequest with a variable that refreshes when time range changes', function () {
            var _a = getLegacyTestContext({
                query: 'A query',
                refresh: VariableRefresh.onTimeRangeChanged,
            }), datasource = _a.datasource, runner = _a.runner, runnerArgs = _a.runnerArgs, request = _a.request, timeSrv = _a.timeSrv, defaultTimeRange = _a.defaultTimeRange;
            var observable = runner.runRequest(runnerArgs, request);
            it('then it should return correct observable', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, expect(observable).toEmitValuesWith(function (received) {
                                var value = received[0];
                                expect(value).toEqual({
                                    series: [{ text: 'A', value: 'A' }],
                                    state: 'Done',
                                    timeRange: defaultTimeRange,
                                });
                            })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('and it should call timeSrv.timeRange()', function () {
                expect(timeSrv.timeRange).toHaveBeenCalledTimes(1);
            });
            it('and it should call metricFindQuery with correct options', function () {
                expect(datasource.metricFindQuery).toHaveBeenCalledTimes(1);
                expect(datasource.metricFindQuery).toHaveBeenCalledWith('A query', {
                    range: defaultTimeRange,
                    searchFilter: 'A searchFilter',
                    variable: {
                        query: 'A query',
                        refresh: VariableRefresh.onTimeRangeChanged,
                    },
                });
            });
        });
        describe('and calling runRequest with a variable that refreshes on dashboard load', function () {
            var _a = getLegacyTestContext({
                query: 'A query',
                refresh: VariableRefresh.onDashboardLoad,
            }), datasource = _a.datasource, runner = _a.runner, runnerArgs = _a.runnerArgs, request = _a.request, timeSrv = _a.timeSrv, defaultTimeRange = _a.defaultTimeRange;
            var observable = runner.runRequest(runnerArgs, request);
            it('then it should return correct observable', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, expect(observable).toEmitValuesWith(function (received) {
                                var value = received[0];
                                expect(value).toEqual({
                                    series: [{ text: 'A', value: 'A' }],
                                    state: 'Done',
                                    timeRange: defaultTimeRange,
                                });
                            })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('and it should call timeSrv.timeRange()', function () {
                expect(timeSrv.timeRange).toHaveBeenCalledTimes(1);
            });
            it('and it should call metricFindQuery with correct options', function () {
                expect(datasource.metricFindQuery).toHaveBeenCalledTimes(1);
                expect(datasource.metricFindQuery).toHaveBeenCalledWith('A query', {
                    range: defaultTimeRange,
                    searchFilter: 'A searchFilter',
                    variable: {
                        query: 'A query',
                        refresh: VariableRefresh.onDashboardLoad,
                    },
                });
            });
        });
        describe('and calling runRequest with a variable that does not refresh when time range changes', function () {
            var _a = getLegacyTestContext({
                query: 'A query',
                refresh: VariableRefresh.never,
            }), datasource = _a.datasource, runner = _a.runner, runnerArgs = _a.runnerArgs, request = _a.request, timeSrv = _a.timeSrv;
            var observable = runner.runRequest(runnerArgs, request);
            it('then it should return correct observable', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, expect(observable).toEmitValuesWith(function (received) {
                                var values = received[0];
                                expect(values).toEqual({
                                    series: [{ text: 'A', value: 'A' }],
                                    state: 'Done',
                                    timeRange: undefined,
                                });
                            })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('and it should not call timeSrv.timeRange()', function () {
                expect(timeSrv.timeRange).not.toHaveBeenCalled();
            });
            it('and it should call metricFindQuery with correct options', function () {
                expect(datasource.metricFindQuery).toHaveBeenCalledTimes(1);
                expect(datasource.metricFindQuery).toHaveBeenCalledWith('A query', {
                    range: undefined,
                    searchFilter: 'A searchFilter',
                    variable: {
                        query: 'A query',
                        refresh: VariableRefresh.never,
                    },
                });
            });
        });
    });
    describe('when using a data source with standard variable support', function () {
        var getStandardTestContext = function (datasource) {
            var variable = { query: { refId: 'A', query: 'A query' } };
            var timeSrv = {};
            datasource = datasource !== null && datasource !== void 0 ? datasource : {
                variables: {
                    getType: function () { return VariableSupportType.Standard; },
                    toDataQuery: function (query) { return (__assign(__assign({}, query), { extra: 'extra' })); },
                },
            };
            var runner = new QueryRunners().getRunnerForDatasource(datasource);
            var runRequest = jest.fn().mockReturnValue(of({}));
            var runnerArgs = { datasource: datasource, variable: variable, searchFilter: 'A searchFilter', timeSrv: timeSrv, runRequest: runRequest };
            var request = {};
            return { timeSrv: timeSrv, datasource: datasource, runner: runner, variable: variable, runnerArgs: runnerArgs, request: request, runRequest: runRequest };
        };
        describe('and calling getRunnerForDatasource', function () {
            it('then it should return StandardQueryRunner', function () {
                var runner = getStandardTestContext().runner;
                expect(runner.type).toEqual(VariableSupportType.Standard);
            });
        });
        describe('and calling getTarget', function () {
            it('then it should return correct target', function () {
                var _a = getStandardTestContext(), runner = _a.runner, variable = _a.variable, datasource = _a.datasource;
                var target = runner.getTarget({ datasource: datasource, variable: variable });
                expect(target).toEqual({ refId: 'A', query: 'A query', extra: 'extra' });
            });
        });
        describe('and calling runRequest with a datasource that uses a custom query', function () {
            var _a = getStandardTestContext({
                variables: {
                    getType: function () { return VariableSupportType.Standard; },
                    toDataQuery: function () { return undefined; },
                    query: function () { return undefined; },
                },
            }), runner = _a.runner, request = _a.request, runnerArgs = _a.runnerArgs, runRequest = _a.runRequest, datasource = _a.datasource;
            var observable = runner.runRequest(runnerArgs, request);
            it('then it should return correct observable', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, expect(observable).toEmitValuesWith(function (received) {
                                var value = received[0];
                                expect(value).toEqual({});
                            })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('then it should call runRequest with correct args', function () {
                expect(runRequest).toHaveBeenCalledTimes(1);
                expect(runRequest).toHaveBeenCalledWith(datasource, {}, datasource.variables.query);
            });
        });
        describe('and calling runRequest with a datasource that has no custom query', function () {
            var _a = getStandardTestContext({
                variables: { getType: function () { return VariableSupportType.Standard; }, toDataQuery: function () { return undefined; } },
            }), runner = _a.runner, request = _a.request, runnerArgs = _a.runnerArgs, runRequest = _a.runRequest, datasource = _a.datasource;
            var observable = runner.runRequest(runnerArgs, request);
            it('then it should return correct observable', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, expect(observable).toEmitValuesWith(function (received) {
                                var value = received[0];
                                expect(value).toEqual({});
                            })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('then it should call runRequest with correct args', function () {
                expect(runRequest).toHaveBeenCalledTimes(1);
                expect(runRequest).toHaveBeenCalledWith(datasource, {});
            });
        });
    });
    describe('when using a data source with custom variable support', function () {
        var getCustomTestContext = function () {
            var variable = { query: { refId: 'A', query: 'A query' } };
            var timeSrv = {};
            var datasource = {
                variables: { getType: function () { return VariableSupportType.Custom; }, query: function () { return undefined; }, editor: {} },
            };
            var runner = new QueryRunners().getRunnerForDatasource(datasource);
            var runRequest = jest.fn().mockReturnValue(of({}));
            var runnerArgs = { datasource: datasource, variable: variable, searchFilter: 'A searchFilter', timeSrv: timeSrv, runRequest: runRequest };
            var request = {};
            return { timeSrv: timeSrv, datasource: datasource, runner: runner, variable: variable, runnerArgs: runnerArgs, request: request, runRequest: runRequest };
        };
        describe('and calling getRunnerForDatasource', function () {
            it('then it should return CustomQueryRunner', function () {
                var runner = getCustomTestContext().runner;
                expect(runner.type).toEqual(VariableSupportType.Custom);
            });
        });
        describe('and calling getTarget', function () {
            it('then it should return correct target', function () {
                var _a = getCustomTestContext(), runner = _a.runner, variable = _a.variable, datasource = _a.datasource;
                var target = runner.getTarget({ datasource: datasource, variable: variable });
                expect(target).toEqual({ refId: 'A', query: 'A query' });
            });
        });
        describe('and calling runRequest', function () {
            var _a = getCustomTestContext(), runner = _a.runner, request = _a.request, runnerArgs = _a.runnerArgs, runRequest = _a.runRequest, datasource = _a.datasource;
            var observable = runner.runRequest(runnerArgs, request);
            it('then it should return correct observable', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, expect(observable).toEmitValuesWith(function (received) {
                                var value = received[0];
                                expect(value).toEqual({});
                            })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('then it should call runRequest with correct args', function () {
                expect(runRequest).toHaveBeenCalledTimes(1);
                expect(runRequest).toHaveBeenCalledWith(datasource, {}, datasource.variables.query);
            });
        });
    });
    describe('when using a data source with datasource variable support', function () {
        var getDatasourceTestContext = function () {
            var variable = { query: { refId: 'A', query: 'A query' } };
            var timeSrv = {};
            var datasource = {
                variables: { getType: function () { return VariableSupportType.Datasource; } },
            };
            var runner = new QueryRunners().getRunnerForDatasource(datasource);
            var runRequest = jest.fn().mockReturnValue(of({}));
            var runnerArgs = { datasource: datasource, variable: variable, searchFilter: 'A searchFilter', timeSrv: timeSrv, runRequest: runRequest };
            var request = {};
            return { timeSrv: timeSrv, datasource: datasource, runner: runner, variable: variable, runnerArgs: runnerArgs, request: request, runRequest: runRequest };
        };
        describe('and calling getRunnerForDatasource', function () {
            it('then it should return DatasourceQueryRunner', function () {
                var runner = getDatasourceTestContext().runner;
                expect(runner.type).toEqual(VariableSupportType.Datasource);
            });
        });
        describe('and calling getTarget', function () {
            it('then it should return correct target', function () {
                var _a = getDatasourceTestContext(), runner = _a.runner, datasource = _a.datasource, variable = _a.variable;
                var target = runner.getTarget({ datasource: datasource, variable: variable });
                expect(target).toEqual({ refId: 'A', query: 'A query' });
            });
            describe('and ref id is missing', function () {
                it('then it should return correct target with dummy ref id', function () {
                    var _a = getDatasourceTestContext(), runner = _a.runner, datasource = _a.datasource, variable = _a.variable;
                    delete variable.query.refId;
                    var target = runner.getTarget({ datasource: datasource, variable: variable });
                    expect(target).toEqual({ refId: variableDummyRefId, query: 'A query' });
                });
            });
        });
        describe('and calling runRequest', function () {
            var _a = getDatasourceTestContext(), runner = _a.runner, request = _a.request, runnerArgs = _a.runnerArgs, runRequest = _a.runRequest, datasource = _a.datasource;
            var observable = runner.runRequest(runnerArgs, request);
            it('then it should return correct observable', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, expect(observable).toEmitValuesWith(function (received) {
                                var value = received[0];
                                expect(value).toEqual({});
                            })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('then it should call runRequest with correct args', function () {
                expect(runRequest).toHaveBeenCalledTimes(1);
                expect(runRequest).toHaveBeenCalledWith(datasource, {});
            });
        });
    });
    describe('when using a data source with unknown variable support', function () {
        describe('and calling getRunnerForDatasource', function () {
            it('then it should throw', function () {
                var datasource = {
                    variables: {},
                };
                expect(function () { return new QueryRunners().getRunnerForDatasource(datasource); }).toThrow();
            });
        });
    });
});
//# sourceMappingURL=queryRunners.test.js.map