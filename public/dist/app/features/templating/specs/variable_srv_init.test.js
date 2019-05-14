import * as tslib_1 from "tslib";
import '../all';
import _ from 'lodash';
import { VariableSrv } from '../variable_srv';
import { DashboardModel } from '../../dashboard/state/DashboardModel';
import $q from 'q';
describe('VariableSrv init', function () {
    var _this = this;
    var templateSrv = {
        init: function (vars) {
            _this.variables = vars;
        },
        variableInitialized: function () { },
        updateIndex: function () { },
        replace: function (str) {
            return str.replace(_this.regex, function (match) {
                return match;
            });
        },
    };
    var timeSrv = {
        timeRange: function () {
            return { from: '2018-01-29', to: '2019-01-29' };
        },
    };
    var $injector = {};
    var ctx = {};
    function describeInitScenario(desc, fn) {
        var _this = this;
        describe(desc, function () {
            var scenario = {
                urlParams: {},
                setup: function (setupFn) {
                    scenario.setupFn = setupFn;
                },
            };
            beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            scenario.setupFn();
                            ctx = {
                                datasource: {
                                    metricFindQuery: jest.fn(function () { return Promise.resolve(scenario.queryResult); }),
                                },
                                datasourceSrv: {
                                    get: function () { return Promise.resolve(ctx.datasource); },
                                    getMetricSources: function () { return scenario.metricSources; },
                                },
                                templateSrv: templateSrv,
                            };
                            // @ts-ignore
                            ctx.variableSrv = new VariableSrv($q, {}, $injector, templateSrv, timeSrv);
                            $injector.instantiate = function (variable, model) {
                                return getVarMockConstructor(variable, model, ctx);
                            };
                            ctx.variableSrv.datasource = ctx.datasource;
                            ctx.variableSrv.datasourceSrv = ctx.datasourceSrv;
                            ctx.variableSrv.$location.search = function () { return scenario.urlParams; };
                            ctx.variableSrv.dashboard = new DashboardModel({
                                templating: { list: scenario.variables },
                            });
                            return [4 /*yield*/, ctx.variableSrv.init(ctx.variableSrv.dashboard)];
                        case 1:
                            _a.sent();
                            scenario.variables = ctx.variableSrv.variables;
                            return [2 /*return*/];
                    }
                });
            }); });
            fn(scenario);
        });
    }
    ['query', 'interval', 'custom', 'datasource'].forEach(function (type) {
        describeInitScenario('when setting ' + type + ' variable via url', function (scenario) {
            scenario.setup(function () {
                scenario.variables = [
                    {
                        name: 'apps',
                        type: type,
                        current: { text: 'Test', value: 'test' },
                        options: [{ text: 'Test', value: 'test' }],
                    },
                ];
                scenario.urlParams['var-apps'] = 'new';
                scenario.metricSources = [];
            });
            it('should update current value', function () {
                expect(scenario.variables[0].current.value).toBe('new');
                expect(scenario.variables[0].current.text).toBe('new');
            });
        });
    });
    describe('given dependent variables', function () {
        var variableList = [
            {
                name: 'app',
                type: 'query',
                query: '',
                current: { text: 'app1', value: 'app1' },
                options: [{ text: 'app1', value: 'app1' }],
            },
            {
                name: 'server',
                type: 'query',
                refresh: 1,
                query: '$app.*',
                current: { text: 'server1', value: 'server1' },
                options: [{ text: 'server1', value: 'server1' }],
            },
        ];
        describeInitScenario('when setting parent const from url', function (scenario) {
            scenario.setup(function () {
                scenario.variables = _.cloneDeep(variableList);
                scenario.urlParams['var-app'] = 'google';
                scenario.queryResult = [{ text: 'google-server1' }, { text: 'google-server2' }];
            });
            it('should update child variable', function () {
                expect(scenario.variables[1].options.length).toBe(2);
                expect(scenario.variables[1].current.text).toBe('google-server1');
            });
            it('should only update it once', function () {
                expect(ctx.variableSrv.datasource.metricFindQuery).toHaveBeenCalledTimes(1);
            });
        });
    });
    describeInitScenario('when datasource variable is initialized', function (scenario) {
        scenario.setup(function () {
            scenario.variables = [
                {
                    type: 'datasource',
                    query: 'graphite',
                    name: 'test',
                    current: { value: 'backend4_pee', text: 'backend4_pee' },
                    regex: '/pee$/',
                },
            ];
            scenario.metricSources = [
                { name: 'backend1', meta: { id: 'influx' } },
                { name: 'backend2_pee', meta: { id: 'graphite' } },
                { name: 'backend3', meta: { id: 'graphite' } },
                { name: 'backend4_pee', meta: { id: 'graphite' } },
            ];
        });
        it('should update current value', function () {
            var variable = ctx.variableSrv.variables[0];
            expect(variable.options.length).toBe(2);
        });
    });
    describeInitScenario('when template variable is present in url multiple times', function (scenario) {
        scenario.setup(function () {
            scenario.variables = [
                {
                    name: 'apps',
                    type: 'query',
                    multi: true,
                    current: { text: 'Val1', value: 'val1' },
                    options: [
                        { text: 'Val1', value: 'val1' },
                        { text: 'Val2', value: 'val2' },
                        { text: 'Val3', value: 'val3', selected: true },
                    ],
                },
            ];
            scenario.urlParams['var-apps'] = ['val2', 'val1'];
        });
        it('should update current value', function () {
            var variable = ctx.variableSrv.variables[0];
            expect(variable.current.value.length).toBe(2);
            expect(variable.current.value[0]).toBe('val2');
            expect(variable.current.value[1]).toBe('val1');
            expect(variable.current.text).toBe('Val2 + Val1');
            expect(variable.options[0].selected).toBe(true);
            expect(variable.options[1].selected).toBe(true);
        });
        it('should set options that are not in value to selected false', function () {
            var variable = ctx.variableSrv.variables[0];
            expect(variable.options[2].selected).toBe(false);
        });
    });
    describeInitScenario('when template variable is present in url multiple times and variables have no text', function (scenario) {
        scenario.setup(function () {
            scenario.variables = [
                {
                    name: 'apps',
                    type: 'query',
                    multi: true,
                },
            ];
            scenario.urlParams['var-apps'] = ['val1', 'val2'];
        });
        it('should display concatenated values in text', function () {
            var variable = ctx.variableSrv.variables[0];
            expect(variable.current.value.length).toBe(2);
            expect(variable.current.value[0]).toBe('val1');
            expect(variable.current.value[1]).toBe('val2');
            expect(variable.current.text).toBe('val1 + val2');
        });
    });
    describeInitScenario('when template variable is present in url multiple times using key/values', function (scenario) {
        scenario.setup(function () {
            scenario.variables = [
                {
                    name: 'apps',
                    type: 'query',
                    multi: true,
                    current: { text: 'Val1', value: 'val1' },
                    options: [
                        { text: 'Val1', value: 'val1' },
                        { text: 'Val2', value: 'val2' },
                        { text: 'Val3', value: 'val3', selected: true },
                    ],
                },
            ];
            scenario.urlParams['var-apps'] = ['val2', 'val1'];
        });
        it('should update current value', function () {
            var variable = ctx.variableSrv.variables[0];
            expect(variable.current.value.length).toBe(2);
            expect(variable.current.value[0]).toBe('val2');
            expect(variable.current.value[1]).toBe('val1');
            expect(variable.current.text).toBe('Val2 + Val1');
            expect(variable.options[0].selected).toBe(true);
            expect(variable.options[1].selected).toBe(true);
        });
        it('should set options that are not in value to selected false', function () {
            var variable = ctx.variableSrv.variables[0];
            expect(variable.options[2].selected).toBe(false);
        });
    });
});
function getVarMockConstructor(variable, model, ctx) {
    switch (model.model.type) {
        case 'datasource':
            return new variable(model.model, ctx.datasourceSrv, ctx.variableSrv, ctx.templateSrv);
        case 'query':
            return new variable(model.model, ctx.datasourceSrv, ctx.templateSrv, ctx.variableSrv);
        case 'interval':
            return new variable(model.model, {}, ctx.templateSrv, ctx.variableSrv);
        case 'custom':
            return new variable(model.model, ctx.variableSrv);
        default:
            return new variable(model.model);
    }
}
//# sourceMappingURL=variable_srv_init.test.js.map