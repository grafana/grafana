import * as tslib_1 from "tslib";
import '../all';
import { VariableSrv } from '../variable_srv';
import { DashboardModel } from '../../dashboard/state/DashboardModel';
import moment from 'moment';
import $q from 'q';
describe('VariableSrv', function () {
    var _this = this;
    var ctx = {
        datasourceSrv: {},
        timeSrv: {
            timeRange: function () {
                return { from: '2018-01-29', to: '2019-01-29' };
            },
        },
        $rootScope: {
            $on: function () { },
        },
        $injector: {
            instantiate: function (ctr, obj) { return new ctr(obj.model); },
        },
        templateSrv: {
            setGrafanaVariable: jest.fn(),
            init: function (vars) {
                _this.variables = vars;
            },
            updateIndex: function () { },
            replace: function (str) {
                return str.replace(_this.regex, function (match) {
                    return match;
                });
            },
        },
        $location: {
            search: function () { },
        },
    };
    function describeUpdateVariable(desc, fn) {
        var _this = this;
        describe(desc, function () {
            var scenario = {};
            scenario.setup = function (setupFn) {
                scenario.setupFn = setupFn;
            };
            beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                var ds;
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            scenario.setupFn();
                            ds = {};
                            ds.metricFindQuery = function () { return Promise.resolve(scenario.queryResult); };
                            ctx.variableSrv = new VariableSrv($q, ctx.$location, ctx.$injector, ctx.templateSrv, ctx.timeSrv);
                            ctx.variableSrv.timeSrv = ctx.timeSrv;
                            ctx.datasourceSrv = {
                                get: function () { return Promise.resolve(ds); },
                                getMetricSources: function () { return scenario.metricSources; },
                            };
                            ctx.$injector.instantiate = function (ctr, model) {
                                return getVarMockConstructor(ctr, model, ctx);
                            };
                            ctx.variableSrv.init(new DashboardModel({
                                templating: { list: [] },
                                updateSubmenuVisibility: function () { },
                            }));
                            scenario.variable = ctx.variableSrv.createVariableFromModel(scenario.variableModel);
                            ctx.variableSrv.addVariable(scenario.variable);
                            return [4 /*yield*/, ctx.variableSrv.updateOptions(scenario.variable)];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            fn(scenario);
        });
    }
    describeUpdateVariable('interval variable without auto', function (scenario) {
        scenario.setup(function () {
            scenario.variableModel = {
                type: 'interval',
                query: '1s,2h,5h,1d',
                name: 'test',
            };
        });
        it('should update options array', function () {
            expect(scenario.variable.options.length).toBe(4);
            expect(scenario.variable.options[0].text).toBe('1s');
            expect(scenario.variable.options[0].value).toBe('1s');
        });
    });
    //
    // Interval variable update
    //
    describeUpdateVariable('interval variable with auto', function (scenario) {
        scenario.setup(function () {
            scenario.variableModel = {
                type: 'interval',
                query: '1s,2h,5h,1d',
                name: 'test',
                auto: true,
                auto_count: 10,
            };
            var range = {
                from: moment(new Date())
                    .subtract(7, 'days')
                    .toDate(),
                to: new Date(),
            };
            ctx.timeSrv.timeRange = function () { return range; };
            //   ctx.templateSrv.setGrafanaVariable = jest.fn();
        });
        it('should update options array', function () {
            expect(scenario.variable.options.length).toBe(5);
            expect(scenario.variable.options[0].text).toBe('auto');
            expect(scenario.variable.options[0].value).toBe('$__auto_interval_test');
        });
        it('should set $__auto_interval_test', function () {
            var call = ctx.templateSrv.setGrafanaVariable.mock.calls[0];
            expect(call[0]).toBe('$__auto_interval_test');
            expect(call[1]).toBe('12h');
        });
        // updateAutoValue() gets called twice: once directly once via VariableSrv.validateVariableSelectionState()
        // So use lastCall instead of a specific call number
        it('should set $__auto_interval', function () {
            var call = ctx.templateSrv.setGrafanaVariable.mock.calls.pop();
            expect(call[0]).toBe('$__auto_interval');
            expect(call[1]).toBe('12h');
        });
    });
    //
    // Query variable update
    //
    describeUpdateVariable('query variable with empty current object and refresh', function (scenario) {
        scenario.setup(function () {
            scenario.variableModel = {
                type: 'query',
                query: '',
                name: 'test',
                current: {},
            };
            scenario.queryResult = [{ text: 'backend1' }, { text: 'backend2' }];
        });
        it('should set current value to first option', function () {
            expect(scenario.variable.options.length).toBe(2);
            expect(scenario.variable.current.value).toBe('backend1');
        });
    });
    describeUpdateVariable('query variable with multi select and new options does not contain some selected values', function (scenario) {
        scenario.setup(function () {
            scenario.variableModel = {
                type: 'query',
                query: '',
                name: 'test',
                current: {
                    value: ['val1', 'val2', 'val3'],
                    text: 'val1 + val2 + val3',
                },
            };
            scenario.queryResult = [{ text: 'val2' }, { text: 'val3' }];
        });
        it('should update current value', function () {
            expect(scenario.variable.current.value).toEqual(['val2', 'val3']);
            expect(scenario.variable.current.text).toEqual('val2 + val3');
        });
    });
    describeUpdateVariable('query variable with multi select and new options does not contain any selected values', function (scenario) {
        scenario.setup(function () {
            scenario.variableModel = {
                type: 'query',
                query: '',
                name: 'test',
                current: {
                    value: ['val1', 'val2', 'val3'],
                    text: 'val1 + val2 + val3',
                },
            };
            scenario.queryResult = [{ text: 'val5' }, { text: 'val6' }];
        });
        it('should update current value with first one', function () {
            expect(scenario.variable.current.value).toEqual('val5');
            expect(scenario.variable.current.text).toEqual('val5');
        });
    });
    describeUpdateVariable('query variable with multi select and $__all selected', function (scenario) {
        scenario.setup(function () {
            scenario.variableModel = {
                type: 'query',
                query: '',
                name: 'test',
                includeAll: true,
                current: {
                    value: ['$__all'],
                    text: 'All',
                },
            };
            scenario.queryResult = [{ text: 'val5' }, { text: 'val6' }];
        });
        it('should keep current All value', function () {
            expect(scenario.variable.current.value).toEqual(['$__all']);
            expect(scenario.variable.current.text).toEqual('All');
        });
    });
    describeUpdateVariable('query variable with numeric results', function (scenario) {
        scenario.setup(function () {
            scenario.variableModel = {
                type: 'query',
                query: '',
                name: 'test',
                current: {},
            };
            scenario.queryResult = [{ text: 12, value: 12 }];
        });
        it('should set current value to first option', function () {
            expect(scenario.variable.current.value).toBe('12');
            expect(scenario.variable.options[0].value).toBe('12');
            expect(scenario.variable.options[0].text).toBe('12');
        });
    });
    describeUpdateVariable('basic query variable', function (scenario) {
        scenario.setup(function () {
            scenario.variableModel = { type: 'query', query: 'apps.*', name: 'test' };
            scenario.queryResult = [{ text: 'backend1' }, { text: 'backend2' }];
        });
        it('should update options array', function () {
            expect(scenario.variable.options.length).toBe(2);
            expect(scenario.variable.options[0].text).toBe('backend1');
            expect(scenario.variable.options[0].value).toBe('backend1');
            expect(scenario.variable.options[1].value).toBe('backend2');
        });
        it('should select first option as value', function () {
            expect(scenario.variable.current.value).toBe('backend1');
        });
    });
    describeUpdateVariable('and existing value still exists in options', function (scenario) {
        scenario.setup(function () {
            scenario.variableModel = { type: 'query', query: 'apps.*', name: 'test' };
            scenario.variableModel.current = { value: 'backend2', text: 'backend2' };
            scenario.queryResult = [{ text: 'backend1' }, { text: 'backend2' }];
        });
        it('should keep variable value', function () {
            expect(scenario.variable.current.text).toBe('backend2');
        });
    });
    describeUpdateVariable('and regex pattern exists', function (scenario) {
        scenario.setup(function () {
            scenario.variableModel = { type: 'query', query: 'apps.*', name: 'test' };
            scenario.variableModel.regex = '/apps.*(backend_[0-9]+)/';
            scenario.queryResult = [
                { text: 'apps.backend.backend_01.counters.req' },
                { text: 'apps.backend.backend_02.counters.req' },
            ];
        });
        it('should extract and use match group', function () {
            expect(scenario.variable.options[0].value).toBe('backend_01');
        });
    });
    describeUpdateVariable('and regex pattern exists and no match', function (scenario) {
        scenario.setup(function () {
            scenario.variableModel = { type: 'query', query: 'apps.*', name: 'test' };
            scenario.variableModel.regex = '/apps.*(backendasd[0-9]+)/';
            scenario.queryResult = [
                { text: 'apps.backend.backend_01.counters.req' },
                { text: 'apps.backend.backend_02.counters.req' },
            ];
        });
        it('should not add non matching items, None option should be added instead', function () {
            expect(scenario.variable.options.length).toBe(1);
            expect(scenario.variable.options[0].isNone).toBe(true);
        });
    });
    describeUpdateVariable('regex pattern without slashes', function (scenario) {
        scenario.setup(function () {
            scenario.variableModel = { type: 'query', query: 'apps.*', name: 'test' };
            scenario.variableModel.regex = 'backend_01';
            scenario.queryResult = [
                { text: 'apps.backend.backend_01.counters.req' },
                { text: 'apps.backend.backend_02.counters.req' },
            ];
        });
        it('should return matches options', function () {
            expect(scenario.variable.options.length).toBe(1);
        });
    });
    describeUpdateVariable('regex pattern remove duplicates', function (scenario) {
        scenario.setup(function () {
            scenario.variableModel = { type: 'query', query: 'apps.*', name: 'test' };
            scenario.variableModel.regex = '/backend_01/';
            scenario.queryResult = [
                { text: 'apps.backend.backend_01.counters.req' },
                { text: 'apps.backend.backend_01.counters.req' },
            ];
        });
        it('should return matches options', function () {
            expect(scenario.variable.options.length).toBe(1);
        });
    });
    describeUpdateVariable('with include All', function (scenario) {
        scenario.setup(function () {
            scenario.variableModel = {
                type: 'query',
                query: 'apps.*',
                name: 'test',
                includeAll: true,
            };
            scenario.queryResult = [{ text: 'backend1' }, { text: 'backend2' }, { text: 'backend3' }];
        });
        it('should add All option', function () {
            expect(scenario.variable.options[0].text).toBe('All');
            expect(scenario.variable.options[0].value).toBe('$__all');
        });
    });
    describeUpdateVariable('with include all and custom value', function (scenario) {
        scenario.setup(function () {
            scenario.variableModel = {
                type: 'query',
                query: 'apps.*',
                name: 'test',
                includeAll: true,
                allValue: '*',
            };
            scenario.queryResult = [{ text: 'backend1' }, { text: 'backend2' }, { text: 'backend3' }];
        });
        it('should add All option with custom value', function () {
            expect(scenario.variable.options[0].value).toBe('$__all');
        });
    });
    describeUpdateVariable('without sort', function (scenario) {
        scenario.setup(function () {
            scenario.variableModel = {
                type: 'query',
                query: 'apps.*',
                name: 'test',
                sort: 0,
            };
            scenario.queryResult = [{ text: 'bbb2' }, { text: 'aaa10' }, { text: 'ccc3' }];
        });
        it('should return options without sort', function () {
            expect(scenario.variable.options[0].text).toBe('bbb2');
            expect(scenario.variable.options[1].text).toBe('aaa10');
            expect(scenario.variable.options[2].text).toBe('ccc3');
        });
    });
    describeUpdateVariable('with alphabetical sort (asc)', function (scenario) {
        scenario.setup(function () {
            scenario.variableModel = {
                type: 'query',
                query: 'apps.*',
                name: 'test',
                sort: 1,
            };
            scenario.queryResult = [{ text: 'bbb2' }, { text: 'aaa10' }, { text: 'ccc3' }];
        });
        it('should return options with alphabetical sort', function () {
            expect(scenario.variable.options[0].text).toBe('aaa10');
            expect(scenario.variable.options[1].text).toBe('bbb2');
            expect(scenario.variable.options[2].text).toBe('ccc3');
        });
    });
    describeUpdateVariable('with alphabetical sort (desc)', function (scenario) {
        scenario.setup(function () {
            scenario.variableModel = {
                type: 'query',
                query: 'apps.*',
                name: 'test',
                sort: 2,
            };
            scenario.queryResult = [{ text: 'bbb2' }, { text: 'aaa10' }, { text: 'ccc3' }];
        });
        it('should return options with alphabetical sort', function () {
            expect(scenario.variable.options[0].text).toBe('ccc3');
            expect(scenario.variable.options[1].text).toBe('bbb2');
            expect(scenario.variable.options[2].text).toBe('aaa10');
        });
    });
    describeUpdateVariable('with numerical sort (asc)', function (scenario) {
        scenario.setup(function () {
            scenario.variableModel = {
                type: 'query',
                query: 'apps.*',
                name: 'test',
                sort: 3,
            };
            scenario.queryResult = [{ text: 'bbb2' }, { text: 'aaa10' }, { text: 'ccc3' }];
        });
        it('should return options with numerical sort', function () {
            expect(scenario.variable.options[0].text).toBe('bbb2');
            expect(scenario.variable.options[1].text).toBe('ccc3');
            expect(scenario.variable.options[2].text).toBe('aaa10');
        });
    });
    describeUpdateVariable('with numerical sort (desc)', function (scenario) {
        scenario.setup(function () {
            scenario.variableModel = {
                type: 'query',
                query: 'apps.*',
                name: 'test',
                sort: 4,
            };
            scenario.queryResult = [{ text: 'bbb2' }, { text: 'aaa10' }, { text: 'ccc3' }];
        });
        it('should return options with numerical sort', function () {
            expect(scenario.variable.options[0].text).toBe('aaa10');
            expect(scenario.variable.options[1].text).toBe('ccc3');
            expect(scenario.variable.options[2].text).toBe('bbb2');
        });
    });
    //
    // datasource variable update
    //
    describeUpdateVariable('datasource variable with regex filter', function (scenario) {
        scenario.setup(function () {
            scenario.variableModel = {
                type: 'datasource',
                query: 'graphite',
                name: 'test',
                current: { value: 'backend4_pee', text: 'backend4_pee' },
                regex: '/pee$/',
            };
            scenario.metricSources = [
                { name: 'backend1', meta: { id: 'influx' } },
                { name: 'backend2_pee', meta: { id: 'graphite' } },
                { name: 'backend3', meta: { id: 'graphite' } },
                { name: 'backend4_pee', meta: { id: 'graphite' } },
            ];
        });
        it('should set only contain graphite ds and filtered using regex', function () {
            expect(scenario.variable.options.length).toBe(2);
            expect(scenario.variable.options[0].value).toBe('backend2_pee');
            expect(scenario.variable.options[1].value).toBe('backend4_pee');
        });
        it('should keep current value if available', function () {
            expect(scenario.variable.current.value).toBe('backend4_pee');
        });
    });
    //
    // Custom variable update
    //
    describeUpdateVariable('update custom variable', function (scenario) {
        scenario.setup(function () {
            scenario.variableModel = {
                type: 'custom',
                query: 'hej, hop, asd, escaped\\,var',
                name: 'test',
            };
        });
        it('should update options array', function () {
            expect(scenario.variable.options.length).toBe(4);
            expect(scenario.variable.options[0].text).toBe('hej');
            expect(scenario.variable.options[1].value).toBe('hop');
            expect(scenario.variable.options[2].value).toBe('asd');
            expect(scenario.variable.options[3].value).toBe('escaped,var');
        });
    });
    describe('multiple interval variables with auto', function () {
        var variable1, variable2;
        beforeEach(function () {
            var range = {
                from: moment(new Date())
                    .subtract(7, 'days')
                    .toDate(),
                to: new Date(),
            };
            ctx.timeSrv.timeRange = function () { return range; };
            ctx.templateSrv.setGrafanaVariable = jest.fn();
            var variableModel1 = {
                type: 'interval',
                query: '1s,2h,5h,1d',
                name: 'variable1',
                auto: true,
                auto_count: 10,
            };
            variable1 = ctx.variableSrv.createVariableFromModel(variableModel1);
            ctx.variableSrv.addVariable(variable1);
            var variableModel2 = {
                type: 'interval',
                query: '1s,2h,5h',
                name: 'variable2',
                auto: true,
                auto_count: 1000,
            };
            variable2 = ctx.variableSrv.createVariableFromModel(variableModel2);
            ctx.variableSrv.addVariable(variable2);
            ctx.variableSrv.updateOptions(variable1);
            ctx.variableSrv.updateOptions(variable2);
            // ctx.$rootScope.$digest();
        });
        it('should update options array', function () {
            expect(variable1.options.length).toBe(5);
            expect(variable1.options[0].text).toBe('auto');
            expect(variable1.options[0].value).toBe('$__auto_interval_variable1');
            expect(variable2.options.length).toBe(4);
            expect(variable2.options[0].text).toBe('auto');
            expect(variable2.options[0].value).toBe('$__auto_interval_variable2');
        });
        it('should correctly set $__auto_interval_variableX', function () {
            var variable1Set, variable2Set, legacySet, unknownSet = false;
            // updateAutoValue() gets called repeatedly: once directly once via VariableSrv.validateVariableSelectionState()
            // So check that all calls are valid rather than expect a specific number and/or ordering of calls
            for (var i = 0; i < ctx.templateSrv.setGrafanaVariable.mock.calls.length; i++) {
                var call = ctx.templateSrv.setGrafanaVariable.mock.calls[i];
                switch (call[0]) {
                    case '$__auto_interval_variable1':
                        expect(call[1]).toBe('12h');
                        variable1Set = true;
                        break;
                    case '$__auto_interval_variable2':
                        expect(call[1]).toBe('10m');
                        variable2Set = true;
                        break;
                    case '$__auto_interval':
                        expect(call[1]).toEqual(expect.stringMatching(/^(12h|10m)$/));
                        legacySet = true;
                        break;
                    default:
                        unknownSet = true;
                        break;
                }
            }
            expect(variable1Set).toEqual(true);
            expect(variable2Set).toEqual(true);
            expect(legacySet).toEqual(true);
            expect(unknownSet).toEqual(false);
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
            return new variable(model.model, ctx.timeSrv, ctx.templateSrv, ctx.variableSrv);
        case 'custom':
            return new variable(model.model, ctx.variableSrv);
        default:
            return new variable(model.model);
    }
}
//# sourceMappingURL=variable_srv.test.js.map