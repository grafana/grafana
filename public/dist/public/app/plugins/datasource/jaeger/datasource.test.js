import { __assign, __awaiter, __generator } from "tslib";
import { lastValueFrom, of, throwError } from 'rxjs';
import { dateTime, FieldType, PluginType } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv';
import { createFetchResponse } from 'test/helpers/createFetchResponse';
import { ALL_OPERATIONS_KEY } from './components/SearchForm';
import { JaegerDatasource } from './datasource';
import mockJson from './mockJsonResponse.json';
import { testResponse, testResponseDataFrameFields, testResponseEdgesFields, testResponseNodesFields, } from './testResponse';
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: function () { return backendSrv; } })); });
var timeSrvStub = {
    timeRange: function () {
        return {
            from: dateTime(1531468681),
            to: dateTime(1531489712),
        };
    },
};
describe('JaegerDatasource', function () {
    beforeEach(function () {
        jest.clearAllMocks();
    });
    it('returns trace and graph when queried', function () { return __awaiter(void 0, void 0, void 0, function () {
        var ds, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setupFetchMock({ data: [testResponse] });
                    ds = new JaegerDatasource(defaultSettings);
                    return [4 /*yield*/, lastValueFrom(ds.query(defaultQuery))];
                case 1:
                    response = _a.sent();
                    expect(response.data.length).toBe(3);
                    expect(response.data[0].fields).toMatchObject(testResponseDataFrameFields);
                    expect(response.data[1].fields).toMatchObject(testResponseNodesFields);
                    expect(response.data[2].fields).toMatchObject(testResponseEdgesFields);
                    return [2 /*return*/];
            }
        });
    }); });
    it('returns trace when traceId with special characters is queried', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mock, ds, query;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mock = setupFetchMock({ data: [testResponse] });
                    ds = new JaegerDatasource(defaultSettings);
                    query = __assign(__assign({}, defaultQuery), { targets: [
                            {
                                query: 'a/b',
                                refId: '1',
                            },
                        ] });
                    return [4 /*yield*/, lastValueFrom(ds.query(query))];
                case 1:
                    _a.sent();
                    expect(mock).toBeCalledWith({ url: defaultSettings.url + "/api/traces/a%2Fb" });
                    return [2 /*return*/];
            }
        });
    }); });
    it('returns empty response if trace id is not specified', function () { return __awaiter(void 0, void 0, void 0, function () {
        var ds, response, field;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ds = new JaegerDatasource(defaultSettings);
                    return [4 /*yield*/, lastValueFrom(ds.query(__assign(__assign({}, defaultQuery), { targets: [] })))];
                case 1:
                    response = _a.sent();
                    field = response.data[0].fields[0];
                    expect(field.name).toBe('trace');
                    expect(field.type).toBe(FieldType.trace);
                    expect(field.values.length).toBe(0);
                    return [2 /*return*/];
            }
        });
    }); });
    it('should handle json file upload', function () { return __awaiter(void 0, void 0, void 0, function () {
        var ds, response, field;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ds = new JaegerDatasource(defaultSettings);
                    ds.uploadedJson = JSON.stringify(mockJson);
                    return [4 /*yield*/, lastValueFrom(ds.query(__assign(__assign({}, defaultQuery), { targets: [{ queryType: 'upload', refId: 'A' }] })))];
                case 1:
                    response = _a.sent();
                    field = response.data[0].fields[0];
                    expect(field.name).toBe('traceID');
                    expect(field.type).toBe(FieldType.string);
                    expect(field.values.length).toBe(2);
                    return [2 /*return*/];
            }
        });
    }); });
    it('should fail on invalid json file upload', function () { return __awaiter(void 0, void 0, void 0, function () {
        var ds, response;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    ds = new JaegerDatasource(defaultSettings);
                    ds.uploadedJson = JSON.stringify({ key: 'value', arr: [] });
                    return [4 /*yield*/, lastValueFrom(ds.query({
                            targets: [{ queryType: 'upload', refId: 'A' }],
                        }))];
                case 1:
                    response = _b.sent();
                    expect((_a = response.error) === null || _a === void 0 ? void 0 : _a.message).toBeDefined();
                    expect(response.data.length).toBe(0);
                    return [2 /*return*/];
            }
        });
    }); });
    it('should return search results when the query type is search', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mock, ds, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mock = setupFetchMock({ data: [testResponse] });
                    ds = new JaegerDatasource(defaultSettings, timeSrvStub);
                    return [4 /*yield*/, lastValueFrom(ds.query(__assign(__assign({}, defaultQuery), { targets: [{ queryType: 'search', refId: 'a', service: 'jaeger-query', operation: '/api/services' }] })))];
                case 1:
                    response = _a.sent();
                    expect(mock).toBeCalledWith({
                        url: defaultSettings.url + "/api/traces?operation=%2Fapi%2Fservices&service=jaeger-query&start=1531468681000&end=1531489712000&lookback=custom",
                    });
                    expect(response.data[0].meta.preferredVisualisationType).toBe('table');
                    // Make sure that traceID field has data link configured
                    expect(response.data[0].fields[0].config.links).toHaveLength(1);
                    expect(response.data[0].fields[0].name).toBe('traceID');
                    return [2 /*return*/];
            }
        });
    }); });
    it('should remove operation from the query when all is selected', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mock, ds;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mock = setupFetchMock({ data: [testResponse] });
                    ds = new JaegerDatasource(defaultSettings, timeSrvStub);
                    return [4 /*yield*/, lastValueFrom(ds.query(__assign(__assign({}, defaultQuery), { targets: [{ queryType: 'search', refId: 'a', service: 'jaeger-query', operation: ALL_OPERATIONS_KEY }] })))];
                case 1:
                    _a.sent();
                    expect(mock).toBeCalledWith({
                        url: defaultSettings.url + "/api/traces?service=jaeger-query&start=1531468681000&end=1531489712000&lookback=custom",
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    it('should convert tags from logfmt format to an object', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mock, ds;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mock = setupFetchMock({ data: [testResponse] });
                    ds = new JaegerDatasource(defaultSettings, timeSrvStub);
                    return [4 /*yield*/, lastValueFrom(ds.query(__assign(__assign({}, defaultQuery), { targets: [{ queryType: 'search', refId: 'a', service: 'jaeger-query', tags: 'error=true' }] })))];
                case 1:
                    _a.sent();
                    expect(mock).toBeCalledWith({
                        url: defaultSettings.url + "/api/traces?service=jaeger-query&tags=%7B%22error%22%3A%22true%22%7D&start=1531468681000&end=1531489712000&lookback=custom",
                    });
                    return [2 /*return*/];
            }
        });
    }); });
});
describe('when performing testDataSource', function () {
    describe('and call succeeds', function () {
        it('should return successfully', function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        setupFetchMock({ data: ['service1'] });
                        ds = new JaegerDatasource(defaultSettings);
                        return [4 /*yield*/, ds.testDatasource()];
                    case 1:
                        response = _a.sent();
                        expect(response.status).toEqual('success');
                        expect(response.message).toBe('Data source connected and services found.');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('and call succeeds, but returns no services', function () {
        it('should display an error', function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        setupFetchMock(undefined);
                        ds = new JaegerDatasource(defaultSettings);
                        return [4 /*yield*/, ds.testDatasource()];
                    case 1:
                        response = _a.sent();
                        expect(response.status).toEqual('error');
                        expect(response.message).toBe('Data source connected, but no services received. Verify that Jaeger is configured properly.');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('and call returns error with message', function () {
        it('should return the formatted error', function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        setupFetchMock(undefined, throwError({
                            statusText: 'Not found',
                            status: 404,
                            data: {
                                message: '404 page not found',
                            },
                        }));
                        ds = new JaegerDatasource(defaultSettings);
                        return [4 /*yield*/, ds.testDatasource()];
                    case 1:
                        response = _a.sent();
                        expect(response.status).toEqual('error');
                        expect(response.message).toBe('Jaeger: Not found. 404. 404 page not found');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('and call returns error without message', function () {
        it('should return JSON error', function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        setupFetchMock(undefined, throwError({
                            statusText: 'Bad gateway',
                            status: 502,
                            data: {
                                errors: ['Could not connect to Jaeger backend'],
                            },
                        }));
                        ds = new JaegerDatasource(defaultSettings);
                        return [4 /*yield*/, ds.testDatasource()];
                    case 1:
                        response = _a.sent();
                        expect(response.status).toEqual('error');
                        expect(response.message).toBe('Jaeger: Bad gateway. 502. {"errors":["Could not connect to Jaeger backend"]}');
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
function setupFetchMock(response, mock) {
    var defaultMock = function () { return mock !== null && mock !== void 0 ? mock : of(createFetchResponse(response)); };
    var fetchMock = jest.spyOn(backendSrv, 'fetch');
    fetchMock.mockImplementation(defaultMock);
    return fetchMock;
}
var defaultSettings = {
    id: 0,
    uid: '0',
    type: 'tracing',
    name: 'jaeger',
    url: 'http://grafana.com',
    access: 'proxy',
    meta: {
        id: 'jaeger',
        name: 'jaeger',
        type: PluginType.datasource,
        info: {},
        module: '',
        baseUrl: '',
    },
    jsonData: {
        nodeGraph: {
            enabled: true,
        },
    },
};
var defaultQuery = {
    requestId: '1',
    dashboardId: 0,
    interval: '0',
    intervalMs: 10,
    panelId: 0,
    scopedVars: {},
    range: {
        from: dateTime().subtract(1, 'h'),
        to: dateTime(),
        raw: { from: '1h', to: 'now' },
    },
    timezone: 'browser',
    app: 'explore',
    startTime: 0,
    targets: [
        {
            query: '12345',
            refId: '1',
        },
    ],
};
//# sourceMappingURL=datasource.test.js.map