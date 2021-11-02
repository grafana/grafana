import { __assign, __awaiter, __generator } from "tslib";
import { map } from 'lodash';
import { of, throwError } from 'rxjs';
import { ArrayVector, CoreApp, dateMath, dateTime, MutableDataFrame, toUtc, } from '@grafana/data';
import { ElasticDatasource, enhanceDataFrame } from './datasource';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { createFetchResponse } from '../../../../test/helpers/createFetchResponse';
var ELASTICSEARCH_MOCK_URL = 'http://elasticsearch.local';
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: function () { return backendSrv; }, getDataSourceSrv: function () {
        return {
            getInstanceSettings: function () {
                return { name: 'elastic25' };
            },
        };
    } })); });
var createTimeRange = function (from, to) { return ({
    from: from,
    to: to,
    raw: {
        from: from,
        to: to,
    },
}); };
function getTestContext(_a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.data, data = _c === void 0 ? {} : _c, _d = _b.from, from = _d === void 0 ? 'now-5m' : _d, _e = _b.jsonData, jsonData = _e === void 0 ? {} : _e, _f = _b.database, database = _f === void 0 ? '[asd-]YYYY.MM.DD' : _f, _g = _b.mockImplementation, mockImplementation = _g === void 0 ? undefined : _g;
    jest.clearAllMocks();
    var defaultMock = function (options) { return of(createFetchResponse(data)); };
    var fetchMock = jest.spyOn(backendSrv, 'fetch');
    fetchMock.mockImplementation(mockImplementation !== null && mockImplementation !== void 0 ? mockImplementation : defaultMock);
    var templateSrv = {
        replace: jest.fn(function (text) {
            if (text.startsWith('$')) {
                return "resolvedVariable";
            }
            else {
                return text;
            }
        }),
        getAdhocFilters: jest.fn(function () { return []; }),
    };
    var timeSrv = {
        time: { from: from, to: 'now' },
    };
    timeSrv.timeRange = jest.fn(function () {
        return {
            from: dateMath.parse(timeSrv.time.from, false),
            to: dateMath.parse(timeSrv.time.to, true),
        };
    });
    timeSrv.setTime = jest.fn(function (time) {
        timeSrv.time = time;
    });
    var instanceSettings = {
        id: 1,
        meta: {},
        name: 'test-elastic',
        type: 'type',
        uid: 'uid',
        access: 'proxy',
        url: ELASTICSEARCH_MOCK_URL,
        database: database,
        jsonData: jsonData,
    };
    var ds = new ElasticDatasource(instanceSettings, templateSrv);
    return { timeSrv: timeSrv, ds: ds, fetchMock: fetchMock };
}
describe('ElasticDatasource', function () {
    var _this = this;
    describe('When testing datasource with index pattern', function () {
        it('should translate index pattern to current day', function () {
            var _a = getTestContext({ jsonData: { interval: 'Daily', esVersion: 2 } }), ds = _a.ds, fetchMock = _a.fetchMock;
            ds.testDatasource();
            var today = toUtc().format('YYYY.MM.DD');
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock.mock.calls[0][0].url).toBe(ELASTICSEARCH_MOCK_URL + "/asd-" + today + "/_mapping");
        });
    });
    describe('When issuing metric query with interval pattern', function () {
        function runScenario() {
            return __awaiter(this, void 0, void 0, function () {
                var range, targets, query, data, _a, ds, fetchMock, result, requestOptions, parts, header, body;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            range = { from: toUtc([2015, 4, 30, 10]), to: toUtc([2015, 5, 1, 10]) };
                            targets = [
                                {
                                    alias: '$varAlias',
                                    bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '1' }],
                                    metrics: [{ type: 'count', id: '1' }],
                                    query: 'escape\\:test',
                                },
                            ];
                            query = { range: range, targets: targets };
                            data = {
                                responses: [
                                    {
                                        aggregations: {
                                            '1': {
                                                buckets: [
                                                    {
                                                        doc_count: 10,
                                                        key: 1000,
                                                    },
                                                ],
                                            },
                                        },
                                    },
                                ],
                            };
                            _a = getTestContext({ jsonData: { interval: 'Daily', esVersion: 2 }, data: data }), ds = _a.ds, fetchMock = _a.fetchMock;
                            result = {};
                            return [4 /*yield*/, expect(ds.query(query)).toEmitValuesWith(function (received) {
                                    expect(received.length).toBe(1);
                                    expect(received[0]).toEqual({
                                        data: [
                                            {
                                                datapoints: [[10, 1000]],
                                                metric: 'count',
                                                props: {},
                                                refId: undefined,
                                                target: 'resolvedVariable',
                                            },
                                        ],
                                    });
                                    result = received[0];
                                })];
                        case 1:
                            _b.sent();
                            expect(fetchMock).toHaveBeenCalledTimes(1);
                            requestOptions = fetchMock.mock.calls[0][0];
                            parts = requestOptions.data.split('\n');
                            header = JSON.parse(parts[0]);
                            body = JSON.parse(parts[1]);
                            return [2 /*return*/, { result: result, body: body, header: header, query: query }];
                    }
                });
            });
        }
        it('should translate index pattern to current day', function () { return __awaiter(_this, void 0, void 0, function () {
            var header;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, runScenario()];
                    case 1:
                        header = (_a.sent()).header;
                        expect(header.index).toEqual(['asd-2015.05.30', 'asd-2015.05.31', 'asd-2015.06.01']);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should not resolve the variable in the original alias field in the query', function () { return __awaiter(_this, void 0, void 0, function () {
            var query;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, runScenario()];
                    case 1:
                        query = (_a.sent()).query;
                        expect(query.targets[0].alias).toEqual('$varAlias');
                        return [2 /*return*/];
                }
            });
        }); });
        it('should resolve the alias variable for the alias/target in the result', function () { return __awaiter(_this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, runScenario()];
                    case 1:
                        result = (_a.sent()).result;
                        expect(result.data[0].target).toEqual('resolvedVariable');
                        return [2 /*return*/];
                }
            });
        }); });
        it('should json escape lucene query', function () { return __awaiter(_this, void 0, void 0, function () {
            var body;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, runScenario()];
                    case 1:
                        body = (_a.sent()).body;
                        expect(body.query.bool.filter[1].query_string.query).toBe('escape\\:test');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When issuing logs query with interval pattern', function () {
        function setupDataSource(jsonData) {
            return __awaiter(this, void 0, void 0, function () {
                var ds, query, queryBuilderSpy, response;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            jsonData = __assign({ interval: 'Daily', esVersion: '2.0.0', timeField: '@timestamp' }, (jsonData || {}));
                            ds = getTestContext({
                                jsonData: jsonData,
                                data: logsResponse.data,
                                database: 'mock-index',
                            }).ds;
                            query = {
                                range: createTimeRange(toUtc([2015, 4, 30, 10]), toUtc([2019, 7, 1, 10])),
                                targets: [
                                    {
                                        alias: '$varAlias',
                                        refId: 'A',
                                        bucketAggs: [
                                            {
                                                type: 'date_histogram',
                                                settings: { interval: 'auto' },
                                                id: '2',
                                            },
                                        ],
                                        metrics: [{ type: 'logs', id: '1' }],
                                        query: 'escape\\:test',
                                        timeField: '@timestamp',
                                    },
                                ],
                            };
                            queryBuilderSpy = jest.spyOn(ds.queryBuilder, 'getLogsQuery');
                            response = {};
                            return [4 /*yield*/, expect(ds.query(query)).toEmitValuesWith(function (received) {
                                    expect(received.length).toBe(1);
                                    response = received[0];
                                })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, { queryBuilderSpy: queryBuilderSpy, response: response }];
                    }
                });
            });
        }
        it('should call getLogsQuery()', function () { return __awaiter(_this, void 0, void 0, function () {
            var queryBuilderSpy;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, setupDataSource()];
                    case 1:
                        queryBuilderSpy = (_a.sent()).queryBuilderSpy;
                        expect(queryBuilderSpy).toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should enhance fields with links', function () { return __awaiter(_this, void 0, void 0, function () {
            var response, links;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, setupDataSource({
                            dataLinks: [
                                {
                                    field: 'host',
                                    url: 'http://localhost:3000/${__value.raw}',
                                    urlDisplayLabel: 'Custom Label',
                                },
                            ],
                        })];
                    case 1:
                        response = (_a.sent()).response;
                        expect(response.data.length).toBe(1);
                        links = response.data[0].fields.find(function (field) { return field.name === 'host'; }).config.links;
                        expect(links.length).toBe(1);
                        expect(links[0].url).toBe('http://localhost:3000/${__value.raw}');
                        expect(links[0].title).toBe('Custom Label');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When issuing document query', function () {
        function runScenario() {
            return __awaiter(this, void 0, void 0, function () {
                var range, targets, query, data, _a, ds, fetchMock, requestOptions, parts, header, body;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            range = createTimeRange(dateTime([2015, 4, 30, 10]), dateTime([2015, 5, 1, 10]));
                            targets = [{ refId: 'A', metrics: [{ type: 'raw_document', id: '1' }], query: 'test' }];
                            query = { range: range, targets: targets };
                            data = { responses: [] };
                            _a = getTestContext({ jsonData: { esVersion: 2 }, data: data, database: 'test' }), ds = _a.ds, fetchMock = _a.fetchMock;
                            return [4 /*yield*/, expect(ds.query(query)).toEmitValuesWith(function (received) {
                                    expect(received.length).toBe(1);
                                    expect(received[0]).toEqual({ data: [] });
                                })];
                        case 1:
                            _b.sent();
                            expect(fetchMock).toHaveBeenCalledTimes(1);
                            requestOptions = fetchMock.mock.calls[0][0];
                            parts = requestOptions.data.split('\n');
                            header = JSON.parse(parts[0]);
                            body = JSON.parse(parts[1]);
                            return [2 /*return*/, { body: body, header: header }];
                    }
                });
            });
        }
        it('should set search type to query_then_fetch', function () { return __awaiter(_this, void 0, void 0, function () {
            var header;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, runScenario()];
                    case 1:
                        header = (_a.sent()).header;
                        expect(header.search_type).toEqual('query_then_fetch');
                        return [2 /*return*/];
                }
            });
        }); });
        it('should set size', function () { return __awaiter(_this, void 0, void 0, function () {
            var body;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, runScenario()];
                    case 1:
                        body = (_a.sent()).body;
                        expect(body.size).toBe(500);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When getting an error on response', function () {
        var query = {
            range: createTimeRange(toUtc([2020, 1, 1, 10]), toUtc([2020, 2, 1, 10])),
            targets: [
                {
                    refId: 'A',
                    alias: '$varAlias',
                    bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '1' }],
                    metrics: [{ type: 'count', id: '1' }],
                    query: 'escape\\:test',
                },
            ],
        };
        it('should process it properly', function () { return __awaiter(_this, void 0, void 0, function () {
            var ds, errObject;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = getTestContext({
                            jsonData: { interval: 'Daily', esVersion: 7 },
                            data: {
                                took: 1,
                                responses: [
                                    {
                                        error: {
                                            reason: 'all shards failed',
                                        },
                                        status: 400,
                                    },
                                ],
                            },
                        }).ds;
                        errObject = {
                            data: '{\n    "reason": "all shards failed"\n}',
                            message: 'all shards failed',
                            config: {
                                url: 'http://localhost:3000/api/tsdb/query',
                            },
                        };
                        return [4 /*yield*/, expect(ds.query(query)).toEmitValuesWith(function (received) {
                                expect(received.length).toBe(1);
                                expect(received[0]).toEqual(errObject);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should properly throw an error with just a message', function () { return __awaiter(_this, void 0, void 0, function () {
            var response, ds, errObject;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        response = {
                            data: {
                                error: 'Bad Request',
                                message: 'Authentication to data source failed',
                            },
                            status: 400,
                            url: 'http://localhost:3000/api/tsdb/query',
                            config: { url: 'http://localhost:3000/api/tsdb/query' },
                            type: 'basic',
                            statusText: 'Bad Request',
                            redirected: false,
                            headers: {},
                            ok: false,
                        };
                        ds = getTestContext({
                            mockImplementation: function () { return throwError(response); },
                        }).ds;
                        errObject = {
                            error: 'Bad Request',
                            message: 'Elasticsearch error: Authentication to data source failed',
                        };
                        return [4 /*yield*/, expect(ds.query(query)).toEmitValuesWith(function (received) {
                                expect(received.length).toBe(1);
                                expect(received[0]).toEqual(errObject);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should properly throw an unknown error', function () { return __awaiter(_this, void 0, void 0, function () {
            var ds, errObject;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = getTestContext({
                            jsonData: { interval: 'Daily', esVersion: 7 },
                            data: {
                                took: 1,
                                responses: [
                                    {
                                        error: {},
                                        status: 400,
                                    },
                                ],
                            },
                        }).ds;
                        errObject = {
                            data: '{}',
                            message: 'Unknown elastic error response',
                            config: {
                                url: 'http://localhost:3000/api/tsdb/query',
                            },
                        };
                        return [4 /*yield*/, expect(ds.query(query)).toEmitValuesWith(function (received) {
                                expect(received.length).toBe(1);
                                expect(received[0]).toEqual(errObject);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When getting fields', function () {
        var data = {
            metricbeat: {
                mappings: {
                    metricsets: {
                        _all: {},
                        _meta: {
                            test: 'something',
                        },
                        properties: {
                            '@timestamp': { type: 'date' },
                            __timestamp: { type: 'date' },
                            '@timestampnano': { type: 'date_nanos' },
                            beat: {
                                properties: {
                                    name: {
                                        fields: { raw: { type: 'keyword' } },
                                        type: 'string',
                                    },
                                    hostname: { type: 'string' },
                                },
                            },
                            system: {
                                properties: {
                                    cpu: {
                                        properties: {
                                            system: { type: 'float' },
                                            user: { type: 'float' },
                                        },
                                    },
                                    process: {
                                        properties: {
                                            cpu: {
                                                properties: {
                                                    total: { type: 'float' },
                                                },
                                            },
                                            name: { type: 'string' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        };
        it('should return nested fields', function () { return __awaiter(_this, void 0, void 0, function () {
            var ds;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = getTestContext({ data: data, jsonData: { esVersion: 50 }, database: 'metricbeat' }).ds;
                        return [4 /*yield*/, expect(ds.getFields()).toEmitValuesWith(function (received) {
                                expect(received.length).toBe(1);
                                var fieldObjects = received[0];
                                var fields = map(fieldObjects, 'text');
                                expect(fields).toEqual([
                                    '@timestamp',
                                    '__timestamp',
                                    '@timestampnano',
                                    'beat.name.raw',
                                    'beat.name',
                                    'beat.hostname',
                                    'system.cpu.system',
                                    'system.cpu.user',
                                    'system.process.cpu.total',
                                    'system.process.name',
                                ]);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should return number fields', function () { return __awaiter(_this, void 0, void 0, function () {
            var ds;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = getTestContext({ data: data, jsonData: { esVersion: 50 }, database: 'metricbeat' }).ds;
                        return [4 /*yield*/, expect(ds.getFields(['number'])).toEmitValuesWith(function (received) {
                                expect(received.length).toBe(1);
                                var fieldObjects = received[0];
                                var fields = map(fieldObjects, 'text');
                                expect(fields).toEqual(['system.cpu.system', 'system.cpu.user', 'system.process.cpu.total']);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should return date fields', function () { return __awaiter(_this, void 0, void 0, function () {
            var ds;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = getTestContext({ data: data, jsonData: { esVersion: 50 }, database: 'metricbeat' }).ds;
                        return [4 /*yield*/, expect(ds.getFields(['date'])).toEmitValuesWith(function (received) {
                                expect(received.length).toBe(1);
                                var fieldObjects = received[0];
                                var fields = map(fieldObjects, 'text');
                                expect(fields).toEqual(['@timestamp', '__timestamp', '@timestampnano']);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When getting field mappings on indices with gaps', function () {
        var basicResponse = {
            metricbeat: {
                mappings: {
                    metricsets: {
                        _all: {},
                        properties: {
                            '@timestamp': { type: 'date' },
                            beat: {
                                properties: {
                                    hostname: { type: 'string' },
                                },
                            },
                        },
                    },
                },
            },
        };
        var alternateResponse = {
            metricbeat: {
                mappings: {
                    metricsets: {
                        _all: {},
                        properties: {
                            '@timestamp': { type: 'date' },
                        },
                    },
                },
            },
        };
        it('should return fields of the newest available index', function () { return __awaiter(_this, void 0, void 0, function () {
            var twoDaysBefore, threeDaysBefore, baseUrl, alternateUrl, _a, ds, timeSrv, range;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        twoDaysBefore = toUtc().subtract(2, 'day').format('YYYY.MM.DD');
                        threeDaysBefore = toUtc().subtract(3, 'day').format('YYYY.MM.DD');
                        baseUrl = ELASTICSEARCH_MOCK_URL + "/asd-" + twoDaysBefore + "/_mapping";
                        alternateUrl = ELASTICSEARCH_MOCK_URL + "/asd-" + threeDaysBefore + "/_mapping";
                        _a = getTestContext({
                            from: 'now-2w',
                            jsonData: { interval: 'Daily', esVersion: 50 },
                            mockImplementation: function (options) {
                                if (options.url === baseUrl) {
                                    return of(createFetchResponse(basicResponse));
                                }
                                else if (options.url === alternateUrl) {
                                    return of(createFetchResponse(alternateResponse));
                                }
                                return throwError({ status: 404 });
                            },
                        }), ds = _a.ds, timeSrv = _a.timeSrv;
                        range = timeSrv.timeRange();
                        return [4 /*yield*/, expect(ds.getFields(undefined, range)).toEmitValuesWith(function (received) {
                                expect(received.length).toBe(1);
                                var fieldObjects = received[0];
                                var fields = map(fieldObjects, 'text');
                                expect(fields).toEqual(['@timestamp', 'beat.hostname']);
                            })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should not retry when ES is down', function () { return __awaiter(_this, void 0, void 0, function () {
            var twoDaysBefore, _a, ds, timeSrv, fetchMock, range;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        twoDaysBefore = toUtc().subtract(2, 'day').format('YYYY.MM.DD');
                        _a = getTestContext({
                            from: 'now-2w',
                            jsonData: { interval: 'Daily', esVersion: 50 },
                            mockImplementation: function (options) {
                                if (options.url === ELASTICSEARCH_MOCK_URL + "/asd-" + twoDaysBefore + "/_mapping") {
                                    return of(createFetchResponse(basicResponse));
                                }
                                return throwError({ status: 500 });
                            },
                        }), ds = _a.ds, timeSrv = _a.timeSrv, fetchMock = _a.fetchMock;
                        range = timeSrv.timeRange();
                        return [4 /*yield*/, expect(ds.getFields(undefined, range)).toEmitValuesWith(function (received) {
                                expect(received.length).toBe(1);
                                expect(received[0]).toStrictEqual({ status: 500 });
                                expect(fetchMock).toBeCalledTimes(1);
                            })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should not retry more than 7 indices', function () { return __awaiter(_this, void 0, void 0, function () {
            var _a, ds, timeSrv, fetchMock, range;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = getTestContext({
                            from: 'now-2w',
                            jsonData: { interval: 'Daily', esVersion: 50 },
                            mockImplementation: function (options) {
                                return throwError({ status: 404 });
                            },
                        }), ds = _a.ds, timeSrv = _a.timeSrv, fetchMock = _a.fetchMock;
                        range = timeSrv.timeRange();
                        return [4 /*yield*/, expect(ds.getFields(undefined, range)).toEmitValuesWith(function (received) {
                                expect(received.length).toBe(1);
                                expect(received[0]).toStrictEqual('Could not find an available index for this time range.');
                                expect(fetchMock).toBeCalledTimes(7);
                            })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When getting fields from ES 7.0', function () {
        var data = {
            'genuine.es7._mapping.response': {
                mappings: {
                    properties: {
                        '@timestamp_millis': {
                            type: 'date',
                            format: 'epoch_millis',
                        },
                        classification_terms: {
                            type: 'keyword',
                        },
                        domains: {
                            type: 'keyword',
                        },
                        ip_address: {
                            type: 'ip',
                        },
                        justification_blob: {
                            properties: {
                                criterion: {
                                    type: 'text',
                                    fields: {
                                        keyword: {
                                            type: 'keyword',
                                            ignore_above: 256,
                                        },
                                    },
                                },
                                overall_vote_score: {
                                    type: 'float',
                                },
                                shallow: {
                                    properties: {
                                        jsi: {
                                            properties: {
                                                sdb: {
                                                    properties: {
                                                        dsel2: {
                                                            properties: {
                                                                'bootlegged-gille': {
                                                                    properties: {
                                                                        botness: {
                                                                            type: 'float',
                                                                        },
                                                                        general_algorithm_score: {
                                                                            type: 'float',
                                                                        },
                                                                    },
                                                                },
                                                                'uncombed-boris': {
                                                                    properties: {
                                                                        botness: {
                                                                            type: 'float',
                                                                        },
                                                                        general_algorithm_score: {
                                                                            type: 'float',
                                                                        },
                                                                    },
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        overall_vote_score: {
                            type: 'float',
                        },
                        ua_terms_long: {
                            type: 'keyword',
                        },
                        ua_terms_short: {
                            type: 'keyword',
                        },
                    },
                },
            },
        };
        var dateFields = ['@timestamp_millis'];
        var numberFields = [
            'justification_blob.overall_vote_score',
            'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.botness',
            'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.general_algorithm_score',
            'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.botness',
            'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.general_algorithm_score',
            'overall_vote_score',
        ];
        it('should return nested fields', function () { return __awaiter(_this, void 0, void 0, function () {
            var ds;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = getTestContext({ data: data, database: 'genuine.es7._mapping.response', jsonData: { esVersion: 70 } }).ds;
                        return [4 /*yield*/, expect(ds.getFields()).toEmitValuesWith(function (received) {
                                expect(received.length).toBe(1);
                                var fieldObjects = received[0];
                                var fields = map(fieldObjects, 'text');
                                expect(fields).toEqual([
                                    '@timestamp_millis',
                                    'classification_terms',
                                    'domains',
                                    'ip_address',
                                    'justification_blob.criterion.keyword',
                                    'justification_blob.criterion',
                                    'justification_blob.overall_vote_score',
                                    'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.botness',
                                    'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.general_algorithm_score',
                                    'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.botness',
                                    'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.general_algorithm_score',
                                    'overall_vote_score',
                                    'ua_terms_long',
                                    'ua_terms_short',
                                ]);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should return number fields', function () { return __awaiter(_this, void 0, void 0, function () {
            var ds;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = getTestContext({ data: data, database: 'genuine.es7._mapping.response', jsonData: { esVersion: 70 } }).ds;
                        return [4 /*yield*/, expect(ds.getFields(['number'])).toEmitValuesWith(function (received) {
                                expect(received.length).toBe(1);
                                var fieldObjects = received[0];
                                var fields = map(fieldObjects, 'text');
                                expect(fields).toEqual(numberFields);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should return date fields', function () { return __awaiter(_this, void 0, void 0, function () {
            var ds;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = getTestContext({ data: data, database: 'genuine.es7._mapping.response', jsonData: { esVersion: 70 } }).ds;
                        return [4 /*yield*/, expect(ds.getFields(['date'])).toEmitValuesWith(function (received) {
                                expect(received.length).toBe(1);
                                var fieldObjects = received[0];
                                var fields = map(fieldObjects, 'text');
                                expect(fields).toEqual(dateFields);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When issuing aggregation query on es5.x', function () {
        function runScenario() {
            return __awaiter(this, void 0, void 0, function () {
                var range, targets, query, data, _a, ds, fetchMock, requestOptions, parts, header, body;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            range = createTimeRange(dateTime([2015, 4, 30, 10]), dateTime([2015, 5, 1, 10]));
                            targets = [
                                {
                                    refId: 'A',
                                    bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '2' }],
                                    metrics: [{ type: 'count', id: '1' }],
                                    query: 'test',
                                },
                            ];
                            query = { range: range, targets: targets };
                            data = { responses: [] };
                            _a = getTestContext({ jsonData: { esVersion: 5 }, data: data, database: 'test' }), ds = _a.ds, fetchMock = _a.fetchMock;
                            return [4 /*yield*/, expect(ds.query(query)).toEmitValuesWith(function (received) {
                                    expect(received.length).toBe(1);
                                    expect(received[0]).toEqual({ data: [] });
                                })];
                        case 1:
                            _b.sent();
                            expect(fetchMock).toHaveBeenCalledTimes(1);
                            requestOptions = fetchMock.mock.calls[0][0];
                            parts = requestOptions.data.split('\n');
                            header = JSON.parse(parts[0]);
                            body = JSON.parse(parts[1]);
                            return [2 /*return*/, { body: body, header: header }];
                    }
                });
            });
        }
        it('should not set search type to count', function () { return __awaiter(_this, void 0, void 0, function () {
            var header;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, runScenario()];
                    case 1:
                        header = (_a.sent()).header;
                        expect(header.search_type).not.toEqual('count');
                        return [2 /*return*/];
                }
            });
        }); });
        it('should set size to 0', function () { return __awaiter(_this, void 0, void 0, function () {
            var body;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, runScenario()];
                    case 1:
                        body = (_a.sent()).body;
                        expect(body.size).toBe(0);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When issuing metricFind query on es5.x', function () {
        function runScenario() {
            return __awaiter(this, void 0, void 0, function () {
                var data, _a, ds, fetchMock, results, requestOptions, parts, header, body;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            data = {
                                responses: [
                                    {
                                        aggregations: {
                                            '1': {
                                                buckets: [
                                                    { doc_count: 1, key: 'test' },
                                                    {
                                                        doc_count: 2,
                                                        key: 'test2',
                                                        key_as_string: 'test2_as_string',
                                                    },
                                                ],
                                            },
                                        },
                                    },
                                ],
                            };
                            _a = getTestContext({ jsonData: { esVersion: 5 }, data: data, database: 'test' }), ds = _a.ds, fetchMock = _a.fetchMock;
                            return [4 /*yield*/, ds.metricFindQuery('{"find": "terms", "field": "test"}')];
                        case 1:
                            results = _b.sent();
                            expect(fetchMock).toHaveBeenCalledTimes(1);
                            requestOptions = fetchMock.mock.calls[0][0];
                            parts = requestOptions.data.split('\n');
                            header = JSON.parse(parts[0]);
                            body = JSON.parse(parts[1]);
                            return [2 /*return*/, { results: results, body: body, header: header }];
                    }
                });
            });
        }
        it('should get results', function () { return __awaiter(_this, void 0, void 0, function () {
            var results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, runScenario()];
                    case 1:
                        results = (_a.sent()).results;
                        expect(results.length).toEqual(2);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should use key or key_as_string', function () { return __awaiter(_this, void 0, void 0, function () {
            var results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, runScenario()];
                    case 1:
                        results = (_a.sent()).results;
                        expect(results[0].text).toEqual('test');
                        expect(results[1].text).toEqual('test2_as_string');
                        return [2 /*return*/];
                }
            });
        }); });
        it('should not set search type to count', function () { return __awaiter(_this, void 0, void 0, function () {
            var header;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, runScenario()];
                    case 1:
                        header = (_a.sent()).header;
                        expect(header.search_type).not.toEqual('count');
                        return [2 /*return*/];
                }
            });
        }); });
        it('should set size to 0', function () { return __awaiter(_this, void 0, void 0, function () {
            var body;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, runScenario()];
                    case 1:
                        body = (_a.sent()).body;
                        expect(body.size).toBe(0);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should not set terms aggregation size to 0', function () { return __awaiter(_this, void 0, void 0, function () {
            var body;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, runScenario()];
                    case 1:
                        body = (_a.sent()).body;
                        expect(body['aggs']['1']['terms'].size).not.toBe(0);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('query', function () {
        it('should replace range as integer not string', function () { return __awaiter(_this, void 0, void 0, function () {
            var ds, postMock;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = getTestContext({ jsonData: { interval: 'Daily', esVersion: 2, timeField: '@time' } }).ds;
                        postMock = jest.fn(function (url, data) { return of(createFetchResponse({ responses: [] })); });
                        ds['post'] = postMock;
                        return [4 /*yield*/, expect(ds.query(createElasticQuery())).toEmitValuesWith(function (received) {
                                expect(postMock).toHaveBeenCalledTimes(1);
                                var query = postMock.mock.calls[0][1];
                                expect(typeof JSON.parse(query.split('\n')[1]).query.bool.filter[0].range['@time'].gte).toBe('number');
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    it('should correctly interpolate variables in query', function () {
        var ds = getTestContext().ds;
        var query = {
            refId: 'A',
            bucketAggs: [{ type: 'filters', settings: { filters: [{ query: '$var', label: '' }] }, id: '1' }],
            metrics: [{ type: 'count', id: '1' }],
            query: '$var',
        };
        var interpolatedQuery = ds.interpolateVariablesInQueries([query], {})[0];
        expect(interpolatedQuery.query).toBe('resolvedVariable');
        expect(interpolatedQuery.bucketAggs[0].settings.filters[0].query).toBe('resolvedVariable');
    });
    it('should correctly handle empty query strings', function () {
        var ds = getTestContext().ds;
        var query = {
            refId: 'A',
            bucketAggs: [{ type: 'filters', settings: { filters: [{ query: '', label: '' }] }, id: '1' }],
            metrics: [{ type: 'count', id: '1' }],
            query: '',
        };
        var interpolatedQuery = ds.interpolateVariablesInQueries([query], {})[0];
        expect(interpolatedQuery.query).toBe('*');
        expect(interpolatedQuery.bucketAggs[0].settings.filters[0].query).toBe('*');
    });
});
describe('getMultiSearchUrl', function () {
    describe('When esVersion >= 6.6.0', function () {
        it('Should add correct params to URL if "includeFrozen" is enabled', function () {
            var ds = getTestContext({ jsonData: { esVersion: '6.6.0', includeFrozen: true, xpack: true } }).ds;
            expect(ds.getMultiSearchUrl()).toMatch(/ignore_throttled=false/);
        });
        it('Should NOT add ignore_throttled if "includeFrozen" is disabled', function () {
            var ds = getTestContext({ jsonData: { esVersion: '6.6.0', includeFrozen: false, xpack: true } }).ds;
            expect(ds.getMultiSearchUrl()).not.toMatch(/ignore_throttled=false/);
        });
        it('Should NOT add ignore_throttled if "xpack" is disabled', function () {
            var ds = getTestContext({ jsonData: { esVersion: '6.6.0', includeFrozen: true, xpack: false } }).ds;
            expect(ds.getMultiSearchUrl()).not.toMatch(/ignore_throttled=false/);
        });
    });
    describe('When esVersion < 6.6.0', function () {
        it('Should NOT add ignore_throttled params regardless of includeFrozen', function () {
            var dsWithIncludeFrozen = getTestContext({
                jsonData: { esVersion: '5.6.0', includeFrozen: false, xpack: true },
            }).ds;
            var dsWithoutIncludeFrozen = getTestContext({
                jsonData: { esVersion: '5.6.0', includeFrozen: true, xpack: true },
            }).ds;
            expect(dsWithIncludeFrozen.getMultiSearchUrl()).not.toMatch(/ignore_throttled=false/);
            expect(dsWithoutIncludeFrozen.getMultiSearchUrl()).not.toMatch(/ignore_throttled=false/);
        });
    });
});
describe('enhanceDataFrame', function () {
    it('adds links to dataframe', function () {
        var df = new MutableDataFrame({
            fields: [
                {
                    name: 'urlField',
                    values: new ArrayVector([]),
                },
                {
                    name: 'traceField',
                    values: new ArrayVector([]),
                },
            ],
        });
        enhanceDataFrame(df, [
            {
                field: 'urlField',
                url: 'someUrl',
            },
            {
                field: 'traceField',
                url: 'query',
                datasourceUid: 'dsUid',
            },
        ]);
        expect(df.fields[0].config.links.length).toBe(1);
        expect(df.fields[0].config.links[0]).toEqual({
            title: '',
            url: 'someUrl',
        });
        expect(df.fields[1].config.links.length).toBe(1);
        expect(df.fields[1].config.links[0]).toEqual({
            title: '',
            url: '',
            internal: {
                query: { query: 'query' },
                datasourceName: 'elastic25',
                datasourceUid: 'dsUid',
            },
        });
    });
    it('adds limit to dataframe', function () {
        var _a;
        var df = new MutableDataFrame({
            fields: [
                {
                    name: 'someField',
                    values: new ArrayVector([]),
                },
            ],
        });
        enhanceDataFrame(df, [], 10);
        expect((_a = df.meta) === null || _a === void 0 ? void 0 : _a.limit).toBe(10);
    });
});
var createElasticQuery = function () {
    return {
        requestId: '',
        dashboardId: 0,
        interval: '',
        panelId: 0,
        intervalMs: 1,
        scopedVars: {},
        timezone: '',
        app: CoreApp.Dashboard,
        startTime: 0,
        range: {
            from: dateTime([2015, 4, 30, 10]),
            to: dateTime([2015, 5, 1, 10]),
        },
        targets: [
            {
                refId: '',
                bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '2' }],
                metrics: [{ type: 'count', id: '' }],
                query: 'test',
            },
        ],
    };
};
var logsResponse = {
    data: {
        responses: [
            {
                aggregations: {
                    '2': {
                        buckets: [
                            {
                                doc_count: 10,
                                key: 1000,
                            },
                            {
                                doc_count: 15,
                                key: 2000,
                            },
                        ],
                    },
                },
                hits: {
                    hits: [
                        {
                            '@timestamp': ['2019-06-24T09:51:19.765Z'],
                            _id: 'fdsfs',
                            _type: '_doc',
                            _index: 'mock-index',
                            _source: {
                                '@timestamp': '2019-06-24T09:51:19.765Z',
                                host: 'djisaodjsoad',
                                message: 'hello, i am a message',
                            },
                            fields: {
                                '@timestamp': ['2019-06-24T09:51:19.765Z'],
                            },
                        },
                        {
                            '@timestamp': ['2019-06-24T09:52:19.765Z'],
                            _id: 'kdospaidopa',
                            _type: '_doc',
                            _index: 'mock-index',
                            _source: {
                                '@timestamp': '2019-06-24T09:52:19.765Z',
                                host: 'dsalkdakdop',
                                message: 'hello, i am also message',
                            },
                            fields: {
                                '@timestamp': ['2019-06-24T09:52:19.765Z'],
                            },
                        },
                    ],
                },
            },
        ],
    },
};
//# sourceMappingURL=datasource.test.js.map