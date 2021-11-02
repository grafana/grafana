import { __assign, __awaiter, __generator } from "tslib";
import { lastValueFrom, of, throwError } from 'rxjs';
import { take } from 'rxjs/operators';
import { CoreApp, dateTime, FieldCache, toUtc, MutableDataFrame, FieldType, } from '@grafana/data';
import LokiDatasource from './datasource';
import { LokiResultType } from './types';
import { getQueryOptions } from 'test/helpers/getQueryOptions';
import { backendSrv } from 'app/core/services/backend_srv';
import { initialCustomVariableModelState } from '../../../features/variables/custom/reducer';
import { makeMockLokiDatasource } from './mocks';
import { createFetchResponse } from 'test/helpers/createFetchResponse';
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: function () { return backendSrv; } })); });
var rawRange = {
    from: toUtc('2018-04-25 10:00'),
    to: toUtc('2018-04-25 11:00'),
};
var timeSrvStub = {
    timeRange: function () { return ({
        from: rawRange.from,
        to: rawRange.to,
        raw: rawRange,
    }); },
};
var templateSrvStub = {
    getAdhocFilters: jest.fn(function () { return []; }),
    replace: jest.fn(function (a) {
        var rest = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            rest[_i - 1] = arguments[_i];
        }
        return a;
    }),
};
var testLogsResponse = {
    data: {
        data: {
            resultType: LokiResultType.Stream,
            result: [
                {
                    stream: {},
                    values: [['1573646419522934000', 'hello']],
                },
            ],
        },
        status: 'success',
    },
    ok: true,
    headers: {},
    redirected: false,
    status: 200,
    statusText: 'Success',
    type: 'default',
    url: '',
    config: {},
};
var testMetricsResponse = {
    data: {
        data: {
            resultType: LokiResultType.Matrix,
            result: [
                {
                    metric: {},
                    values: [[1605715380, '1.1']],
                },
            ],
        },
        status: 'success',
    },
    ok: true,
    headers: {},
    redirected: false,
    status: 200,
    statusText: 'OK',
    type: 'basic',
    url: '',
    config: {},
};
describe('LokiDatasource', function () {
    var fetchMock = jest.spyOn(backendSrv, 'fetch');
    beforeEach(function () {
        jest.clearAllMocks();
        fetchMock.mockImplementation(function () { return of(createFetchResponse({})); });
    });
    describe('when creating range query', function () {
        var ds;
        var adjustIntervalSpy;
        beforeEach(function () {
            ds = createLokiDSForTests();
            adjustIntervalSpy = jest.spyOn(ds, 'adjustInterval');
        });
        it('should use default intervalMs if one is not provided', function () {
            var target = { expr: '{job="grafana"}', refId: 'B' };
            var raw = { from: 'now', to: 'now-1h' };
            var range = { from: dateTime(), to: dateTime(), raw: raw };
            var options = {
                range: range,
            };
            var req = ds.createRangeQuery(target, options, 1000);
            expect(req.start).toBeDefined();
            expect(req.end).toBeDefined();
            expect(adjustIntervalSpy).toHaveBeenCalledWith(1000, 1, expect.anything());
        });
        it('should use provided intervalMs', function () {
            var target = { expr: '{job="grafana"}', refId: 'B' };
            var raw = { from: 'now', to: 'now-1h' };
            var range = { from: dateTime(), to: dateTime(), raw: raw };
            var options = {
                range: range,
                intervalMs: 2000,
            };
            var req = ds.createRangeQuery(target, options, 1000);
            expect(req.start).toBeDefined();
            expect(req.end).toBeDefined();
            expect(adjustIntervalSpy).toHaveBeenCalledWith(2000, 1, expect.anything());
        });
        it('should set the minimal step to 1ms', function () {
            var target = { expr: '{job="grafana"}', refId: 'B' };
            var raw = { from: 'now', to: 'now-1h' };
            var range = { from: dateTime('2020-10-14T00:00:00'), to: dateTime('2020-10-14T00:00:01'), raw: raw };
            var options = {
                range: range,
                intervalMs: 0.0005,
            };
            var req = ds.createRangeQuery(target, options, 1000);
            expect(req.start).toBeDefined();
            expect(req.end).toBeDefined();
            expect(adjustIntervalSpy).toHaveBeenCalledWith(0.0005, expect.anything(), 1000);
            // Step is in seconds (1 ms === 0.001 s)
            expect(req.step).toEqual(0.001);
        });
    });
    describe('when doing logs queries with limits', function () {
        var runLimitTest = function (_a) {
            var _b = _a.maxDataPoints, maxDataPoints = _b === void 0 ? 123 : _b, queryMaxLines = _a.queryMaxLines, _c = _a.dsMaxLines, dsMaxLines = _c === void 0 ? 456 : _c, expectedLimit = _a.expectedLimit, _d = _a.expr, expr = _d === void 0 ? '{label="val"}' : _d;
            return __awaiter(void 0, void 0, void 0, function () {
                var settings, templateSrvMock, ds, options;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            settings = {
                                url: 'myloggingurl',
                                jsonData: {
                                    maxLines: dsMaxLines,
                                },
                            };
                            templateSrvMock = {
                                getAdhocFilters: function () { return []; },
                                replace: function (a) { return a; },
                            };
                            ds = new LokiDatasource(settings, templateSrvMock, timeSrvStub);
                            options = getQueryOptions({ targets: [{ expr: expr, refId: 'B', maxLines: queryMaxLines }] });
                            options.maxDataPoints = maxDataPoints;
                            fetchMock.mockImplementation(function () { return of(testLogsResponse); });
                            return [4 /*yield*/, expect(ds.query(options).pipe(take(1))).toEmitValuesWith(function () {
                                    expect(fetchMock.mock.calls.length).toBe(1);
                                    expect(fetchMock.mock.calls[0][0].url).toContain("limit=" + expectedLimit);
                                })];
                        case 1:
                            _e.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        it('should use datasource max lines when no limit given and it is log query', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, runLimitTest({ expectedLimit: 456 })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should use custom max lines from query if set and it is logs query', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, runLimitTest({ queryMaxLines: 20, expectedLimit: 20 })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should use custom max lines from query if set and it is logs query even if it is higher than data source limit', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, runLimitTest({ queryMaxLines: 500, expectedLimit: 500 })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should use maxDataPoints if it is metrics query', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, runLimitTest({ expr: 'rate({label="val"}[10m])', expectedLimit: 123 })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should use maxDataPoints if it is metrics query and using search', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, runLimitTest({ expr: 'rate({label="val"}[10m])', expectedLimit: 123 })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when querying', function () {
        function setup(expr, app, instant, range) {
            var ds = createLokiDSForTests();
            var options = getQueryOptions({
                targets: [{ expr: expr, refId: 'B', instant: instant, range: range }],
                app: app,
            });
            ds.runInstantQuery = jest.fn(function () { return of({ data: [] }); });
            ds.runRangeQuery = jest.fn(function () { return of({ data: [] }); });
            return { ds: ds, options: options };
        }
        var metricsQuery = 'rate({job="grafana"}[10m])';
        var logsQuery = '{job="grafana"} |= "foo"';
        it('should run logs instant if only instant is selected', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, ds, options;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(logsQuery, CoreApp.Explore, true, false), ds = _a.ds, options = _a.options;
                        return [4 /*yield*/, lastValueFrom(ds.query(options))];
                    case 1:
                        _b.sent();
                        expect(ds.runInstantQuery).toBeCalled();
                        expect(ds.runRangeQuery).not.toBeCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should run metrics instant if only instant is selected', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, ds, options, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = setup(metricsQuery, CoreApp.Explore, true, false), ds = _a.ds, options = _a.options;
                        _b = lastValueFrom;
                        return [4 /*yield*/, ds.query(options)];
                    case 1:
                        _b.apply(void 0, [_c.sent()]);
                        expect(ds.runInstantQuery).toBeCalled();
                        expect(ds.runRangeQuery).not.toBeCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should run only logs range query if only range is selected', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, ds, options, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = setup(logsQuery, CoreApp.Explore, false, true), ds = _a.ds, options = _a.options;
                        _b = lastValueFrom;
                        return [4 /*yield*/, ds.query(options)];
                    case 1:
                        _b.apply(void 0, [_c.sent()]);
                        expect(ds.runInstantQuery).not.toBeCalled();
                        expect(ds.runRangeQuery).toBeCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should run only metrics range query if only range is selected', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, ds, options, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = setup(metricsQuery, CoreApp.Explore, false, true), ds = _a.ds, options = _a.options;
                        _b = lastValueFrom;
                        return [4 /*yield*/, ds.query(options)];
                    case 1:
                        _b.apply(void 0, [_c.sent()]);
                        expect(ds.runInstantQuery).not.toBeCalled();
                        expect(ds.runRangeQuery).toBeCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should run only logs range query if no query type is selected in Explore', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, ds, options, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = setup(logsQuery, CoreApp.Explore), ds = _a.ds, options = _a.options;
                        _b = lastValueFrom;
                        return [4 /*yield*/, ds.query(options)];
                    case 1:
                        _b.apply(void 0, [_c.sent()]);
                        expect(ds.runInstantQuery).not.toBeCalled();
                        expect(ds.runRangeQuery).toBeCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should run only metrics range query if no query type is selected in Explore', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, ds, options, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = setup(metricsQuery, CoreApp.Explore), ds = _a.ds, options = _a.options;
                        _b = lastValueFrom;
                        return [4 /*yield*/, ds.query(options)];
                    case 1:
                        _b.apply(void 0, [_c.sent()]);
                        expect(ds.runInstantQuery).not.toBeCalled();
                        expect(ds.runRangeQuery).toBeCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should run only logs range query in Dashboard', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, ds, options, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = setup(logsQuery, CoreApp.Dashboard), ds = _a.ds, options = _a.options;
                        _b = lastValueFrom;
                        return [4 /*yield*/, ds.query(options)];
                    case 1:
                        _b.apply(void 0, [_c.sent()]);
                        expect(ds.runInstantQuery).not.toBeCalled();
                        expect(ds.runRangeQuery).toBeCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should run only metrics range query in Dashboard', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, ds, options, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = setup(metricsQuery, CoreApp.Dashboard), ds = _a.ds, options = _a.options;
                        _b = lastValueFrom;
                        return [4 /*yield*/, ds.query(options)];
                    case 1:
                        _b.apply(void 0, [_c.sent()]);
                        expect(ds.runInstantQuery).not.toBeCalled();
                        expect(ds.runRangeQuery).toBeCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should return series data for metrics range queries', function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds, options;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = createLokiDSForTests();
                        options = getQueryOptions({
                            targets: [{ expr: metricsQuery, refId: 'B', range: true }],
                            app: CoreApp.Explore,
                        });
                        fetchMock.mockImplementation(function () { return of(testMetricsResponse); });
                        return [4 /*yield*/, expect(ds.query(options)).toEmitValuesWith(function (received) {
                                var _a;
                                var result = received[0];
                                var timeSeries = result.data[0];
                                expect((_a = timeSeries.meta) === null || _a === void 0 ? void 0 : _a.preferredVisualisationType).toBe('graph');
                                expect(timeSeries.refId).toBe('B');
                                expect(timeSeries.datapoints[0]).toEqual([1.1, 1605715380000]);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should return series data for logs range query', function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds, options;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = createLokiDSForTests();
                        options = getQueryOptions({
                            targets: [{ expr: logsQuery, refId: 'B' }],
                        });
                        fetchMock.mockImplementation(function () { return of(testLogsResponse); });
                        return [4 /*yield*/, expect(ds.query(options)).toEmitValuesWith(function (received) {
                                var _a, _b, _c;
                                var result = received[0];
                                var dataFrame = result.data[0];
                                var fieldCache = new FieldCache(dataFrame);
                                expect((_a = fieldCache.getFieldByName('line')) === null || _a === void 0 ? void 0 : _a.values.get(0)).toBe('hello');
                                expect((_b = dataFrame.meta) === null || _b === void 0 ? void 0 : _b.limit).toBe(20);
                                expect((_c = dataFrame.meta) === null || _c === void 0 ? void 0 : _c.searchWords).toEqual(['foo']);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should return custom error message when Loki returns escaping error', function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds, options;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = createLokiDSForTests();
                        options = getQueryOptions({
                            targets: [{ expr: '{job="gra\\fana"}', refId: 'B' }],
                        });
                        fetchMock.mockImplementation(function () {
                            return throwError({
                                data: {
                                    message: 'parse error at line 1, col 6: invalid char escape',
                                },
                                status: 400,
                                statusText: 'Bad Request',
                            });
                        });
                        return [4 /*yield*/, expect(ds.query(options)).toEmitValuesWith(function (received) {
                                var err = received[0];
                                expect(err.data.message).toBe('Error: parse error at line 1, col 6: invalid char escape. Make sure that all special characters are escaped with \\. For more information on escaping of special characters visit LogQL documentation at https://grafana.com/docs/loki/latest/logql/.');
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        describe('When using adhoc filters', function () {
            var DEFAULT_EXPR = 'rate({bar="baz", job="foo"} |= "bar" [5m])';
            var options = {
                targets: [{ expr: DEFAULT_EXPR }],
            };
            var originalAdhocFiltersMock = templateSrvStub.getAdhocFilters();
            var ds = new LokiDatasource({}, templateSrvStub, timeSrvStub);
            ds.runRangeQuery = jest.fn(function () { return of({ data: [] }); });
            afterAll(function () {
                templateSrvStub.getAdhocFilters.mockReturnValue(originalAdhocFiltersMock);
            });
            it('should not modify expression with no filters', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, lastValueFrom(ds.query(options))];
                        case 1:
                            _a.sent();
                            expect(ds.runRangeQuery).toBeCalledWith({ expr: DEFAULT_EXPR }, expect.anything(), expect.anything());
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should add filters to expression', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            templateSrvStub.getAdhocFilters.mockReturnValue([
                                {
                                    key: 'k1',
                                    operator: '=',
                                    value: 'v1',
                                },
                                {
                                    key: 'k2',
                                    operator: '!=',
                                    value: 'v2',
                                },
                            ]);
                            return [4 /*yield*/, lastValueFrom(ds.query(options))];
                        case 1:
                            _a.sent();
                            expect(ds.runRangeQuery).toBeCalledWith({ expr: 'rate({bar="baz",job="foo",k1="v1",k2!="v2"} |= "bar" [5m])' }, expect.anything(), expect.anything());
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should add escaping if needed to regex filter expressions', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            templateSrvStub.getAdhocFilters.mockReturnValue([
                                {
                                    key: 'k1',
                                    operator: '=~',
                                    value: 'v.*',
                                },
                                {
                                    key: 'k2',
                                    operator: '=~',
                                    value: "v'.*",
                                },
                            ]);
                            return [4 /*yield*/, lastValueFrom(ds.query(options))];
                        case 1:
                            _a.sent();
                            expect(ds.runRangeQuery).toBeCalledWith({ expr: 'rate({bar="baz",job="foo",k1=~"v.*",k2=~"v\\\\\'.*"} |= "bar" [5m])' }, expect.anything(), expect.anything());
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('__range, __range_s and __range_ms variables', function () {
            var options = {
                targets: [{ expr: 'rate(process_cpu_seconds_total[$__range])', refId: 'A', stepInterval: '2s' }],
                range: {
                    from: rawRange.from,
                    to: rawRange.to,
                    raw: rawRange,
                },
            };
            var ds = new LokiDatasource({}, templateSrvStub, timeSrvStub);
            beforeEach(function () {
                templateSrvStub.replace.mockClear();
            });
            it('should be correctly interpolated', function () {
                ds.query(options);
                var range = templateSrvStub.replace.mock.calls[0][1].__range;
                var rangeMs = templateSrvStub.replace.mock.calls[0][1].__range_ms;
                var rangeS = templateSrvStub.replace.mock.calls[0][1].__range_s;
                expect(range).toEqual({ text: '3600s', value: '3600s' });
                expect(rangeMs).toEqual({ text: 3600000, value: 3600000 });
                expect(rangeS).toEqual({ text: 3600, value: 3600 });
            });
        });
    });
    describe('when interpolating variables', function () {
        var ds;
        var variable;
        beforeEach(function () {
            ds = createLokiDSForTests();
            variable = __assign({}, initialCustomVariableModelState);
        });
        it('should only escape single quotes', function () {
            expect(ds.interpolateQueryExpr("abc'$^*{}[]+?.()|", variable)).toEqual("abc\\\\'$^*{}[]+?.()|");
        });
        it('should return a number', function () {
            expect(ds.interpolateQueryExpr(1000, variable)).toEqual(1000);
        });
        describe('and variable allows multi-value', function () {
            beforeEach(function () {
                variable.multi = true;
            });
            it('should regex escape values if the value is a string', function () {
                expect(ds.interpolateQueryExpr('looking*glass', variable)).toEqual('looking\\\\*glass');
            });
            it('should return pipe separated values if the value is an array of strings', function () {
                expect(ds.interpolateQueryExpr(['a|bc', 'de|f'], variable)).toEqual('a\\\\|bc|de\\\\|f');
            });
        });
        describe('and variable allows all', function () {
            beforeEach(function () {
                variable.includeAll = true;
            });
            it('should regex escape values if the array is a string', function () {
                expect(ds.interpolateQueryExpr('looking*glass', variable)).toEqual('looking\\\\*glass');
            });
            it('should return pipe separated values if the value is an array of strings', function () {
                expect(ds.interpolateQueryExpr(['a|bc', 'de|f'], variable)).toEqual('a\\\\|bc|de\\\\|f');
            });
        });
    });
    describe('when performing testDataSource', function () {
        describe('and call succeeds', function () {
            it('should return successfully', function () { return __awaiter(void 0, void 0, void 0, function () {
                var ds, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            fetchMock.mockImplementation(function () { return of(createFetchResponse({ values: ['avalue'] })); });
                            ds = createLokiDSForTests({});
                            return [4 /*yield*/, ds.testDatasource()];
                        case 1:
                            result = _a.sent();
                            expect(result.status).toBe('success');
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and call fails with 401 error', function () {
            it('should return error status and a detailed error message', function () { return __awaiter(void 0, void 0, void 0, function () {
                var ds, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            fetchMock.mockImplementation(function () {
                                return throwError({
                                    statusText: 'Unauthorized',
                                    status: 401,
                                    data: {
                                        message: 'Unauthorized',
                                    },
                                });
                            });
                            ds = createLokiDSForTests({});
                            return [4 /*yield*/, ds.testDatasource()];
                        case 1:
                            result = _a.sent();
                            expect(result.status).toEqual('error');
                            expect(result.message).toBe('Loki: Unauthorized. 401. Unauthorized');
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and call fails with 404 error', function () {
            it('should return error status and a detailed error message', function () { return __awaiter(void 0, void 0, void 0, function () {
                var ds, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            fetchMock.mockImplementation(function () {
                                return throwError({
                                    statusText: 'Not found',
                                    status: 404,
                                    data: {
                                        message: '404 page not found',
                                    },
                                });
                            });
                            ds = createLokiDSForTests({});
                            return [4 /*yield*/, ds.testDatasource()];
                        case 1:
                            result = _a.sent();
                            expect(result.status).toEqual('error');
                            expect(result.message).toBe('Loki: Not found. 404. 404 page not found');
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and call fails with 502 error', function () {
            it('should return error status and a detailed error message', function () { return __awaiter(void 0, void 0, void 0, function () {
                var ds, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            fetchMock.mockImplementation(function () {
                                return throwError({
                                    statusText: 'Bad Gateway',
                                    status: 502,
                                    data: '',
                                });
                            });
                            ds = createLokiDSForTests({});
                            return [4 /*yield*/, ds.testDatasource()];
                        case 1:
                            result = _a.sent();
                            expect(result.status).toEqual('error');
                            expect(result.message).toBe('Loki: Bad Gateway. 502');
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
    describe('when calling annotationQuery', function () {
        var getTestContext = function (response, options) {
            if (options === void 0) { options = []; }
            var query = makeAnnotationQueryRequest(options);
            fetchMock.mockImplementation(function () { return of(response); });
            var ds = createLokiDSForTests();
            var promise = ds.annotationQuery(query);
            return { promise: promise };
        };
        it('should transform the loki data to annotation response', function () { return __awaiter(void 0, void 0, void 0, function () {
            var response, promise, res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        response = {
                            data: {
                                data: {
                                    resultType: LokiResultType.Stream,
                                    result: [
                                        {
                                            stream: {
                                                label: 'value',
                                                label2: 'value ',
                                            },
                                            values: [['1549016857498000000', 'hello']],
                                        },
                                        {
                                            stream: {
                                                label: '',
                                                label2: 'value2',
                                                label3: ' ', // whitespace value gets trimmed then filtered
                                            },
                                            values: [['1549024057498000000', 'hello 2']],
                                        },
                                    ],
                                },
                                status: 'success',
                            },
                        };
                        promise = getTestContext(response, { stepInterval: '15s' }).promise;
                        return [4 /*yield*/, promise];
                    case 1:
                        res = _a.sent();
                        expect(res.length).toBe(2);
                        expect(res[0].text).toBe('hello');
                        expect(res[0].tags).toEqual(['value']);
                        expect(res[1].text).toBe('hello 2');
                        expect(res[1].tags).toEqual(['value2']);
                        return [2 /*return*/];
                }
            });
        }); });
        describe('Formatting', function () {
            var response = {
                data: {
                    data: {
                        resultType: LokiResultType.Stream,
                        result: [
                            {
                                stream: {
                                    label: 'value',
                                    label2: 'value2',
                                    label3: 'value3',
                                },
                                values: [['1549016857498000000', 'hello']],
                            },
                        ],
                    },
                    status: 'success',
                },
            };
            describe('When tagKeys is set', function () {
                it('should only include selected labels', function () { return __awaiter(void 0, void 0, void 0, function () {
                    var promise, res;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                promise = getTestContext(response, { tagKeys: 'label2,label3', stepInterval: '15s' }).promise;
                                return [4 /*yield*/, promise];
                            case 1:
                                res = _a.sent();
                                expect(res.length).toBe(1);
                                expect(res[0].text).toBe('hello');
                                expect(res[0].tags).toEqual(['value2', 'value3']);
                                return [2 /*return*/];
                        }
                    });
                }); });
            });
            describe('When textFormat is set', function () {
                it('should fromat the text accordingly', function () { return __awaiter(void 0, void 0, void 0, function () {
                    var promise, res;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                promise = getTestContext(response, { textFormat: 'hello {{label2}}', stepInterval: '15s' }).promise;
                                return [4 /*yield*/, promise];
                            case 1:
                                res = _a.sent();
                                expect(res.length).toBe(1);
                                expect(res[0].text).toBe('hello value2');
                                return [2 /*return*/];
                        }
                    });
                }); });
            });
            describe('When titleFormat is set', function () {
                it('should fromat the title accordingly', function () { return __awaiter(void 0, void 0, void 0, function () {
                    var promise, res;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                promise = getTestContext(response, { titleFormat: 'Title {{label2}}', stepInterval: '15s' }).promise;
                                return [4 /*yield*/, promise];
                            case 1:
                                res = _a.sent();
                                expect(res.length).toBe(1);
                                expect(res[0].title).toBe('Title value2');
                                expect(res[0].text).toBe('hello');
                                return [2 /*return*/];
                        }
                    });
                }); });
            });
        });
    });
    describe('metricFindQuery', function () {
        var getTestContext = function (mock) {
            var ds = createLokiDSForTests();
            ds.metadataRequest = mock.metadataRequest;
            return { ds: ds };
        };
        var mock = makeMockLokiDatasource({ label1: ['value1', 'value2'], label2: ['value3', 'value4'] }, { '{label1="value1", label2="value2"}': [{ label5: 'value5' }] });
        it("should return label names for Loki", function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds, res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = getTestContext(mock).ds;
                        return [4 /*yield*/, ds.metricFindQuery('label_names()')];
                    case 1:
                        res = _a.sent();
                        expect(res).toEqual([{ text: 'label1' }, { text: 'label2' }]);
                        return [2 /*return*/];
                }
            });
        }); });
        it("should return label values for Loki when no matcher", function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds, res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = getTestContext(mock).ds;
                        return [4 /*yield*/, ds.metricFindQuery('label_values(label1)')];
                    case 1:
                        res = _a.sent();
                        expect(res).toEqual([{ text: 'value1' }, { text: 'value2' }]);
                        return [2 /*return*/];
                }
            });
        }); });
        it("should return label values for Loki with matcher", function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds, res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = getTestContext(mock).ds;
                        return [4 /*yield*/, ds.metricFindQuery('label_values({label1="value1", label2="value2"},label5)')];
                    case 1:
                        res = _a.sent();
                        expect(res).toEqual([{ text: 'value5' }]);
                        return [2 /*return*/];
                }
            });
        }); });
        it("should return empty array when incorrect query for Loki", function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds, res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = getTestContext(mock).ds;
                        return [4 /*yield*/, ds.metricFindQuery('incorrect_query')];
                    case 1:
                        res = _a.sent();
                        expect(res).toEqual([]);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('modifyQuery', function () {
        describe('when called with ADD_FILTER', function () {
            describe('and query has no parser', function () {
                it('then the correct label should be added for logs query', function () {
                    var query = { refId: 'A', expr: '{bar="baz"}' };
                    var action = { key: 'job', value: 'grafana', type: 'ADD_FILTER' };
                    var ds = createLokiDSForTests();
                    var result = ds.modifyQuery(query, action);
                    expect(result.refId).toEqual('A');
                    expect(result.expr).toEqual('{bar="baz",job="grafana"}');
                });
                it('then the correct label should be added for metrics query', function () {
                    var query = { refId: 'A', expr: 'rate({bar="baz"}[5m])' };
                    var action = { key: 'job', value: 'grafana', type: 'ADD_FILTER' };
                    var ds = createLokiDSForTests();
                    var result = ds.modifyQuery(query, action);
                    expect(result.refId).toEqual('A');
                    expect(result.expr).toEqual('rate({bar="baz",job="grafana"}[5m])');
                });
                describe('and query has parser', function () {
                    it('then the correct label should be added for logs query', function () {
                        var query = { refId: 'A', expr: '{bar="baz"} | logfmt' };
                        var action = { key: 'job', value: 'grafana', type: 'ADD_FILTER' };
                        var ds = createLokiDSForTests();
                        var result = ds.modifyQuery(query, action);
                        expect(result.refId).toEqual('A');
                        expect(result.expr).toEqual('{bar="baz"} | logfmt | job="grafana"');
                    });
                    it('then the correct label should be added for metrics query', function () {
                        var query = { refId: 'A', expr: 'rate({bar="baz"} | logfmt [5m])' };
                        var action = { key: 'job', value: 'grafana', type: 'ADD_FILTER' };
                        var ds = createLokiDSForTests();
                        var result = ds.modifyQuery(query, action);
                        expect(result.refId).toEqual('A');
                        expect(result.expr).toEqual('rate({bar="baz",job="grafana"} | logfmt [5m])');
                    });
                });
            });
        });
        describe('when called with ADD_FILTER_OUT', function () {
            describe('and query has no parser', function () {
                it('then the correct label should be added for logs query', function () {
                    var query = { refId: 'A', expr: '{bar="baz"}' };
                    var action = { key: 'job', value: 'grafana', type: 'ADD_FILTER_OUT' };
                    var ds = createLokiDSForTests();
                    var result = ds.modifyQuery(query, action);
                    expect(result.refId).toEqual('A');
                    expect(result.expr).toEqual('{bar="baz",job!="grafana"}');
                });
                it('then the correct label should be added for metrics query', function () {
                    var query = { refId: 'A', expr: 'rate({bar="baz"}[5m])' };
                    var action = { key: 'job', value: 'grafana', type: 'ADD_FILTER_OUT' };
                    var ds = createLokiDSForTests();
                    var result = ds.modifyQuery(query, action);
                    expect(result.refId).toEqual('A');
                    expect(result.expr).toEqual('rate({bar="baz",job!="grafana"}[5m])');
                });
                describe('and query has parser', function () {
                    it('then the correct label should be added for logs query', function () {
                        var query = { refId: 'A', expr: '{bar="baz"} | logfmt' };
                        var action = { key: 'job', value: 'grafana', type: 'ADD_FILTER_OUT' };
                        var ds = createLokiDSForTests();
                        var result = ds.modifyQuery(query, action);
                        expect(result.refId).toEqual('A');
                        expect(result.expr).toEqual('{bar="baz"} | logfmt | job!="grafana"');
                    });
                    it('then the correct label should be added for metrics query', function () {
                        var query = { refId: 'A', expr: 'rate({bar="baz"} | logfmt [5m])' };
                        var action = { key: 'job', value: 'grafana', type: 'ADD_FILTER_OUT' };
                        var ds = createLokiDSForTests();
                        var result = ds.modifyQuery(query, action);
                        expect(result.refId).toEqual('A');
                        expect(result.expr).toEqual('rate({bar="baz",job!="grafana"} | logfmt [5m])');
                    });
                });
            });
        });
    });
    describe('addAdHocFilters', function () {
        var ds;
        var adHocFilters;
        describe('when called with "=" operator', function () {
            beforeEach(function () {
                adHocFilters = [
                    {
                        condition: '',
                        key: 'job',
                        operator: '=',
                        value: 'grafana',
                    },
                ];
                var templateSrvMock = {
                    getAdhocFilters: function () { return adHocFilters; },
                    replace: function (a) { return a; },
                };
                ds = createLokiDSForTests(templateSrvMock);
            });
            describe('and query has no parser', function () {
                it('then the correct label should be added for logs query', function () {
                    assertAdHocFilters('{bar="baz"}', '{bar="baz",job="grafana"}', ds);
                });
                it('then the correct label should be added for metrics query', function () {
                    assertAdHocFilters('rate({bar="baz"}[5m])', 'rate({bar="baz",job="grafana"}[5m])', ds);
                });
            });
            describe('and query has parser', function () {
                it('then the correct label should be added for logs query', function () {
                    assertAdHocFilters('{bar="baz"} | logfmt', '{bar="baz"} | logfmt | job="grafana"', ds);
                });
                it('then the correct label should be added for metrics query', function () {
                    assertAdHocFilters('rate({bar="baz"} | logfmt [5m])', 'rate({bar="baz",job="grafana"} | logfmt [5m])', ds);
                });
            });
        });
        describe('when called with "!=" operator', function () {
            beforeEach(function () {
                adHocFilters = [
                    {
                        condition: '',
                        key: 'job',
                        operator: '!=',
                        value: 'grafana',
                    },
                ];
                var templateSrvMock = {
                    getAdhocFilters: function () { return adHocFilters; },
                    replace: function (a) { return a; },
                };
                ds = createLokiDSForTests(templateSrvMock);
            });
            describe('and query has no parser', function () {
                it('then the correct label should be added for logs query', function () {
                    assertAdHocFilters('{bar="baz"}', '{bar="baz",job!="grafana"}', ds);
                });
                it('then the correct label should be added for metrics query', function () {
                    assertAdHocFilters('rate({bar="baz"}[5m])', 'rate({bar="baz",job!="grafana"}[5m])', ds);
                });
            });
            describe('and query has parser', function () {
                it('then the correct label should be added for logs query', function () {
                    assertAdHocFilters('{bar="baz"} | logfmt', '{bar="baz"} | logfmt | job!="grafana"', ds);
                });
                it('then the correct label should be added for metrics query', function () {
                    assertAdHocFilters('rate({bar="baz"} | logfmt [5m])', 'rate({bar="baz",job!="grafana"} | logfmt [5m])', ds);
                });
            });
        });
    });
    describe('adjustInterval', function () {
        var dynamicInterval = 15;
        var range = 1642;
        var resolution = 1;
        var ds = createLokiDSForTests();
        it('should return the interval as a factor of dynamicInterval and resolution', function () {
            var interval = ds.adjustInterval(dynamicInterval, resolution, range);
            expect(interval).toBe(resolution * dynamicInterval);
        });
        it('should not return a value less than the safe interval', function () {
            var safeInterval = range / 11000;
            if (safeInterval > 1) {
                safeInterval = Math.ceil(safeInterval);
            }
            var unsafeInterval = safeInterval - 0.01;
            var interval = ds.adjustInterval(unsafeInterval, resolution, range);
            expect(interval).toBeGreaterThanOrEqual(safeInterval);
        });
    });
    describe('prepareLogRowContextQueryTarget', function () {
        var ds = createLokiDSForTests();
        it('creates query with only labels from /labels API', function () {
            var row = {
                rowIndex: 0,
                dataFrame: new MutableDataFrame({
                    fields: [
                        {
                            name: 'tsNs',
                            type: FieldType.string,
                            values: ['0'],
                        },
                    ],
                }),
                labels: { bar: 'baz', foo: 'uniqueParsedLabel' },
                uid: '1',
            };
            //Mock stored labels to only include "bar" label
            jest.spyOn(ds.languageProvider, 'getLabelKeys').mockImplementation(function () { return ['bar']; });
            var contextQuery = ds.prepareLogRowContextQueryTarget(row, 10, 'BACKWARD');
            expect(contextQuery.expr).toContain('baz');
            expect(contextQuery.expr).not.toContain('uniqueParsedLabel');
        });
    });
    describe('logs volume data provider', function () {
        it('creates provider for logs query', function () {
            var ds = createLokiDSForTests();
            var options = getQueryOptions({
                targets: [{ expr: '{label=value}', refId: 'A' }],
            });
            expect(ds.getLogsVolumeDataProvider(options)).toBeDefined();
        });
        it('does not create provider for metrics query', function () {
            var ds = createLokiDSForTests();
            var options = getQueryOptions({
                targets: [{ expr: 'rate({label=value}[1m])', refId: 'A' }],
            });
            expect(ds.getLogsVolumeDataProvider(options)).not.toBeDefined();
        });
        it('creates provider if at least one query is a logs query', function () {
            var ds = createLokiDSForTests();
            var options = getQueryOptions({
                targets: [
                    { expr: 'rate({label=value}[1m])', refId: 'A' },
                    { expr: '{label=value}', refId: 'B' },
                ],
            });
            expect(ds.getLogsVolumeDataProvider(options)).toBeDefined();
        });
    });
});
function assertAdHocFilters(query, expectedResults, ds) {
    var lokiQuery = { refId: 'A', expr: query };
    var result = ds.addAdHocFilters(lokiQuery.expr);
    expect(result).toEqual(expectedResults);
}
function createLokiDSForTests(templateSrvMock) {
    if (templateSrvMock === void 0) { templateSrvMock = {
        getAdhocFilters: function () { return []; },
        replace: function (a) { return a; },
    }; }
    var instanceSettings = {
        url: 'myloggingurl',
    };
    var customData = __assign(__assign({}, (instanceSettings.jsonData || {})), { maxLines: 20 });
    var customSettings = __assign(__assign({}, instanceSettings), { jsonData: customData });
    return new LokiDatasource(customSettings, templateSrvMock, timeSrvStub);
}
function makeAnnotationQueryRequest(options) {
    var timeRange = {
        from: dateTime(),
        to: dateTime(),
    };
    return {
        annotation: __assign({ expr: '{test=test}', refId: '', datasource: 'loki', enable: true, name: 'test-annotation', iconColor: 'red' }, options),
        dashboard: {
            id: 1,
        },
        range: __assign(__assign({}, timeRange), { raw: timeRange }),
        rangeRaw: timeRange,
    };
}
//# sourceMappingURL=datasource.test.js.map