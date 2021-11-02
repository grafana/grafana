import { __assign, __awaiter, __generator } from "tslib";
import { lastValueFrom, of } from 'rxjs';
import InfluxDatasource from '../datasource';
import { TemplateSrvStub } from 'test/specs/helpers';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
//@ts-ignore
var templateSrv = new TemplateSrvStub();
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: function () { return backendSrv; } })); });
describe('InfluxDataSource', function () {
    var ctx = {
        instanceSettings: { url: 'url', name: 'influxDb', jsonData: { httpMode: 'GET' } },
    };
    var fetchMock = jest.spyOn(backendSrv, 'fetch');
    beforeEach(function () {
        jest.clearAllMocks();
        ctx.instanceSettings.url = '/api/datasources/proxy/1';
        ctx.ds = new InfluxDatasource(ctx.instanceSettings, templateSrv);
    });
    describe('When issuing metricFindQuery', function () {
        var query = 'SELECT max(value) FROM measurement WHERE $timeFilter';
        var queryOptions = {
            range: {
                from: '2018-01-01T00:00:00Z',
                to: '2018-01-02T00:00:00Z',
            },
        };
        var requestQuery, requestMethod, requestData, response;
        beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        fetchMock.mockImplementation(function (req) {
                            requestMethod = req.method;
                            requestQuery = req.params.q;
                            requestData = req.data;
                            return of({
                                data: {
                                    status: 'success',
                                    results: [
                                        {
                                            series: [
                                                {
                                                    name: 'measurement',
                                                    columns: ['name'],
                                                    values: [['cpu']],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            });
                        });
                        return [4 /*yield*/, ctx.ds.metricFindQuery(query, queryOptions)];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should replace $timefilter', function () {
            expect(requestQuery).toMatch('time >= 1514764800000ms and time <= 1514851200000ms');
        });
        it('should use the HTTP GET method', function () {
            expect(requestMethod).toBe('GET');
        });
        it('should not have any data in request body', function () {
            expect(requestData).toBeNull();
        });
        it('parse response correctly', function () {
            expect(response).toEqual([{ text: 'cpu' }]);
        });
    });
    describe('When getting error on 200 after issuing a query', function () {
        var queryOptions = {
            range: {
                from: '2018-01-01T00:00:00Z',
                to: '2018-01-02T00:00:00Z',
            },
            rangeRaw: {
                from: '2018-01-01T00:00:00Z',
                to: '2018-01-02T00:00:00Z',
            },
            targets: [{}],
            timezone: 'UTC',
            scopedVars: {
                interval: { text: '1m', value: '1m' },
                __interval: { text: '1m', value: '1m' },
                __interval_ms: { text: 60000, value: 60000 },
            },
        };
        it('throws an error', function () { return __awaiter(void 0, void 0, void 0, function () {
            var err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        fetchMock.mockImplementation(function (req) {
                            return of({
                                data: {
                                    results: [
                                        {
                                            error: 'Query timeout',
                                        },
                                    ],
                                },
                            });
                        });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, lastValueFrom(ctx.ds.query(queryOptions))];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        err_1 = _a.sent();
                        expect(err_1.message).toBe('InfluxDB Error: Query timeout');
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); });
    });
    describe('InfluxDataSource in POST query mode', function () {
        var ctx = {
            instanceSettings: { url: 'url', name: 'influxDb', jsonData: { httpMode: 'POST' } },
        };
        beforeEach(function () {
            ctx.instanceSettings.url = '/api/datasources/proxy/1';
            ctx.ds = new InfluxDatasource(ctx.instanceSettings, templateSrv);
        });
        describe('When issuing metricFindQuery', function () {
            var query = 'SELECT max(value) FROM measurement';
            var queryOptions = {};
            var requestMethod, requestQueryParameter, queryEncoded, requestQuery;
            beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            fetchMock.mockImplementation(function (req) {
                                requestMethod = req.method;
                                requestQueryParameter = req.params;
                                requestQuery = req.data;
                                return of({
                                    data: {
                                        results: [
                                            {
                                                series: [
                                                    {
                                                        name: 'measurement',
                                                        columns: ['max'],
                                                        values: [[1]],
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                });
                            });
                            return [4 /*yield*/, ctx.ds.serializeParams({ q: query })];
                        case 1:
                            queryEncoded = _a.sent();
                            return [4 /*yield*/, ctx.ds.metricFindQuery(query, queryOptions).then(function () { })];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should have the query form urlencoded', function () {
                expect(requestQuery).toBe(queryEncoded);
            });
            it('should use the HTTP POST method', function () {
                expect(requestMethod).toBe('POST');
            });
            it('should not have q as a query parameter', function () {
                expect(requestQueryParameter).not.toHaveProperty('q');
            });
        });
    });
});
//# sourceMappingURL=datasource.test.js.map