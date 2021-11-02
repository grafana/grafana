import { __assign, __awaiter, __generator } from "tslib";
import { lastValueFrom, of } from 'rxjs';
import { dataFrameToJSON, FieldType, getDefaultTimeRange, LoadingState, MutableDataFrame, PluginType, } from '@grafana/data';
import { createFetchResponse } from 'test/helpers/createFetchResponse';
import { setBackendSrv, setDataSourceSrv } from '@grafana/runtime';
import { DEFAULT_LIMIT, TempoDatasource } from './datasource';
import mockJson from './mockJsonResponse.json';
describe('Tempo data source', function () {
    it('parses json fields from backend', function () { return __awaiter(void 0, void 0, void 0, function () {
        var ds, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setupBackendSrv(new MutableDataFrame({
                        fields: [
                            { name: 'traceID', values: ['04450900759028499335'] },
                            { name: 'spanID', values: ['4322526419282105830'] },
                            { name: 'parentSpanID', values: [''] },
                            { name: 'operationName', values: ['store.validateQueryTimeRange'] },
                            { name: 'startTime', values: [1619712655875.4539] },
                            { name: 'duration', values: [14.984] },
                            { name: 'serviceTags', values: ['{"key":"servicetag1","value":"service"}'] },
                            { name: 'logs', values: ['{"timestamp":12345,"fields":[{"key":"count","value":1}]}'] },
                            { name: 'tags', values: ['{"key":"tag1","value":"val1"}'] },
                            { name: 'serviceName', values: ['service'] },
                        ],
                    }));
                    ds = new TempoDatasource(defaultSettings);
                    return [4 /*yield*/, lastValueFrom(ds.query({ targets: [{ refId: 'refid1' }] }))];
                case 1:
                    response = _a.sent();
                    expect(response.data[0].fields.map(function (f) { return ({
                        name: f.name,
                        values: f.values.toArray(),
                    }); })).toMatchObject([
                        { name: 'traceID', values: ['04450900759028499335'] },
                        { name: 'spanID', values: ['4322526419282105830'] },
                        { name: 'parentSpanID', values: [''] },
                        { name: 'operationName', values: ['store.validateQueryTimeRange'] },
                        { name: 'startTime', values: [1619712655875.4539] },
                        { name: 'duration', values: [14.984] },
                        { name: 'serviceTags', values: [{ key: 'servicetag1', value: 'service' }] },
                        { name: 'logs', values: [{ timestamp: 12345, fields: [{ key: 'count', value: 1 }] }] },
                        { name: 'tags', values: [{ key: 'tag1', value: 'val1' }] },
                        { name: 'serviceName', values: ['service'] },
                    ]);
                    expect(response.data[1].fields.map(function (f) { return ({
                        name: f.name,
                        values: f.values.toArray(),
                    }); })).toMatchObject([
                        { name: 'id', values: ['4322526419282105830'] },
                        { name: 'title', values: ['service'] },
                        { name: 'subTitle', values: ['store.validateQueryTimeRange'] },
                        { name: 'mainStat', values: ['14.98ms (100%)'] },
                        { name: 'secondaryStat', values: ['14.98ms (100%)'] },
                        { name: 'color', values: [1.000007560204647] },
                    ]);
                    expect(response.data[2].fields.map(function (f) { return ({
                        name: f.name,
                        values: f.values.toArray(),
                    }); })).toMatchObject([
                        { name: 'id', values: [] },
                        { name: 'target', values: [] },
                        { name: 'source', values: [] },
                    ]);
                    return [2 /*return*/];
            }
        });
    }); });
    it('runs service graph queries', function () { return __awaiter(void 0, void 0, void 0, function () {
        var ds, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ds = new TempoDatasource(__assign(__assign({}, defaultSettings), { jsonData: {
                            serviceMap: {
                                datasourceUid: 'prom',
                            },
                        } }));
                    setDataSourceSrv(backendSrvWithPrometheus);
                    return [4 /*yield*/, lastValueFrom(ds.query({ targets: [{ queryType: 'serviceMap' }], range: getDefaultTimeRange() }))];
                case 1:
                    response = _a.sent();
                    expect(response.data).toHaveLength(2);
                    expect(response.data[0].name).toBe('Nodes');
                    expect(response.data[0].fields[0].values.length).toBe(3);
                    expect(response.data[1].name).toBe('Edges');
                    expect(response.data[1].fields[0].values.length).toBe(2);
                    expect(response.state).toBe(LoadingState.Done);
                    return [2 /*return*/];
            }
        });
    }); });
    it('should handle json file upload', function () { return __awaiter(void 0, void 0, void 0, function () {
        var ds, response, field;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ds = new TempoDatasource(defaultSettings);
                    ds.uploadedJson = JSON.stringify(mockJson);
                    return [4 /*yield*/, lastValueFrom(ds.query({
                            targets: [{ queryType: 'upload', refId: 'A' }],
                        }))];
                case 1:
                    response = _a.sent();
                    field = response.data[0].fields[0];
                    expect(field.name).toBe('traceID');
                    expect(field.type).toBe(FieldType.string);
                    expect(field.values.get(0)).toBe('60ba2abb44f13eae');
                    expect(field.values.length).toBe(6);
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
                    ds = new TempoDatasource(defaultSettings);
                    ds.uploadedJson = JSON.stringify(mockInvalidJson);
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
    it('should build search query correctly', function () {
        var ds = new TempoDatasource(defaultSettings);
        var tempoQuery = {
            queryType: 'search',
            refId: 'A',
            query: '',
            serviceName: 'frontend',
            spanName: '/config',
            search: 'root.http.status_code=500',
            minDuration: '1ms',
            maxDuration: '100s',
            limit: 10,
        };
        var builtQuery = ds.buildSearchQuery(tempoQuery);
        expect(builtQuery).toStrictEqual({
            'service.name': 'frontend',
            name: '/config',
            'root.http.status_code': '500',
            minDuration: '1ms',
            maxDuration: '100s',
            limit: 10,
        });
    });
    it('should include a default limit', function () {
        var ds = new TempoDatasource(defaultSettings);
        var tempoQuery = {
            queryType: 'search',
            refId: 'A',
            query: '',
            search: '',
        };
        var builtQuery = ds.buildSearchQuery(tempoQuery);
        expect(builtQuery).toStrictEqual({
            limit: DEFAULT_LIMIT,
        });
    });
    it('should ignore incomplete tag queries', function () {
        var ds = new TempoDatasource(defaultSettings);
        var tempoQuery = {
            queryType: 'search',
            refId: 'A',
            query: '',
            search: 'root.ip root.http.status_code=500',
        };
        var builtQuery = ds.buildSearchQuery(tempoQuery);
        expect(builtQuery).toStrictEqual({
            limit: DEFAULT_LIMIT,
            'root.http.status_code': '500',
        });
    });
    it('formats native search query history correctly', function () {
        var ds = new TempoDatasource(defaultSettings);
        var tempoQuery = {
            queryType: 'nativeSearch',
            refId: 'A',
            query: '',
            serviceName: 'frontend',
            spanName: '/config',
            search: 'root.http.status_code=500',
            minDuration: '1ms',
            maxDuration: '100s',
            limit: 10,
        };
        var result = ds.getQueryDisplayText(tempoQuery);
        expect(result).toBe('Service Name: frontend, Span Name: /config, Search: root.http.status_code=500, Min Duration: 1ms, Max Duration: 100s, Limit: 10');
    });
});
var backendSrvWithPrometheus = {
    get: function (uid) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (uid === 'prom') {
                    return [2 /*return*/, {
                            query: function () {
                                return of({ data: [totalsPromMetric, secondsPromMetric, failedPromMetric] });
                            },
                        }];
                }
                throw new Error('unexpected uid');
            });
        });
    },
};
function setupBackendSrv(frame) {
    setBackendSrv({
        fetch: function () {
            return of(createFetchResponse({
                results: {
                    refid1: {
                        frames: [dataFrameToJSON(frame)],
                    },
                },
            }));
        },
    });
}
var defaultSettings = {
    id: 0,
    uid: '0',
    type: 'tracing',
    name: 'tempo',
    access: 'proxy',
    meta: {
        id: 'tempo',
        name: 'tempo',
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
var totalsPromMetric = new MutableDataFrame({
    refId: 'traces_service_graph_request_total',
    fields: [
        { name: 'Time', values: [1628169788000, 1628169788000] },
        { name: 'client', values: ['app', 'lb'] },
        { name: 'instance', values: ['127.0.0.1:12345', '127.0.0.1:12345'] },
        { name: 'job', values: ['local_scrape', 'local_scrape'] },
        { name: 'server', values: ['db', 'app'] },
        { name: 'tempo_config', values: ['default', 'default'] },
        { name: 'Value #traces_service_graph_request_total', values: [10, 20] },
    ],
});
var secondsPromMetric = new MutableDataFrame({
    refId: 'traces_service_graph_request_server_seconds_sum',
    fields: [
        { name: 'Time', values: [1628169788000, 1628169788000] },
        { name: 'client', values: ['app', 'lb'] },
        { name: 'instance', values: ['127.0.0.1:12345', '127.0.0.1:12345'] },
        { name: 'job', values: ['local_scrape', 'local_scrape'] },
        { name: 'server', values: ['db', 'app'] },
        { name: 'tempo_config', values: ['default', 'default'] },
        { name: 'Value #traces_service_graph_request_server_seconds_sum', values: [10, 40] },
    ],
});
var failedPromMetric = new MutableDataFrame({
    refId: 'traces_service_graph_request_failed_total',
    fields: [
        { name: 'Time', values: [1628169788000, 1628169788000] },
        { name: 'client', values: ['app', 'lb'] },
        { name: 'instance', values: ['127.0.0.1:12345', '127.0.0.1:12345'] },
        { name: 'job', values: ['local_scrape', 'local_scrape'] },
        { name: 'server', values: ['db', 'app'] },
        { name: 'tempo_config', values: ['default', 'default'] },
        { name: 'Value #traces_service_graph_request_failed_total', values: [2, 15] },
    ],
});
var mockInvalidJson = {
    batches: [
        {
            resource: {
                attributes: [],
            },
            instrumentation_library_spans: [
                {
                    instrumentation_library: {},
                    spans: [
                        {
                            trace_id: 'AAAAAAAAAABguiq7RPE+rg==',
                            span_id: 'cmteMBAvwNA=',
                            parentSpanId: 'OY8PIaPbma4=',
                            name: 'HTTP GET - root',
                            kind: 'SPAN_KIND_SERVER',
                            startTimeUnixNano: '1627471657255809000',
                            endTimeUnixNano: '1627471657256268000',
                            attributes: [
                                { key: 'http.status_code', value: { intValue: '200' } },
                                { key: 'http.method', value: { stringValue: 'GET' } },
                                { key: 'http.url', value: { stringValue: '/' } },
                                { key: 'component', value: { stringValue: 'net/http' } },
                            ],
                            status: {},
                        },
                    ],
                },
            ],
        },
    ],
};
//# sourceMappingURL=datasource.test.js.map