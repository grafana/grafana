var _this = this;
import * as tslib_1 from "tslib";
import LokiDatasource from './datasource';
import { getQueryOptions } from 'test/helpers/getQueryOptions';
describe('LokiDatasource', function () {
    var instanceSettings = {
        url: 'myloggingurl',
    };
    var testResp = {
        data: {
            streams: [
                {
                    entries: [{ ts: '2019-02-01T10:27:37.498180581Z', line: 'hello' }],
                    labels: '{}',
                },
            ],
        },
    };
    describe('when querying', function () {
        var backendSrvMock = { datasourceRequest: jest.fn() };
        var templateSrvMock = {
            getAdhocFilters: function () { return []; },
            replace: function (a) { return a; },
        };
        test('should use default max lines when no limit given', function () {
            var ds = new LokiDatasource(instanceSettings, backendSrvMock, templateSrvMock);
            backendSrvMock.datasourceRequest = jest.fn(function () { return Promise.resolve(testResp); });
            var options = getQueryOptions({ targets: [{ expr: 'foo', refId: 'B' }] });
            ds.query(options);
            expect(backendSrvMock.datasourceRequest.mock.calls.length).toBe(1);
            expect(backendSrvMock.datasourceRequest.mock.calls[0][0].url).toContain('limit=1000');
        });
        test('should use custom max lines if limit is set', function () {
            var customData = tslib_1.__assign({}, (instanceSettings.jsonData || {}), { maxLines: 20 });
            var customSettings = tslib_1.__assign({}, instanceSettings, { jsonData: customData });
            var ds = new LokiDatasource(customSettings, backendSrvMock, templateSrvMock);
            backendSrvMock.datasourceRequest = jest.fn(function () { return Promise.resolve(testResp); });
            var options = getQueryOptions({ targets: [{ expr: 'foo', refId: 'B' }] });
            ds.query(options);
            expect(backendSrvMock.datasourceRequest.mock.calls.length).toBe(1);
            expect(backendSrvMock.datasourceRequest.mock.calls[0][0].url).toContain('limit=20');
        });
        test('should return log streams when resultFormat is undefined', function (done) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var ds, options, res;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = new LokiDatasource(instanceSettings, backendSrvMock, templateSrvMock);
                        backendSrvMock.datasourceRequest = jest.fn(function () { return Promise.resolve(testResp); });
                        options = getQueryOptions({
                            targets: [{ expr: 'foo', refId: 'B' }],
                        });
                        return [4 /*yield*/, ds.query(options)];
                    case 1:
                        res = _a.sent();
                        expect(res.data[0].entries[0].line).toBe('hello');
                        done();
                        return [2 /*return*/];
                }
            });
        }); });
        test('should return time series when resultFormat is time_series', function (done) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var ds, options, res;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = new LokiDatasource(instanceSettings, backendSrvMock, templateSrvMock);
                        backendSrvMock.datasourceRequest = jest.fn(function () { return Promise.resolve(testResp); });
                        options = getQueryOptions({
                            targets: [{ expr: 'foo', refId: 'B', resultFormat: 'time_series' }],
                        });
                        return [4 /*yield*/, ds.query(options)];
                    case 1:
                        res = _a.sent();
                        expect(res.data[0].datapoints).toBeDefined();
                        done();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when performing testDataSource', function () {
        var ds;
        var result;
        describe('and call succeeds', function () {
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
                                                    status: 200,
                                                    data: {
                                                        values: ['avalue'],
                                                    },
                                                })];
                                        });
                                    });
                                },
                            };
                            ds = new LokiDatasource(instanceSettings, backendSrv, {});
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
        describe('and call fails with 401 error', function () {
            beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                var backendSrv;
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            backendSrv = {
                                datasourceRequest: function () {
                                    return tslib_1.__awaiter(this, void 0, void 0, function () {
                                        return tslib_1.__generator(this, function (_a) {
                                            return [2 /*return*/, Promise.reject({
                                                    statusText: 'Unauthorized',
                                                    status: 401,
                                                    data: {
                                                        message: 'Unauthorized',
                                                    },
                                                })];
                                        });
                                    });
                                },
                            };
                            ds = new LokiDatasource(instanceSettings, backendSrv, {});
                            return [4 /*yield*/, ds.testDatasource()];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should return error status and a detailed error message', function () {
                expect(result.status).toEqual('error');
                expect(result.message).toBe('Loki: Unauthorized. 401. Unauthorized');
            });
        });
        describe('and call fails with 404 error', function () {
            beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                var backendSrv;
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            backendSrv = {
                                datasourceRequest: function () {
                                    return tslib_1.__awaiter(this, void 0, void 0, function () {
                                        return tslib_1.__generator(this, function (_a) {
                                            return [2 /*return*/, Promise.reject({
                                                    statusText: 'Not found',
                                                    status: 404,
                                                    data: '404 page not found',
                                                })];
                                        });
                                    });
                                },
                            };
                            ds = new LokiDatasource(instanceSettings, backendSrv, {});
                            return [4 /*yield*/, ds.testDatasource()];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should return error status and a detailed error message', function () {
                expect(result.status).toEqual('error');
                expect(result.message).toBe('Loki: Not found. 404. 404 page not found');
            });
        });
        describe('and call fails with 502 error', function () {
            beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                var backendSrv;
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            backendSrv = {
                                datasourceRequest: function () {
                                    return tslib_1.__awaiter(this, void 0, void 0, function () {
                                        return tslib_1.__generator(this, function (_a) {
                                            return [2 /*return*/, Promise.reject({
                                                    statusText: 'Bad Gateway',
                                                    status: 502,
                                                    data: '',
                                                })];
                                        });
                                    });
                                },
                            };
                            ds = new LokiDatasource(instanceSettings, backendSrv, {});
                            return [4 /*yield*/, ds.testDatasource()];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should return error status and a detailed error message', function () {
                expect(result.status).toEqual('error');
                expect(result.message).toBe('Loki: Bad Gateway. 502');
            });
        });
    });
});
//# sourceMappingURL=datasource.test.js.map