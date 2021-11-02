import { __assign, __awaiter, __generator } from "tslib";
import { of, throwError } from 'rxjs';
import { toUtc } from '@grafana/data';
import CloudMonitoringDataSource from '../datasource';
import { metricDescriptors } from './testData';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { initialCustomVariableModelState } from '../../../../features/variables/custom/reducer';
import { createFetchResponse } from 'test/helpers/createFetchResponse';
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: function () { return backendSrv; } })); });
function getTestcontext(_a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.response, response = _c === void 0 ? {} : _c, _d = _b.throws, throws = _d === void 0 ? false : _d, _e = _b.templateSrv, templateSrv = _e === void 0 ? new TemplateSrv() : _e;
    jest.clearAllMocks();
    var instanceSettings = {
        jsonData: {
            defaultProject: 'testproject',
        },
    };
    var timeSrv = {};
    var fetchMock = jest.spyOn(backendSrv, 'fetch');
    throws
        ? fetchMock.mockImplementation(function () { return throwError(response); })
        : fetchMock.mockImplementation(function () { return of(createFetchResponse(response)); });
    var ds = new CloudMonitoringDataSource(instanceSettings, templateSrv, timeSrv);
    return { ds: ds };
}
describe('CloudMonitoringDataSource', function () {
    describe('when performing testDataSource', function () {
        describe('and call to cloud monitoring api succeeds', function () {
            it('should return successfully', function () { return __awaiter(void 0, void 0, void 0, function () {
                var ds, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ds = getTestcontext().ds;
                            return [4 /*yield*/, ds.testDatasource()];
                        case 1:
                            result = _a.sent();
                            expect(result.status).toBe('success');
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and a list of metricDescriptors are returned', function () {
            it('should return status success', function () { return __awaiter(void 0, void 0, void 0, function () {
                var ds, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ds = getTestcontext({ response: metricDescriptors }).ds;
                            return [4 /*yield*/, ds.testDatasource()];
                        case 1:
                            result = _a.sent();
                            expect(result.status).toBe('success');
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and call to cloud monitoring api fails with 400 error', function () {
            it('should return error status and a detailed error message', function () { return __awaiter(void 0, void 0, void 0, function () {
                var response, ds, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            response = {
                                statusText: 'Bad Request',
                                data: {
                                    error: { code: 400, message: 'Field interval.endTime had an invalid value' },
                                },
                            };
                            ds = getTestcontext({ response: response, throws: true }).ds;
                            return [4 /*yield*/, ds.testDatasource()];
                        case 1:
                            result = _a.sent();
                            expect(result.status).toEqual('error');
                            expect(result.message).toBe('Google Cloud Monitoring: Bad Request: 400. Field interval.endTime had an invalid value');
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
    describe('When performing query', function () {
        describe('and no time series data is returned', function () {
            it('should return a list of datapoints', function () { return __awaiter(void 0, void 0, void 0, function () {
                var options, response, ds;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            options = {
                                range: {
                                    from: toUtc('2017-08-22T20:00:00Z'),
                                    to: toUtc('2017-08-22T23:59:00Z'),
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
                            response = {
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
                            ds = getTestcontext({ response: response }).ds;
                            return [4 /*yield*/, expect(ds.query(options)).toEmitValuesWith(function (received) {
                                    var results = received[0];
                                    expect(results.data.length).toBe(0);
                                })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
    describe('when performing getMetricTypes', function () {
        describe('and call to cloud monitoring api succeeds', function () {
            it('should return successfully', function () { return __awaiter(void 0, void 0, void 0, function () {
                var response, ds, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            response = {
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
                            };
                            ds = getTestcontext({ response: response }).ds;
                            return [4 /*yield*/, ds.getMetricTypes('proj')];
                        case 1:
                            result = _a.sent();
                            expect(result.length).toBe(2);
                            expect(result[0].service).toBe('compute.googleapis.com');
                            expect(result[0].serviceShortName).toBe('compute');
                            expect(result[0].type).toBe('compute.googleapis.com/instance/cpu/test-metric-type-1');
                            expect(result[0].displayName).toBe('test metric name 1');
                            expect(result[0].description).toBe('A description');
                            expect(result[1].type).toBe('logging.googleapis.com/user/logbased-metric-with-no-display-name');
                            expect(result[1].displayName).toBe('logging.googleapis.com/user/logbased-metric-with-no-display-name');
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
    describe('when interpolating a template variable for the filter', function () {
        describe('and is single value variable', function () {
            it('should replace the variable with the value', function () {
                var templateSrv = initTemplateSrv('filtervalue1');
                var ds = getTestcontext({ templateSrv: templateSrv }).ds;
                var interpolated = ds.interpolateFilters(['resource.label.zone', '=~', '${test}'], {});
                expect(interpolated.length).toBe(3);
                expect(interpolated[2]).toBe('filtervalue1');
            });
        });
        describe('and is single value variable for the label part', function () {
            it('should replace the variable with the value and not with regex formatting', function () {
                var templateSrv = initTemplateSrv('resource.label.zone');
                var ds = getTestcontext({ templateSrv: templateSrv }).ds;
                var interpolated = ds.interpolateFilters(['${test}', '=~', 'europe-north-1a'], {});
                expect(interpolated.length).toBe(3);
                expect(interpolated[0]).toBe('resource.label.zone');
            });
        });
        describe('and is multi value variable', function () {
            it('should replace the variable with a regex expression', function () {
                var templateSrv = initTemplateSrv(['filtervalue1', 'filtervalue2'], true);
                var ds = getTestcontext({ templateSrv: templateSrv }).ds;
                var interpolated = ds.interpolateFilters(['resource.label.zone', '=~', '[[test]]'], {});
                expect(interpolated[2]).toBe('(filtervalue1|filtervalue2)');
            });
        });
    });
    describe('when interpolating a template variable for group bys', function () {
        describe('and is single value variable', function () {
            it('should replace the variable with the value', function () {
                var templateSrv = initTemplateSrv('groupby1');
                var ds = getTestcontext({ templateSrv: templateSrv }).ds;
                var interpolated = ds.interpolateGroupBys(['[[test]]'], {});
                expect(interpolated.length).toBe(1);
                expect(interpolated[0]).toBe('groupby1');
            });
        });
        describe('and is multi value variable', function () {
            it('should replace the variable with an array of group bys', function () {
                var templateSrv = initTemplateSrv(['groupby1', 'groupby2'], true);
                var ds = getTestcontext({ templateSrv: templateSrv }).ds;
                var interpolated = ds.interpolateGroupBys(['[[test]]'], {});
                expect(interpolated.length).toBe(2);
                expect(interpolated[0]).toBe('groupby1');
                expect(interpolated[1]).toBe('groupby2');
            });
        });
    });
});
function initTemplateSrv(values, multi) {
    if (multi === void 0) { multi = false; }
    var templateSrv = new TemplateSrv();
    var test = __assign(__assign({}, initialCustomVariableModelState), { id: 'test', name: 'test', current: { value: values, text: Array.isArray(values) ? values.toString() : values, selected: true }, options: [{ value: values, text: Array.isArray(values) ? values.toString() : values, selected: false }], multi: multi });
    templateSrv.init([test]);
    return templateSrv;
}
//# sourceMappingURL=datasource.test.js.map