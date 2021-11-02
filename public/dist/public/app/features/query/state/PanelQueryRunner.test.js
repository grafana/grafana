import { __assign, __awaiter, __generator } from "tslib";
var applyFieldOverridesMock = jest.fn(); // needs to be first in this file
import { Subject } from 'rxjs';
// Importing this way to be able to spy on grafana/data
import * as grafanaData from '@grafana/data';
import { DashboardModel } from '../../dashboard/state/index';
import { setDataSourceSrv, setEchoSrv } from '@grafana/runtime';
import { Echo } from '../../../core/services/echo/Echo';
import { emptyResult } from './DashboardQueryRunner/utils';
import { createDashboardQueryRunner, setDashboardQueryRunnerFactory, } from './DashboardQueryRunner/DashboardQueryRunner';
import { PanelQueryRunner } from './PanelQueryRunner';
jest.mock('@grafana/data', function () { return (__assign(__assign({ __esModule: true }, jest.requireActual('@grafana/data')), { applyFieldOverrides: applyFieldOverridesMock })); });
jest.mock('app/core/services/backend_srv');
jest.mock('app/core/config', function () { return ({
    config: { featureToggles: { transformations: true } },
    getConfig: function () { return ({
        featureToggles: {},
    }); },
}); });
var dashboardModel = new DashboardModel({
    panels: [{ id: 1, type: 'graph' }],
});
jest.mock('app/features/dashboard/services/DashboardSrv', function () { return ({
    getDashboardSrv: function () {
        return {
            getCurrent: function () { return dashboardModel; },
        };
    },
}); });
function describeQueryRunnerScenario(description, scenarioFn, panelConfig) {
    var _this = this;
    describe(description, function () {
        var setupFn = function () { };
        var defaultPanelConfig = {
            getFieldOverrideOptions: function () { return undefined; },
            getTransformations: function () { return undefined; },
            getDataSupport: function () { return ({ annotations: false, alertStates: false }); },
        };
        var ctx = {
            maxDataPoints: 200,
            scopedVars: {
                server: { text: 'Server1', value: 'server-1' },
            },
            runner: new PanelQueryRunner(panelConfig || defaultPanelConfig),
            setup: function (fn) {
                setupFn = fn;
            },
        };
        var response = {
            data: [
                {
                    target: 'hello',
                    datapoints: [
                        [1, 1000],
                        [2, 2000],
                    ],
                },
            ],
        };
        setDataSourceSrv({});
        setDashboardQueryRunnerFactory(function () { return ({
            getResult: emptyResult,
            run: function () { return undefined; },
            cancel: function () { return undefined; },
            cancellations: function () { return new Subject(); },
            destroy: function () { return undefined; },
        }); });
        createDashboardQueryRunner({});
        beforeEach(function () { return __awaiter(_this, void 0, void 0, function () {
            var datasource, args;
            return __generator(this, function (_a) {
                setEchoSrv(new Echo());
                setupFn();
                datasource = {
                    name: 'TestDB',
                    uid: 'TestDB-uid',
                    interval: ctx.dsInterval,
                    query: function (options) {
                        ctx.queryCalledWith = options;
                        return Promise.resolve(response);
                    },
                    testDatasource: jest.fn(),
                };
                args = {
                    datasource: datasource,
                    scopedVars: ctx.scopedVars,
                    minInterval: ctx.minInterval,
                    maxDataPoints: ctx.maxDataPoints,
                    timeRange: {
                        from: grafanaData.dateTime().subtract(1, 'days'),
                        to: grafanaData.dateTime(),
                        raw: { from: '1d', to: 'now' },
                    },
                    panelId: 1,
                    queries: [{ refId: 'A', test: 1 }],
                };
                ctx.runner = new PanelQueryRunner(panelConfig || defaultPanelConfig);
                ctx.runner.getData({ withTransforms: true, withFieldConfig: true }).subscribe({
                    next: function (data) {
                        var _a;
                        ctx.res = data;
                        (_a = ctx.events) === null || _a === void 0 ? void 0 : _a.push(data);
                    },
                });
                ctx.events = [];
                ctx.runner.run(args);
                return [2 /*return*/];
            });
        }); });
        scenarioFn(ctx);
    });
}
describe('PanelQueryRunner', function () {
    beforeEach(function () {
        jest.clearAllMocks();
    });
    describeQueryRunnerScenario('simple scenario', function (ctx) {
        it('should set requestId on request', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                expect((_a = ctx.queryCalledWith) === null || _a === void 0 ? void 0 : _a.requestId).toBe('Q100');
                return [2 /*return*/];
            });
        }); });
        it('should set datasource uid on request', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, _b;
            return __generator(this, function (_c) {
                expect((_b = (_a = ctx.queryCalledWith) === null || _a === void 0 ? void 0 : _a.targets[0].datasource) === null || _b === void 0 ? void 0 : _b.uid).toBe('TestDB-uid');
                return [2 /*return*/];
            });
        }); });
        it('should pass scopedVars to datasource with interval props', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, _b, _c;
            return __generator(this, function (_d) {
                expect((_a = ctx.queryCalledWith) === null || _a === void 0 ? void 0 : _a.scopedVars.server.text).toBe('Server1');
                expect((_b = ctx.queryCalledWith) === null || _b === void 0 ? void 0 : _b.scopedVars.__interval.text).toBe('5m');
                expect((_c = ctx.queryCalledWith) === null || _c === void 0 ? void 0 : _c.scopedVars.__interval_ms.text).toBe('300000');
                return [2 /*return*/];
            });
        }); });
    });
    describeQueryRunnerScenario('with maxDataPoints', function (ctx) {
        ctx.setup(function () {
            ctx.maxDataPoints = 200;
        });
        it('should return data', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, _b;
            return __generator(this, function (_c) {
                expect((_a = ctx.res) === null || _a === void 0 ? void 0 : _a.error).toBeUndefined();
                expect((_b = ctx.res) === null || _b === void 0 ? void 0 : _b.series.length).toBe(1);
                return [2 /*return*/];
            });
        }); });
        it('should use widthPixels as maxDataPoints', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                expect((_a = ctx.queryCalledWith) === null || _a === void 0 ? void 0 : _a.maxDataPoints).toBe(200);
                return [2 /*return*/];
            });
        }); });
        it('should calculate interval based on width', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                expect((_a = ctx.queryCalledWith) === null || _a === void 0 ? void 0 : _a.interval).toBe('5m');
                return [2 /*return*/];
            });
        }); });
        it('fast query should only publish 1 data events', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                expect((_a = ctx.events) === null || _a === void 0 ? void 0 : _a.length).toBe(1);
                return [2 /*return*/];
            });
        }); });
    });
    describeQueryRunnerScenario('with no panel min interval but datasource min interval', function (ctx) {
        ctx.setup(function () {
            ctx.maxDataPoints = 20000;
            ctx.dsInterval = '15s';
        });
        it('should limit interval to data source min interval', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                expect((_a = ctx.queryCalledWith) === null || _a === void 0 ? void 0 : _a.interval).toBe('15s');
                return [2 /*return*/];
            });
        }); });
    });
    describeQueryRunnerScenario('with panel min interval and data source min interval', function (ctx) {
        ctx.setup(function () {
            ctx.maxDataPoints = 20000;
            ctx.dsInterval = '15s';
            ctx.minInterval = '30s';
        });
        it('should limit interval to panel min interval', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                expect((_a = ctx.queryCalledWith) === null || _a === void 0 ? void 0 : _a.interval).toBe('30s');
                return [2 /*return*/];
            });
        }); });
    });
    describeQueryRunnerScenario('with maxDataPoints', function (ctx) {
        ctx.setup(function () {
            ctx.maxDataPoints = 10;
        });
        it('should pass maxDataPoints if specified', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                expect((_a = ctx.queryCalledWith) === null || _a === void 0 ? void 0 : _a.maxDataPoints).toBe(10);
                return [2 /*return*/];
            });
        }); });
        it('should use instead of width to calculate interval', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                expect((_a = ctx.queryCalledWith) === null || _a === void 0 ? void 0 : _a.interval).toBe('2h');
                return [2 /*return*/];
            });
        }); });
    });
    describeQueryRunnerScenario('field overrides', function (ctx) {
        it('should apply when field override options are set', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                ctx.runner.getData({ withTransforms: true, withFieldConfig: true }).subscribe({
                    next: function (data) {
                        return data;
                    },
                });
                expect(applyFieldOverridesMock).toBeCalled();
                return [2 /*return*/];
            });
        }); });
    }, {
        getFieldOverrideOptions: function () { return ({
            fieldConfig: {
                defaults: {
                    unit: 'm/s',
                },
                // @ts-ignore
                overrides: [],
            },
            replaceVariables: function (v) { return v; },
            theme: grafanaData.createTheme(),
        }); },
        getTransformations: function () { return undefined; },
        getDataSupport: function () { return ({ annotations: false, alertStates: false }); },
    });
    describeQueryRunnerScenario('transformations', function (ctx) {
        it('should apply when transformations are set', function () { return __awaiter(void 0, void 0, void 0, function () {
            var spy;
            return __generator(this, function (_a) {
                spy = jest.spyOn(grafanaData, 'transformDataFrame');
                spy.mockClear();
                ctx.runner.getData({ withTransforms: true, withFieldConfig: true }).subscribe({
                    next: function (data) {
                        return data;
                    },
                });
                expect(spy).toBeCalled();
                return [2 /*return*/];
            });
        }); });
    }, {
        getFieldOverrideOptions: function () { return undefined; },
        // @ts-ignore
        getTransformations: function () { return [{}]; },
        getDataSupport: function () { return ({ annotations: false, alertStates: false }); },
    });
    describeQueryRunnerScenario('getData', function (ctx) {
        it('should not apply transformations when transform option is false', function () { return __awaiter(void 0, void 0, void 0, function () {
            var spy;
            return __generator(this, function (_a) {
                spy = jest.spyOn(grafanaData, 'transformDataFrame');
                spy.mockClear();
                ctx.runner.getData({ withTransforms: false, withFieldConfig: true }).subscribe({
                    next: function (data) {
                        return data;
                    },
                });
                expect(spy).not.toBeCalled();
                return [2 /*return*/];
            });
        }); });
        it('should not apply field config when applyFieldConfig option is false', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                ctx.runner.getData({ withFieldConfig: false, withTransforms: true }).subscribe({
                    next: function (data) {
                        return data;
                    },
                });
                expect(applyFieldOverridesMock).not.toBeCalled();
                return [2 /*return*/];
            });
        }); });
    }, {
        getFieldOverrideOptions: function () { return ({
            fieldConfig: {
                defaults: {
                    unit: 'm/s',
                },
                // @ts-ignore
                overrides: [],
            },
            replaceVariables: function (v) { return v; },
            theme: grafanaData.createTheme(),
        }); },
        // @ts-ignore
        getTransformations: function () { return [{}]; },
        getDataSupport: function () { return ({ annotations: false, alertStates: false }); },
    });
    describeQueryRunnerScenario('getData', function (ctx) {
        it('should not apply transformations when transform option is false', function () { return __awaiter(void 0, void 0, void 0, function () {
            var spy;
            return __generator(this, function (_a) {
                spy = jest.spyOn(grafanaData, 'transformDataFrame');
                spy.mockClear();
                ctx.runner.getData({ withTransforms: false, withFieldConfig: true }).subscribe({
                    next: function (data) {
                        return data;
                    },
                });
                expect(spy).not.toBeCalled();
                return [2 /*return*/];
            });
        }); });
        it('should not apply field config when applyFieldConfig option is false', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                ctx.runner.getData({ withFieldConfig: false, withTransforms: true }).subscribe({
                    next: function (data) {
                        return data;
                    },
                });
                expect(applyFieldOverridesMock).not.toBeCalled();
                return [2 /*return*/];
            });
        }); });
    }, {
        getFieldOverrideOptions: function () { return ({
            fieldConfig: {
                defaults: {
                    unit: 'm/s',
                },
                // @ts-ignore
                overrides: [],
            },
            replaceVariables: function (v) { return v; },
            theme: grafanaData.createTheme(),
        }); },
        // @ts-ignore
        getTransformations: function () { return [{}]; },
    });
});
//# sourceMappingURL=PanelQueryRunner.test.js.map