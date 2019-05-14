var _this = this;
import * as tslib_1 from "tslib";
import StackdriverDataSource from '../datasource';
import { metricDescriptors } from './testData';
import moment from 'moment';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { CustomVariable } from 'app/features/templating/all';
describe('StackdriverDataSource', function () {
    var instanceSettings = {
        jsonData: {
            defaultProject: 'testproject',
        },
    };
    var templateSrv = new TemplateSrv();
    var timeSrv = {};
    describe('when performing testDataSource', function () {
        describe('and call to stackdriver api succeeds', function () {
            var ds;
            var result;
            beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                var backendSrv;
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            backendSrv = {
                                datasourceRequest: function () {
                                    return tslib_1.__awaiter(this, void 0, void 0, function () {
                                        return tslib_1.__generator(this, function (_a) {
                                            return [2 /*return*/, Promise.resolve({ status: 200 })];
                                        });
                                    });
                                },
                            };
                            ds = new StackdriverDataSource(instanceSettings, backendSrv, templateSrv, timeSrv);
                            return [4 /*yield*/, ds.testDatasource()];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should return successfully', function () {
                expect(result.status).toBe('success');
            });
        });
        describe('and a list of metricDescriptors are returned', function () {
            var ds;
            var result;
            beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                var backendSrv;
                var _this = this;
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            backendSrv = {
                                datasourceRequest: function () { return tslib_1.__awaiter(_this, void 0, void 0, function () { return tslib_1.__generator(this, function (_a) {
                                    return [2 /*return*/, Promise.resolve({ status: 200, data: metricDescriptors })];
                                }); }); },
                            };
                            ds = new StackdriverDataSource(instanceSettings, backendSrv, templateSrv, timeSrv);
                            return [4 /*yield*/, ds.testDatasource()];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should return status success', function () {
                expect(result.status).toBe('success');
            });
        });
        describe('and call to stackdriver api fails with 400 error', function () {
            var ds;
            var result;
            beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                var backendSrv;
                var _this = this;
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            backendSrv = {
                                datasourceRequest: function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                                    return tslib_1.__generator(this, function (_a) {
                                        return [2 /*return*/, Promise.reject({
                                                statusText: 'Bad Request',
                                                data: {
                                                    error: { code: 400, message: 'Field interval.endTime had an invalid value' },
                                                },
                                            })];
                                    });
                                }); },
                            };
                            ds = new StackdriverDataSource(instanceSettings, backendSrv, templateSrv, timeSrv);
                            return [4 /*yield*/, ds.testDatasource()];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should return error status and a detailed error message', function () {
                expect(result.status).toEqual('error');
                expect(result.message).toBe('Stackdriver: Bad Request: 400. Field interval.endTime had an invalid value');
            });
        });
    });
    describe('When performing query', function () {
        var options = {
            range: {
                from: moment.utc('2017-08-22T20:00:00Z'),
                to: moment.utc('2017-08-22T23:59:00Z'),
            },
            rangeRaw: {
                from: 'now-4h',
                to: 'now',
            },
            targets: [
                {
                    refId: 'A',
                },
            ],
        };
        describe('and no time series data is returned', function () {
            var ds;
            var response = {
                results: {
                    A: {
                        refId: 'A',
                        meta: {
                            rawQuery: 'arawquerystring',
                        },
                        series: null,
                        tables: null,
                    },
                },
            };
            beforeEach(function () {
                var backendSrv = {
                    datasourceRequest: function () { return tslib_1.__awaiter(_this, void 0, void 0, function () { return tslib_1.__generator(this, function (_a) {
                        return [2 /*return*/, Promise.resolve({ status: 200, data: response })];
                    }); }); },
                };
                ds = new StackdriverDataSource(instanceSettings, backendSrv, templateSrv, timeSrv);
            });
            it('should return a list of datapoints', function () {
                return ds.query(options).then(function (results) {
                    expect(results.data.length).toBe(0);
                });
            });
        });
    });
    describe('when performing getMetricTypes', function () {
        describe('and call to stackdriver api succeeds', function () { });
        var ds;
        var result;
        beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var backendSrv;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        backendSrv = {
                            datasourceRequest: function () {
                                return tslib_1.__awaiter(this, void 0, void 0, function () {
                                    return tslib_1.__generator(this, function (_a) {
                                        return [2 /*return*/, Promise.resolve({
                                                data: {
                                                    metricDescriptors: [
                                                        {
                                                            displayName: 'test metric name 1',
                                                            type: 'compute.googleapis.com/instance/cpu/test-metric-type-1',
                                                            description: 'A description',
                                                        },
                                                        {
                                                            type: 'logging.googleapis.com/user/logbased-metric-with-no-display-name',
                                                        },
                                                    ],
                                                },
                                            })];
                                    });
                                });
                            },
                        };
                        ds = new StackdriverDataSource(instanceSettings, backendSrv, templateSrv, timeSrv);
                        return [4 /*yield*/, ds.getMetricTypes()];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should return successfully', function () {
            expect(result.length).toBe(2);
            expect(result[0].service).toBe('compute.googleapis.com');
            expect(result[0].serviceShortName).toBe('compute');
            expect(result[0].type).toBe('compute.googleapis.com/instance/cpu/test-metric-type-1');
            expect(result[0].displayName).toBe('test metric name 1');
            expect(result[0].description).toBe('A description');
            expect(result[1].type).toBe('logging.googleapis.com/user/logbased-metric-with-no-display-name');
            expect(result[1].displayName).toBe('logging.googleapis.com/user/logbased-metric-with-no-display-name');
        });
    });
    describe('when interpolating a template variable for the filter', function () {
        var interpolated;
        describe('and is single value variable', function () {
            beforeEach(function () {
                var filterTemplateSrv = initTemplateSrv('filtervalue1');
                var ds = new StackdriverDataSource(instanceSettings, {}, filterTemplateSrv, timeSrv);
                interpolated = ds.interpolateFilters(['resource.label.zone', '=~', '${test}'], {});
            });
            it('should replace the variable with the value', function () {
                expect(interpolated.length).toBe(3);
                expect(interpolated[2]).toBe('filtervalue1');
            });
        });
        describe('and is multi value variable', function () {
            beforeEach(function () {
                var filterTemplateSrv = initTemplateSrv(['filtervalue1', 'filtervalue2'], true);
                var ds = new StackdriverDataSource(instanceSettings, {}, filterTemplateSrv, timeSrv);
                interpolated = ds.interpolateFilters(['resource.label.zone', '=~', '[[test]]'], {});
            });
            it('should replace the variable with a regex expression', function () {
                expect(interpolated[2]).toBe('(filtervalue1|filtervalue2)');
            });
        });
    });
    describe('when interpolating a template variable for group bys', function () {
        var interpolated;
        describe('and is single value variable', function () {
            beforeEach(function () {
                var groupByTemplateSrv = initTemplateSrv('groupby1');
                var ds = new StackdriverDataSource(instanceSettings, {}, groupByTemplateSrv, timeSrv);
                interpolated = ds.interpolateGroupBys(['[[test]]'], {});
            });
            it('should replace the variable with the value', function () {
                expect(interpolated.length).toBe(1);
                expect(interpolated[0]).toBe('groupby1');
            });
        });
        describe('and is multi value variable', function () {
            beforeEach(function () {
                var groupByTemplateSrv = initTemplateSrv(['groupby1', 'groupby2'], true);
                var ds = new StackdriverDataSource(instanceSettings, {}, groupByTemplateSrv, timeSrv);
                interpolated = ds.interpolateGroupBys(['[[test]]'], {});
            });
            it('should replace the variable with an array of group bys', function () {
                expect(interpolated.length).toBe(2);
                expect(interpolated[0]).toBe('groupby1');
                expect(interpolated[1]).toBe('groupby2');
            });
        });
    });
    describe('unit parsing', function () {
        var ds, res;
        beforeEach(function () {
            ds = new StackdriverDataSource(instanceSettings, {}, templateSrv, timeSrv);
        });
        describe('when theres only one target', function () {
            describe('and the stackdriver unit doesnt have a corresponding grafana unit', function () {
                beforeEach(function () {
                    res = ds.resolvePanelUnitFromTargets([{ unit: 'megaseconds' }]);
                });
                it('should return undefined', function () {
                    expect(res).toBeUndefined();
                });
            });
            describe('and the stackdriver unit has a corresponding grafana unit', function () {
                beforeEach(function () {
                    res = ds.resolvePanelUnitFromTargets([{ unit: 'bit' }]);
                });
                it('should return bits', function () {
                    expect(res).toEqual('bits');
                });
            });
        });
        describe('when theres more than one target', function () {
            describe('and all target units are the same', function () {
                beforeEach(function () {
                    res = ds.resolvePanelUnitFromTargets([{ unit: 'bit' }, { unit: 'bit' }]);
                });
                it('should return bits', function () {
                    expect(res).toEqual('bits');
                });
            });
            describe('and all target units are the same but doesnt have grafana mappings', function () {
                beforeEach(function () {
                    res = ds.resolvePanelUnitFromTargets([{ unit: 'megaseconds' }, { unit: 'megaseconds' }]);
                });
                it('should return the default value of undefined', function () {
                    expect(res).toBeUndefined();
                });
            });
            describe('and all target units are not the same', function () {
                beforeEach(function () {
                    res = ds.resolvePanelUnitFromTargets([{ unit: 'bit' }, { unit: 'min' }]);
                });
                it('should return the default value of undefined', function () {
                    expect(res).toBeUndefined();
                });
            });
        });
    });
});
function initTemplateSrv(values, multi) {
    if (multi === void 0) { multi = false; }
    var templateSrv = new TemplateSrv();
    templateSrv.init([
        new CustomVariable({
            name: 'test',
            current: {
                value: values,
            },
            multi: multi,
        }, {}),
    ]);
    return templateSrv;
}
//# sourceMappingURL=datasource.test.js.map