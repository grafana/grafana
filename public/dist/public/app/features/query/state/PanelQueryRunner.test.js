import { __awaiter } from "tslib";
const applyFieldOverridesMock = jest.fn(); // needs to be first in this file
import { Subject } from 'rxjs';
// Importing this way to be able to spy on grafana/data
import * as grafanaData from '@grafana/data';
import { setDataSourceSrv, setEchoSrv } from '@grafana/runtime';
import { TemplateSrvMock } from 'app/features/templating/template_srv.mock';
import { Echo } from '../../../core/services/echo/Echo';
import { createDashboardModelFixture } from '../../dashboard/state/__fixtures__/dashboardFixtures';
import { createDashboardQueryRunner, setDashboardQueryRunnerFactory, } from './DashboardQueryRunner/DashboardQueryRunner';
import { emptyResult } from './DashboardQueryRunner/utils';
import { PanelQueryRunner } from './PanelQueryRunner';
jest.mock('@grafana/data', () => (Object.assign(Object.assign({ __esModule: true }, jest.requireActual('@grafana/data')), { applyFieldOverrides: applyFieldOverridesMock })));
jest.mock('app/core/services/backend_srv');
jest.mock('app/core/config', () => ({
    config: { featureToggles: { transformations: true } },
    getConfig: () => ({
        featureToggles: {},
    }),
}));
const dashboardModel = createDashboardModelFixture({
    panels: [{ id: 1, type: 'graph' }],
});
jest.mock('app/features/dashboard/services/DashboardSrv', () => ({
    getDashboardSrv: () => {
        return {
            getCurrent: () => dashboardModel,
        };
    },
}));
jest.mock('app/features/templating/template_srv', () => ({
    getTemplateSrv: () => new TemplateSrvMock({}),
}));
const defaultPanelConfig = {
    getFieldOverrideOptions: () => undefined,
    getTransformations: () => undefined,
    getDataSupport: () => ({ annotations: false, alertStates: false }),
};
function describeQueryRunnerScenario(description, scenarioFn, panelConfig) {
    describe(description, () => {
        let setupFn = () => { };
        const ctx = {
            maxDataPoints: 200,
            scopedVars: {
                server: { text: 'Server1', value: 'server-1' },
            },
            runner: new PanelQueryRunner(panelConfig || defaultPanelConfig),
            setup: (fn) => {
                setupFn = fn;
            },
        };
        const response = {
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
        setDashboardQueryRunnerFactory(() => ({
            getResult: emptyResult,
            run: () => undefined,
            cancel: () => undefined,
            cancellations: () => new Subject(),
            destroy: () => undefined,
        }));
        createDashboardQueryRunner({});
        beforeEach(() => __awaiter(this, void 0, void 0, function* () {
            var _a;
            setEchoSrv(new Echo());
            setupFn();
            const datasource = {
                name: 'TestDB',
                uid: 'TestDB-uid',
                interval: ctx.dsInterval,
                query: (options) => {
                    ctx.queryCalledWith = options;
                    return Promise.resolve(response);
                },
                getRef: () => ({ type: 'test', uid: 'TestDB-uid' }),
                testDatasource: jest.fn(),
            };
            const args = {
                datasource,
                scopedVars: ctx.scopedVars,
                minInterval: ctx.minInterval,
                maxDataPoints: (_a = ctx.maxDataPoints) !== null && _a !== void 0 ? _a : Infinity,
                timeRange: {
                    from: grafanaData.dateTime().subtract(1, 'days'),
                    to: grafanaData.dateTime(),
                    raw: { from: '1d', to: 'now' },
                },
                panelId: 1,
                queries: [{ refId: 'A' }],
            };
            ctx.runner = new PanelQueryRunner(panelConfig || defaultPanelConfig);
            ctx.runner.getData({ withTransforms: true, withFieldConfig: true }).subscribe({
                next: (data) => {
                    var _a;
                    ctx.res = data;
                    (_a = ctx.events) === null || _a === void 0 ? void 0 : _a.push(data);
                },
            });
            ctx.events = [];
            ctx.runner.run(args);
        }));
        scenarioFn(ctx);
    });
}
describe('PanelQueryRunner', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describeQueryRunnerScenario('simple scenario', (ctx) => {
        it('should set requestId on request', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            expect((_a = ctx.queryCalledWith) === null || _a === void 0 ? void 0 : _a.requestId).toBe('Q100');
        }));
        it('should set datasource uid on request', () => __awaiter(void 0, void 0, void 0, function* () {
            var _b, _c;
            expect((_c = (_b = ctx.queryCalledWith) === null || _b === void 0 ? void 0 : _b.targets[0].datasource) === null || _c === void 0 ? void 0 : _c.uid).toBe('TestDB-uid');
        }));
        it('should pass scopedVars to datasource with interval props', () => __awaiter(void 0, void 0, void 0, function* () {
            var _d, _e, _f;
            expect((_d = ctx.queryCalledWith) === null || _d === void 0 ? void 0 : _d.scopedVars.server.text).toBe('Server1');
            expect((_e = ctx.queryCalledWith) === null || _e === void 0 ? void 0 : _e.scopedVars.__interval.text).toBe('5m');
            expect((_f = ctx.queryCalledWith) === null || _f === void 0 ? void 0 : _f.scopedVars.__interval_ms.text).toBe('300000');
        }));
    });
    describeQueryRunnerScenario('with maxDataPoints', (ctx) => {
        ctx.setup(() => {
            ctx.maxDataPoints = 200;
        });
        it('should return data', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b;
            expect((_a = ctx.res) === null || _a === void 0 ? void 0 : _a.error).toBeUndefined();
            expect((_b = ctx.res) === null || _b === void 0 ? void 0 : _b.series.length).toBe(1);
        }));
        it('should use widthPixels as maxDataPoints', () => __awaiter(void 0, void 0, void 0, function* () {
            var _c;
            expect((_c = ctx.queryCalledWith) === null || _c === void 0 ? void 0 : _c.maxDataPoints).toBe(200);
        }));
        it('should calculate interval based on width', () => __awaiter(void 0, void 0, void 0, function* () {
            var _d;
            expect((_d = ctx.queryCalledWith) === null || _d === void 0 ? void 0 : _d.interval).toBe('5m');
        }));
        it('fast query should only publish 1 data events', () => __awaiter(void 0, void 0, void 0, function* () {
            var _e;
            expect((_e = ctx.events) === null || _e === void 0 ? void 0 : _e.length).toBe(1);
        }));
    });
    describeQueryRunnerScenario('with no panel min interval but datasource min interval', (ctx) => {
        ctx.setup(() => {
            ctx.maxDataPoints = 20000;
            ctx.dsInterval = '15s';
        });
        it('should limit interval to data source min interval', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            expect((_a = ctx.queryCalledWith) === null || _a === void 0 ? void 0 : _a.interval).toBe('15s');
        }));
    });
    describeQueryRunnerScenario('with panel min interval and data source min interval', (ctx) => {
        ctx.setup(() => {
            ctx.maxDataPoints = 20000;
            ctx.dsInterval = '15s';
            ctx.minInterval = '30s';
        });
        it('should limit interval to panel min interval', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            expect((_a = ctx.queryCalledWith) === null || _a === void 0 ? void 0 : _a.interval).toBe('30s');
        }));
    });
    describeQueryRunnerScenario('with maxDataPoints', (ctx) => {
        ctx.setup(() => {
            ctx.maxDataPoints = 10;
        });
        it('should pass maxDataPoints if specified', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            expect((_a = ctx.queryCalledWith) === null || _a === void 0 ? void 0 : _a.maxDataPoints).toBe(10);
        }));
        it('should use instead of width to calculate interval', () => __awaiter(void 0, void 0, void 0, function* () {
            var _b;
            expect((_b = ctx.queryCalledWith) === null || _b === void 0 ? void 0 : _b.interval).toBe('2h');
        }));
    });
    describeQueryRunnerScenario('field overrides', (ctx) => {
        it('should apply when field override options are set', () => __awaiter(void 0, void 0, void 0, function* () {
            ctx.runner.getData({ withTransforms: true, withFieldConfig: true }).subscribe({
                next: (data) => {
                    return data;
                },
            });
            expect(applyFieldOverridesMock).toBeCalled();
        }));
    }, {
        getFieldOverrideOptions: () => ({
            fieldConfig: {
                defaults: {
                    unit: 'm/s',
                },
                // @ts-ignore
                overrides: [],
            },
            replaceVariables: (v) => v,
            theme: grafanaData.createTheme(),
        }),
        getTransformations: () => undefined,
        getDataSupport: () => ({ annotations: false, alertStates: false }),
    });
    describeQueryRunnerScenario('transformations', (ctx) => {
        it('should apply when transformations are set', () => __awaiter(void 0, void 0, void 0, function* () {
            const spy = jest.spyOn(grafanaData, 'transformDataFrame');
            spy.mockClear();
            ctx.runner.getData({ withTransforms: true, withFieldConfig: true }).subscribe({
                next: (data) => {
                    return data;
                },
            });
            expect(spy).toBeCalled();
        }));
    }, {
        getFieldOverrideOptions: () => undefined,
        // @ts-ignore
        getTransformations: () => [{}],
        getDataSupport: () => ({ annotations: false, alertStates: false }),
    });
    describeQueryRunnerScenario('getData', (ctx) => {
        it('should not apply transformations when transform option is false', () => __awaiter(void 0, void 0, void 0, function* () {
            const spy = jest.spyOn(grafanaData, 'transformDataFrame');
            spy.mockClear();
            ctx.runner.getData({ withTransforms: false, withFieldConfig: true }).subscribe({
                next: (data) => {
                    return data;
                },
            });
            expect(spy).not.toBeCalled();
        }));
        it('should not apply field config when applyFieldConfig option is false', () => __awaiter(void 0, void 0, void 0, function* () {
            ctx.runner.getData({ withFieldConfig: false, withTransforms: true }).subscribe({
                next: (data) => {
                    return data;
                },
            });
            expect(applyFieldOverridesMock).not.toBeCalled();
        }));
    }, {
        getFieldOverrideOptions: () => ({
            fieldConfig: {
                defaults: {
                    unit: 'm/s',
                },
                // @ts-ignore
                overrides: [],
            },
            replaceVariables: (v) => v,
            theme: grafanaData.createTheme(),
        }),
        // @ts-ignore
        getTransformations: () => [{}],
        getDataSupport: () => ({ annotations: false, alertStates: false }),
    });
    describeQueryRunnerScenario('getData', (ctx) => {
        it('should not apply transformations when transform option is false', () => __awaiter(void 0, void 0, void 0, function* () {
            const spy = jest.spyOn(grafanaData, 'transformDataFrame');
            spy.mockClear();
            ctx.runner.getData({ withTransforms: false, withFieldConfig: true }).subscribe({
                next: (data) => {
                    return data;
                },
            });
            expect(spy).not.toBeCalled();
        }));
        it('should not apply field config when applyFieldConfig option is false', () => __awaiter(void 0, void 0, void 0, function* () {
            ctx.runner.getData({ withFieldConfig: false, withTransforms: true }).subscribe({
                next: (data) => {
                    return data;
                },
            });
            expect(applyFieldOverridesMock).not.toBeCalled();
        }));
    }, {
        getFieldOverrideOptions: () => ({
            fieldConfig: {
                defaults: {
                    unit: 'm/s',
                },
                // @ts-ignore
                overrides: [],
            },
            replaceVariables: (v) => v,
            theme: grafanaData.createTheme(),
        }),
        // @ts-ignore
        getTransformations: () => [{}],
        getDataSupport: () => ({ annotations: false, alertStates: false }),
    });
    const snapshotData = [
        {
            fields: [
                { name: 'time', type: grafanaData.FieldType.time, values: [1000] },
                { name: 'value', type: grafanaData.FieldType.number, values: [1] },
            ],
        },
    ];
    describeQueryRunnerScenario('getData with snapshot data', (ctx) => {
        it('should return snapshotted data', () => __awaiter(void 0, void 0, void 0, function* () {
            ctx.runner.getData({ withTransforms: false, withFieldConfig: true }).subscribe({
                next: (data) => {
                    expect(data.state).toBe(grafanaData.LoadingState.Done);
                    expect(data.series).toEqual(snapshotData);
                    expect(data.timeRange).toEqual(grafanaData.getDefaultTimeRange());
                    return data;
                },
            });
        }));
    }, Object.assign(Object.assign({}, defaultPanelConfig), { snapshotData }));
});
//# sourceMappingURL=PanelQueryRunner.test.js.map