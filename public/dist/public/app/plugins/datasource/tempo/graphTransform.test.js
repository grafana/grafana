import { __assign, __awaiter, __generator, __read } from "tslib";
import { createGraphFrames, mapPromMetricsToServiceMap } from './graphTransform';
import { bigResponse } from './testResponse';
import { ArrayVector, DataFrameView, dateTime, MutableDataFrame } from '@grafana/data';
describe('createGraphFrames', function () {
    it('transforms basic response into nodes and edges frame', function () { return __awaiter(void 0, void 0, void 0, function () {
        var frames, view;
        return __generator(this, function (_a) {
            frames = createGraphFrames(bigResponse);
            expect(frames.length).toBe(2);
            expect(frames[0].length).toBe(30);
            expect(frames[1].length).toBe(29);
            view = new DataFrameView(frames[0]);
            expect(view.get(0)).toMatchObject({
                id: '4322526419282105830',
                title: 'loki-all',
                subTitle: 'store.validateQueryTimeRange',
                mainStat: '0ms (0.02%)',
                secondaryStat: '0ms (100%)',
                color: 0.00021968356127648162,
            });
            expect(view.get(29)).toMatchObject({
                id: '4450900759028499335',
                title: 'loki-all',
                subTitle: 'HTTP GET - loki_api_v1_query_range',
                mainStat: '18.21ms (100%)',
                secondaryStat: '3.22ms (17.71%)',
                color: 0.17707117189595056,
            });
            view = new DataFrameView(frames[1]);
            expect(view.get(28)).toMatchObject({
                id: '4450900759028499335--4790760741274015949',
            });
            return [2 /*return*/];
        });
    }); });
    it('handles single span response', function () { return __awaiter(void 0, void 0, void 0, function () {
        var frames, view;
        return __generator(this, function (_a) {
            frames = createGraphFrames(singleSpanResponse);
            expect(frames.length).toBe(2);
            expect(frames[0].length).toBe(1);
            view = new DataFrameView(frames[0]);
            expect(view.get(0)).toMatchObject({
                id: '4322526419282105830',
                title: 'loki-all',
                subTitle: 'store.validateQueryTimeRange',
                mainStat: '14.98ms (100%)',
                secondaryStat: '14.98ms (100%)',
                color: 1.000007560204647,
            });
            return [2 /*return*/];
        });
    }); });
    it('handles missing spans', function () { return __awaiter(void 0, void 0, void 0, function () {
        var frames;
        return __generator(this, function (_a) {
            frames = createGraphFrames(missingSpanResponse);
            expect(frames.length).toBe(2);
            expect(frames[0].length).toBe(2);
            expect(frames[1].length).toBe(0);
            return [2 /*return*/];
        });
    }); });
});
describe('mapPromMetricsToServiceMap', function () {
    it('transforms prom metrics to service graph', function () { return __awaiter(void 0, void 0, void 0, function () {
        var range, _a, nodes, edges;
        return __generator(this, function (_b) {
            range = {
                from: dateTime('2000-01-01T00:00:00'),
                to: dateTime('2000-01-01T00:01:00'),
            };
            _a = __read(mapPromMetricsToServiceMap([{ data: [totalsPromMetric, secondsPromMetric, failedPromMetric] }], __assign(__assign({}, range), { raw: range })), 2), nodes = _a[0], edges = _a[1];
            expect(nodes.fields).toMatchObject([
                { name: 'id', values: new ArrayVector(['db', 'app', 'lb']) },
                { name: 'title', values: new ArrayVector(['db', 'app', 'lb']) },
                { name: 'mainStat', values: new ArrayVector([1000, 2000, NaN]) },
                { name: 'secondaryStat', values: new ArrayVector([0.17, 0.33, NaN]) },
                { name: 'arc__success', values: new ArrayVector([0.8, 0.25, 1]) },
                { name: 'arc__failed', values: new ArrayVector([0.2, 0.75, 0]) },
            ]);
            expect(edges.fields).toMatchObject([
                { name: 'id', values: new ArrayVector(['app_db', 'lb_app']) },
                { name: 'source', values: new ArrayVector(['app', 'lb']) },
                { name: 'target', values: new ArrayVector(['db', 'app']) },
                { name: 'mainStat', values: new ArrayVector([10, 20]) },
                { name: 'secondaryStat', values: new ArrayVector([1000, 2000]) },
            ]);
            return [2 /*return*/];
        });
    }); });
});
var singleSpanResponse = new MutableDataFrame({
    fields: [
        { name: 'traceID', values: ['04450900759028499335'] },
        { name: 'spanID', values: ['4322526419282105830'] },
        { name: 'parentSpanID', values: [''] },
        { name: 'operationName', values: ['store.validateQueryTimeRange'] },
        { name: 'serviceName', values: ['loki-all'] },
        { name: 'startTime', values: [1619712655875.4539] },
        { name: 'duration', values: [14.984] },
    ],
});
var missingSpanResponse = new MutableDataFrame({
    fields: [
        { name: 'traceID', values: ['04450900759028499335', '04450900759028499335'] },
        { name: 'spanID', values: ['1', '2'] },
        { name: 'parentSpanID', values: ['', '3'] },
        { name: 'operationName', values: ['store.validateQueryTimeRange', 'store.validateQueryTimeRange'] },
        { name: 'serviceName', values: ['loki-all', 'loki-all'] },
        { name: 'startTime', values: [1619712655875.4539, 1619712655880.4539] },
        { name: 'duration', values: [14.984, 4.984] },
    ],
});
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
//# sourceMappingURL=graphTransform.test.js.map