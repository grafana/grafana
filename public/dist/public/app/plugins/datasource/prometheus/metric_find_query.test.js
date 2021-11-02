import { __assign, __awaiter, __generator } from "tslib";
import 'whatwg-fetch'; // fetch polyfill needed backendSrv
import { of } from 'rxjs';
import { toUtc } from '@grafana/data';
import { PrometheusDatasource } from './datasource';
import PrometheusMetricFindQuery from './metric_find_query';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: function () { return backendSrv; } })); });
var fetchMock = jest.spyOn(backendSrv, 'fetch');
var instanceSettings = {
    url: 'proxied',
    directUrl: 'direct',
    user: 'test',
    password: 'mupp',
    jsonData: { httpMethod: 'GET' },
};
var raw = {
    from: toUtc('2018-04-25 10:00'),
    to: toUtc('2018-04-25 11:00'),
};
jest.mock('app/features/dashboard/services/TimeSrv', function () { return ({
    __esModule: true,
    getTimeSrv: jest.fn().mockReturnValue({
        timeRange: function () {
            return {
                from: raw.from,
                to: raw.to,
                raw: raw,
            };
        },
    }),
}); });
var templateSrvStub = {
    getAdhocFilters: jest.fn(function () { return []; }),
    replace: jest.fn(function (a) { return a; }),
};
beforeEach(function () {
    jest.clearAllMocks();
});
describe('PrometheusMetricFindQuery', function () {
    var ds;
    beforeEach(function () {
        ds = new PrometheusDatasource(instanceSettings, templateSrvStub);
    });
    var setupMetricFindQuery = function (data) {
        fetchMock.mockImplementation(function () { return of({ status: 'success', data: data.response }); });
        return new PrometheusMetricFindQuery(ds, data.query);
    };
    describe('When performing metricFindQuery', function () {
        it('label_names() should generate label name search query', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = setupMetricFindQuery({
                            query: 'label_names()',
                            response: {
                                data: ['name1', 'name2', 'name3'],
                            },
                        });
                        return [4 /*yield*/, query.process()];
                    case 1:
                        results = _a.sent();
                        expect(results).toHaveLength(3);
                        expect(fetchMock).toHaveBeenCalledTimes(1);
                        expect(fetchMock).toHaveBeenCalledWith({
                            method: 'GET',
                            url: "proxied/api/v1/labels?start=" + raw.from.unix() + "&end=" + raw.to.unix(),
                            hideFromInspector: true,
                            headers: {},
                        });
                        return [2 /*return*/];
                }
            });
        }); });
        it('label_values(resource) should generate label search query', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = setupMetricFindQuery({
                            query: 'label_values(resource)',
                            response: {
                                data: ['value1', 'value2', 'value3'],
                            },
                        });
                        return [4 /*yield*/, query.process()];
                    case 1:
                        results = _a.sent();
                        expect(results).toHaveLength(3);
                        expect(fetchMock).toHaveBeenCalledTimes(1);
                        expect(fetchMock).toHaveBeenCalledWith({
                            method: 'GET',
                            url: "proxied/api/v1/label/resource/values?start=" + raw.from.unix() + "&end=" + raw.to.unix(),
                            hideFromInspector: true,
                            headers: {},
                        });
                        return [2 /*return*/];
                }
            });
        }); });
        it('label_values(metric, resource) should generate series query with correct time', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = setupMetricFindQuery({
                            query: 'label_values(metric, resource)',
                            response: {
                                data: [
                                    { __name__: 'metric', resource: 'value1' },
                                    { __name__: 'metric', resource: 'value2' },
                                    { __name__: 'metric', resource: 'value3' },
                                ],
                            },
                        });
                        return [4 /*yield*/, query.process()];
                    case 1:
                        results = _a.sent();
                        expect(results).toHaveLength(3);
                        expect(fetchMock).toHaveBeenCalledTimes(1);
                        expect(fetchMock).toHaveBeenCalledWith({
                            method: 'GET',
                            url: "proxied/api/v1/series?match" + encodeURIComponent('[]') + "=metric&start=" + raw.from.unix() + "&end=" + raw.to.unix(),
                            hideFromInspector: true,
                            headers: {},
                        });
                        return [2 /*return*/];
                }
            });
        }); });
        it('label_values(metric{label1="foo", label2="bar", label3="baz"}, resource) should generate series query with correct time', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = setupMetricFindQuery({
                            query: 'label_values(metric{label1="foo", label2="bar", label3="baz"}, resource)',
                            response: {
                                data: [
                                    { __name__: 'metric', resource: 'value1' },
                                    { __name__: 'metric', resource: 'value2' },
                                    { __name__: 'metric', resource: 'value3' },
                                ],
                            },
                        });
                        return [4 /*yield*/, query.process()];
                    case 1:
                        results = _a.sent();
                        expect(results).toHaveLength(3);
                        expect(fetchMock).toHaveBeenCalledTimes(1);
                        expect(fetchMock).toHaveBeenCalledWith({
                            method: 'GET',
                            url: 'proxied/api/v1/series?match%5B%5D=metric%7Blabel1%3D%22foo%22%2C%20label2%3D%22bar%22%2C%20label3%3D%22baz%22%7D&start=1524650400&end=1524654000',
                            hideFromInspector: true,
                            headers: {},
                        });
                        return [2 /*return*/];
                }
            });
        }); });
        it('label_values(metric, resource) result should not contain empty string', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = setupMetricFindQuery({
                            query: 'label_values(metric, resource)',
                            response: {
                                data: [
                                    { __name__: 'metric', resource: 'value1' },
                                    { __name__: 'metric', resource: 'value2' },
                                    { __name__: 'metric', resource: '' },
                                ],
                            },
                        });
                        return [4 /*yield*/, query.process()];
                    case 1:
                        results = _a.sent();
                        expect(results).toHaveLength(2);
                        expect(results[0].text).toBe('value1');
                        expect(results[1].text).toBe('value2');
                        expect(fetchMock).toHaveBeenCalledTimes(1);
                        expect(fetchMock).toHaveBeenCalledWith({
                            method: 'GET',
                            url: "proxied/api/v1/series?match" + encodeURIComponent('[]') + "=metric&start=" + raw.from.unix() + "&end=" + raw.to.unix(),
                            hideFromInspector: true,
                            headers: {},
                        });
                        return [2 /*return*/];
                }
            });
        }); });
        it('metrics(metric.*) should generate metric name query', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = setupMetricFindQuery({
                            query: 'metrics(metric.*)',
                            response: {
                                data: ['metric1', 'metric2', 'metric3', 'nomatch'],
                            },
                        });
                        return [4 /*yield*/, query.process()];
                    case 1:
                        results = _a.sent();
                        expect(results).toHaveLength(3);
                        expect(fetchMock).toHaveBeenCalledTimes(1);
                        expect(fetchMock).toHaveBeenCalledWith({
                            method: 'GET',
                            url: "proxied/api/v1/label/__name__/values?start=" + raw.from.unix() + "&end=" + raw.to.unix(),
                            hideFromInspector: true,
                            headers: {},
                        });
                        return [2 /*return*/];
                }
            });
        }); });
        it('query_result(metric) should generate metric name query', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = setupMetricFindQuery({
                            query: 'query_result(metric)',
                            response: {
                                data: {
                                    resultType: 'vector',
                                    result: [
                                        {
                                            metric: { __name__: 'metric', job: 'testjob' },
                                            value: [1443454528.0, '3846'],
                                        },
                                    ],
                                },
                            },
                        });
                        return [4 /*yield*/, query.process()];
                    case 1:
                        results = _a.sent();
                        expect(results).toHaveLength(1);
                        expect(results[0].text).toBe('metric{job="testjob"} 3846 1443454528000');
                        expect(fetchMock).toHaveBeenCalledTimes(1);
                        expect(fetchMock).toHaveBeenCalledWith({
                            method: 'GET',
                            url: "proxied/api/v1/query?query=metric&time=" + raw.to.unix(),
                            requestId: undefined,
                            headers: {},
                        });
                        return [2 /*return*/];
                }
            });
        }); });
        it('up{job="job1"} should fallback using generate series query', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = setupMetricFindQuery({
                            query: 'up{job="job1"}',
                            response: {
                                data: [
                                    { __name__: 'up', instance: '127.0.0.1:1234', job: 'job1' },
                                    { __name__: 'up', instance: '127.0.0.1:5678', job: 'job1' },
                                    { __name__: 'up', instance: '127.0.0.1:9102', job: 'job1' },
                                ],
                            },
                        });
                        return [4 /*yield*/, query.process()];
                    case 1:
                        results = _a.sent();
                        expect(results).toHaveLength(3);
                        expect(results[0].text).toBe('up{instance="127.0.0.1:1234",job="job1"}');
                        expect(results[1].text).toBe('up{instance="127.0.0.1:5678",job="job1"}');
                        expect(results[2].text).toBe('up{instance="127.0.0.1:9102",job="job1"}');
                        expect(fetchMock).toHaveBeenCalledTimes(1);
                        expect(fetchMock).toHaveBeenCalledWith({
                            method: 'GET',
                            url: "proxied/api/v1/series?match" + encodeURIComponent('[]') + "=" + encodeURIComponent('up{job="job1"}') + "&start=" + raw.from.unix() + "&end=" + raw.to.unix(),
                            hideFromInspector: true,
                            headers: {},
                        });
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=metric_find_query.test.js.map