import { __assign, __awaiter, __generator, __makeTemplateObject } from "tslib";
import { map, cloneDeep } from 'lodash';
import { of, throwError } from 'rxjs';
import { CoreApp, dateTime, getFieldDisplayName, LoadingState, toDataFrame, } from '@grafana/data';
import { alignRange, extractRuleMappingFromGroups, PrometheusDatasource, prometheusRegularEscape, prometheusSpecialRegexEscape, } from './datasource';
import { VariableHide } from '../../../features/variables/types';
import { describe } from '../../../../test/lib/common';
var fetchMock = jest.fn().mockReturnValue(of(createDefaultPromResponse()));
jest.mock('./metric_find_query');
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: function () { return ({
        fetch: fetchMock,
    }); } })); });
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
var timeSrvStub = {
    timeRange: function () {
        return {
            from: dateTime(1531468681),
            to: dateTime(1531489712),
        };
    },
};
beforeEach(function () {
    jest.clearAllMocks();
});
describe('PrometheusDatasource', function () {
    var ds;
    var instanceSettings = {
        url: 'proxied',
        directUrl: 'direct',
        user: 'test',
        password: 'mupp',
        jsonData: {
            customQueryParameters: '',
        },
    };
    beforeEach(function () {
        ds = new PrometheusDatasource(instanceSettings, templateSrvStub, timeSrvStub);
    });
    describe('Query', function () {
        it('returns empty array when no queries', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, expect(ds.query(createDataRequest([]))).toEmitValuesWith(function (response) {
                            expect(response[0].data).toEqual([]);
                            expect(response[0].state).toBe(LoadingState.Done);
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('performs time series queries', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, expect(ds.query(createDataRequest([{}]))).toEmitValuesWith(function (response) {
                            expect(response[0].data.length).not.toBe(0);
                            expect(response[0].state).toBe(LoadingState.Done);
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('with 2 queries and used from Explore, sends results as they arrive', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, expect(ds.query(createDataRequest([{}, {}], { app: CoreApp.Explore }))).toEmitValuesWith(function (response) {
                            expect(response[0].data.length).not.toBe(0);
                            expect(response[0].state).toBe(LoadingState.Loading);
                            expect(response[1].state).toBe(LoadingState.Done);
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('with 2 queries and used from Panel, waits for all to finish until sending Done status', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, expect(ds.query(createDataRequest([{}, {}], { app: CoreApp.Dashboard }))).toEmitValuesWith(function (response) {
                            expect(response[0].data.length).not.toBe(0);
                            expect(response[0].state).toBe(LoadingState.Done);
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('Datasource metadata requests', function () {
        it('should perform a GET request with the default config', function () {
            ds.metadataRequest('/foo', { bar: 'baz baz', foo: 'foo' });
            expect(fetchMock.mock.calls.length).toBe(1);
            expect(fetchMock.mock.calls[0][0].method).toBe('GET');
            expect(fetchMock.mock.calls[0][0].url).toContain('bar=baz%20baz&foo=foo');
        });
        it('should still perform a GET request with the DS HTTP method set to POST and not POST-friendly endpoint', function () {
            var postSettings = cloneDeep(instanceSettings);
            postSettings.jsonData.httpMethod = 'POST';
            var promDs = new PrometheusDatasource(postSettings, templateSrvStub, timeSrvStub);
            promDs.metadataRequest('/foo');
            expect(fetchMock.mock.calls.length).toBe(1);
            expect(fetchMock.mock.calls[0][0].method).toBe('GET');
        });
        it('should try to perform a POST request with the DS HTTP method set to POST and POST-friendly endpoint', function () {
            var postSettings = cloneDeep(instanceSettings);
            postSettings.jsonData.httpMethod = 'POST';
            var promDs = new PrometheusDatasource(postSettings, templateSrvStub, timeSrvStub);
            promDs.metadataRequest('api/v1/series', { bar: 'baz baz', foo: 'foo' });
            expect(fetchMock.mock.calls.length).toBe(1);
            expect(fetchMock.mock.calls[0][0].method).toBe('POST');
            expect(fetchMock.mock.calls[0][0].url).not.toContain('bar=baz%20baz&foo=foo');
            expect(fetchMock.mock.calls[0][0].data).toEqual({ bar: 'baz baz', foo: 'foo' });
        });
    });
    describe('customQueryParams', function () {
        var target = { expr: 'test{job="testjob"}', format: 'time_series', refId: '' };
        function makeQuery(target) {
            return {
                range: { from: time({ seconds: 63 }), to: time({ seconds: 183 }) },
                targets: [target],
                interval: '60s',
            };
        }
        describe('with GET http method', function () {
            var promDs = new PrometheusDatasource(__assign(__assign({}, instanceSettings), { jsonData: { customQueryParameters: 'customQuery=123', httpMethod: 'GET' } }), templateSrvStub, timeSrvStub);
            it('added to metadata request', function () {
                promDs.metadataRequest('/foo');
                expect(fetchMock.mock.calls.length).toBe(1);
                expect(fetchMock.mock.calls[0][0].url).toBe('proxied/foo?customQuery=123');
            });
            it('adds params to timeseries query', function () {
                promDs.query(makeQuery(target));
                expect(fetchMock.mock.calls.length).toBe(1);
                expect(fetchMock.mock.calls[0][0].url).toBe('proxied/api/v1/query_range?query=test%7Bjob%3D%22testjob%22%7D&start=60&end=180&step=60&customQuery=123');
            });
            it('adds params to exemplars query', function () {
                promDs.query(makeQuery(__assign(__assign({}, target), { exemplar: true })));
                // We do also range query for single exemplars target
                expect(fetchMock.mock.calls.length).toBe(2);
                expect(fetchMock.mock.calls[0][0].url).toContain('&customQuery=123');
                expect(fetchMock.mock.calls[1][0].url).toContain('&customQuery=123');
            });
            it('adds params to instant query', function () {
                promDs.query(makeQuery(__assign(__assign({}, target), { instant: true })));
                expect(fetchMock.mock.calls.length).toBe(1);
                expect(fetchMock.mock.calls[0][0].url).toContain('&customQuery=123');
            });
        });
        describe('with POST http method', function () {
            var promDs = new PrometheusDatasource(__assign(__assign({}, instanceSettings), { jsonData: { customQueryParameters: 'customQuery=123', httpMethod: 'POST' } }), templateSrvStub, timeSrvStub);
            it('added to metadata request with non-POST endpoint', function () {
                promDs.metadataRequest('/foo');
                expect(fetchMock.mock.calls.length).toBe(1);
                expect(fetchMock.mock.calls[0][0].url).toBe('proxied/foo?customQuery=123');
            });
            it('added to metadata request with POST endpoint', function () {
                promDs.metadataRequest('/api/v1/labels');
                expect(fetchMock.mock.calls.length).toBe(1);
                expect(fetchMock.mock.calls[0][0].url).toBe('proxied/api/v1/labels');
                expect(fetchMock.mock.calls[0][0].data.customQuery).toBe('123');
            });
            it('adds params to timeseries query', function () {
                promDs.query(makeQuery(target));
                expect(fetchMock.mock.calls.length).toBe(1);
                expect(fetchMock.mock.calls[0][0].url).toBe('proxied/api/v1/query_range');
                expect(fetchMock.mock.calls[0][0].data).toEqual({
                    customQuery: '123',
                    query: 'test{job="testjob"}',
                    step: 60,
                    end: 180,
                    start: 60,
                });
            });
            it('adds params to exemplars query', function () {
                promDs.query(makeQuery(__assign(__assign({}, target), { exemplar: true })));
                // We do also range query for single exemplars target
                expect(fetchMock.mock.calls.length).toBe(2);
                expect(fetchMock.mock.calls[0][0].data.customQuery).toBe('123');
                expect(fetchMock.mock.calls[1][0].data.customQuery).toBe('123');
            });
            it('adds params to instant query', function () {
                promDs.query(makeQuery(__assign(__assign({}, target), { instant: true })));
                expect(fetchMock.mock.calls.length).toBe(1);
                expect(fetchMock.mock.calls[0][0].data.customQuery).toBe('123');
            });
        });
    });
    describe('When using adhoc filters', function () {
        var DEFAULT_QUERY_EXPRESSION = 'metric{job="foo"} - metric';
        var target = { expr: DEFAULT_QUERY_EXPRESSION };
        var originalAdhocFiltersMock = templateSrvStub.getAdhocFilters();
        afterAll(function () {
            templateSrvStub.getAdhocFilters.mockReturnValue(originalAdhocFiltersMock);
        });
        it('should not modify expression with no filters', function () {
            var result = ds.createQuery(target, { interval: '15s' }, 0, 0);
            expect(result).toMatchObject({ expr: DEFAULT_QUERY_EXPRESSION });
        });
        it('should add filters to expression', function () {
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
            var result = ds.createQuery(target, { interval: '15s' }, 0, 0);
            expect(result).toMatchObject({ expr: 'metric{job="foo",k1="v1",k2!="v2"} - metric{k1="v1",k2!="v2"}' });
        });
        it('should add escaping if needed to regex filter expressions', function () {
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
            var result = ds.createQuery(target, { interval: '15s' }, 0, 0);
            expect(result).toMatchObject({
                expr: "metric{job=\"foo\",k1=~\"v.*\",k2=~\"v\\\\'.*\"} - metric{k1=~\"v.*\",k2=~\"v\\\\'.*\"}",
            });
        });
    });
    describe('When converting prometheus histogram to heatmap format', function () {
        var query;
        beforeEach(function () {
            query = {
                range: { from: dateTime(1443454528000), to: dateTime(1443454528000) },
                targets: [{ expr: 'test{job="testjob"}', format: 'heatmap', legendFormat: '{{le}}' }],
                interval: '1s',
            };
        });
        it('should convert cumulative histogram to ordinary', function () { return __awaiter(void 0, void 0, void 0, function () {
            var resultMock, responseMock;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        resultMock = [
                            {
                                metric: { __name__: 'metric', job: 'testjob', le: '10' },
                                values: [
                                    [1443454528.0, '10'],
                                    [1443454528.0, '10'],
                                ],
                            },
                            {
                                metric: { __name__: 'metric', job: 'testjob', le: '20' },
                                values: [
                                    [1443454528.0, '20'],
                                    [1443454528.0, '10'],
                                ],
                            },
                            {
                                metric: { __name__: 'metric', job: 'testjob', le: '30' },
                                values: [
                                    [1443454528.0, '25'],
                                    [1443454528.0, '10'],
                                ],
                            },
                        ];
                        responseMock = { data: { data: { result: resultMock } } };
                        ds.performTimeSeriesQuery = jest.fn().mockReturnValue(of(responseMock));
                        return [4 /*yield*/, expect(ds.query(query)).toEmitValuesWith(function (result) {
                                var results = result[0].data;
                                expect(results[0].fields[1].values.toArray()).toEqual([10, 10]);
                                expect(results[1].fields[1].values.toArray()).toEqual([10, 0]);
                                expect(results[2].fields[1].values.toArray()).toEqual([5, 0]);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should sort series by label value', function () { return __awaiter(void 0, void 0, void 0, function () {
            var resultMock, responseMock, expected;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        resultMock = [
                            {
                                metric: { __name__: 'metric', job: 'testjob', le: '2' },
                                values: [
                                    [1443454528.0, '10'],
                                    [1443454528.0, '10'],
                                ],
                            },
                            {
                                metric: { __name__: 'metric', job: 'testjob', le: '4' },
                                values: [
                                    [1443454528.0, '20'],
                                    [1443454528.0, '10'],
                                ],
                            },
                            {
                                metric: { __name__: 'metric', job: 'testjob', le: '+Inf' },
                                values: [
                                    [1443454528.0, '25'],
                                    [1443454528.0, '10'],
                                ],
                            },
                            {
                                metric: { __name__: 'metric', job: 'testjob', le: '1' },
                                values: [
                                    [1443454528.0, '25'],
                                    [1443454528.0, '10'],
                                ],
                            },
                        ];
                        responseMock = { data: { data: { result: resultMock } } };
                        expected = ['1', '2', '4', '+Inf'];
                        ds.performTimeSeriesQuery = jest.fn().mockReturnValue(of(responseMock));
                        return [4 /*yield*/, expect(ds.query(query)).toEmitValuesWith(function (result) {
                                var seriesLabels = map(result[0].data, 'name');
                                expect(seriesLabels).toEqual(expected);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('alignRange', function () {
        it('does not modify already aligned intervals with perfect step', function () {
            var range = alignRange(0, 3, 3, 0);
            expect(range.start).toEqual(0);
            expect(range.end).toEqual(3);
        });
        it('does modify end-aligned intervals to reflect number of steps possible', function () {
            var range = alignRange(1, 6, 3, 0);
            expect(range.start).toEqual(0);
            expect(range.end).toEqual(6);
        });
        it('does align intervals that are a multiple of steps', function () {
            var range = alignRange(1, 4, 3, 0);
            expect(range.start).toEqual(0);
            expect(range.end).toEqual(3);
        });
        it('does align intervals that are not a multiple of steps', function () {
            var range = alignRange(1, 5, 3, 0);
            expect(range.start).toEqual(0);
            expect(range.end).toEqual(3);
        });
        it('does align intervals with local midnight -UTC offset', function () {
            //week range, location 4+ hours UTC offset, 24h step time
            var range = alignRange(4 * 60 * 60, (7 * 24 + 4) * 60 * 60, 24 * 60 * 60, -4 * 60 * 60); //04:00 UTC, 7 day range
            expect(range.start).toEqual(4 * 60 * 60);
            expect(range.end).toEqual((7 * 24 + 4) * 60 * 60);
        });
        it('does align intervals with local midnight +UTC offset', function () {
            //week range, location 4- hours UTC offset, 24h step time
            var range = alignRange(20 * 60 * 60, (8 * 24 - 4) * 60 * 60, 24 * 60 * 60, 4 * 60 * 60); //20:00 UTC on day1, 7 days later is 20:00 on day8
            expect(range.start).toEqual(20 * 60 * 60);
            expect(range.end).toEqual((8 * 24 - 4) * 60 * 60);
        });
    });
    describe('extractRuleMappingFromGroups()', function () {
        it('returns empty mapping for no rule groups', function () {
            expect(extractRuleMappingFromGroups([])).toEqual({});
        });
        it('returns a mapping for recording rules only', function () {
            var groups = [
                {
                    rules: [
                        {
                            name: 'HighRequestLatency',
                            query: 'job:request_latency_seconds:mean5m{job="myjob"} > 0.5',
                            type: 'alerting',
                        },
                        {
                            name: 'job:http_inprogress_requests:sum',
                            query: 'sum(http_inprogress_requests) by (job)',
                            type: 'recording',
                        },
                    ],
                    file: '/rules.yaml',
                    interval: 60,
                    name: 'example',
                },
            ];
            var mapping = extractRuleMappingFromGroups(groups);
            expect(mapping).toEqual({ 'job:http_inprogress_requests:sum': 'sum(http_inprogress_requests) by (job)' });
        });
    });
    describe('Prometheus regular escaping', function () {
        it('should not escape non-string', function () {
            expect(prometheusRegularEscape(12)).toEqual(12);
        });
        it('should not escape simple string', function () {
            expect(prometheusRegularEscape('cryptodepression')).toEqual('cryptodepression');
        });
        it("should escape '", function () {
            expect(prometheusRegularEscape("looking'glass")).toEqual("looking\\\\'glass");
        });
        it('should escape \\', function () {
            expect(prometheusRegularEscape('looking\\glass')).toEqual('looking\\\\glass');
        });
        it('should escape multiple characters', function () {
            expect(prometheusRegularEscape("'looking'glass'")).toEqual("\\\\'looking\\\\'glass\\\\'");
        });
        it('should escape multiple different characters', function () {
            expect(prometheusRegularEscape("'loo\\king'glass'")).toEqual("\\\\'loo\\\\king\\\\'glass\\\\'");
        });
    });
    describe('Prometheus regexes escaping', function () {
        it('should not escape simple string', function () {
            expect(prometheusSpecialRegexEscape('cryptodepression')).toEqual('cryptodepression');
        });
        it('should escape $^*+?.()|\\', function () {
            expect(prometheusSpecialRegexEscape("looking'glass")).toEqual("looking\\\\'glass");
            expect(prometheusSpecialRegexEscape('looking{glass')).toEqual('looking\\\\{glass');
            expect(prometheusSpecialRegexEscape('looking}glass')).toEqual('looking\\\\}glass');
            expect(prometheusSpecialRegexEscape('looking[glass')).toEqual('looking\\\\[glass');
            expect(prometheusSpecialRegexEscape('looking]glass')).toEqual('looking\\\\]glass');
            expect(prometheusSpecialRegexEscape('looking$glass')).toEqual('looking\\\\$glass');
            expect(prometheusSpecialRegexEscape('looking^glass')).toEqual('looking\\\\^glass');
            expect(prometheusSpecialRegexEscape('looking*glass')).toEqual('looking\\\\*glass');
            expect(prometheusSpecialRegexEscape('looking+glass')).toEqual('looking\\\\+glass');
            expect(prometheusSpecialRegexEscape('looking?glass')).toEqual('looking\\\\?glass');
            expect(prometheusSpecialRegexEscape('looking.glass')).toEqual('looking\\\\.glass');
            expect(prometheusSpecialRegexEscape('looking(glass')).toEqual('looking\\\\(glass');
            expect(prometheusSpecialRegexEscape('looking)glass')).toEqual('looking\\\\)glass');
            expect(prometheusSpecialRegexEscape('looking\\glass')).toEqual('looking\\\\\\\\glass');
            expect(prometheusSpecialRegexEscape('looking|glass')).toEqual('looking\\\\|glass');
        });
        it('should escape multiple special characters', function () {
            expect(prometheusSpecialRegexEscape('+looking$glass?')).toEqual('\\\\+looking\\\\$glass\\\\?');
        });
    });
    describe('When interpolating variables', function () {
        var customVariable;
        beforeEach(function () {
            customVariable = {
                id: '',
                global: false,
                multi: false,
                includeAll: false,
                allValue: null,
                query: '',
                options: [],
                current: {},
                name: '',
                type: 'custom',
                label: null,
                hide: VariableHide.dontHide,
                skipUrlSync: false,
                index: -1,
                initLock: null,
            };
        });
        describe('and value is a string', function () {
            it('should only escape single quotes', function () {
                expect(ds.interpolateQueryExpr("abc'$^*{}[]+?.()|", customVariable)).toEqual("abc\\\\'$^*{}[]+?.()|");
            });
        });
        describe('and value is a number', function () {
            it('should return a number', function () {
                expect(ds.interpolateQueryExpr(1000, customVariable)).toEqual(1000);
            });
        });
        describe('and variable allows multi-value', function () {
            beforeEach(function () {
                customVariable.multi = true;
            });
            it('should regex escape values if the value is a string', function () {
                expect(ds.interpolateQueryExpr('looking*glass', customVariable)).toEqual('looking\\\\*glass');
            });
            it('should return pipe separated values if the value is an array of strings', function () {
                expect(ds.interpolateQueryExpr(['a|bc', 'de|f'], customVariable)).toEqual('(a\\\\|bc|de\\\\|f)');
            });
            it('should return 1 regex escaped value if there is just 1 value in an array of strings', function () {
                expect(ds.interpolateQueryExpr(['looking*glass'], customVariable)).toEqual('looking\\\\*glass');
            });
        });
        describe('and variable allows all', function () {
            beforeEach(function () {
                customVariable.includeAll = true;
            });
            it('should regex escape values if the array is a string', function () {
                expect(ds.interpolateQueryExpr('looking*glass', customVariable)).toEqual('looking\\\\*glass');
            });
            it('should return pipe separated values if the value is an array of strings', function () {
                expect(ds.interpolateQueryExpr(['a|bc', 'de|f'], customVariable)).toEqual('(a\\\\|bc|de\\\\|f)');
            });
            it('should return 1 regex escaped value if there is just 1 value in an array of strings', function () {
                expect(ds.interpolateQueryExpr(['looking*glass'], customVariable)).toEqual('looking\\\\*glass');
            });
        });
    });
    describe('interpolateVariablesInQueries', function () {
        it('should call replace function 2 times', function () {
            var query = {
                expr: 'test{job="testjob"}',
                format: 'time_series',
                interval: '$Interval',
                refId: 'A',
            };
            var interval = '10m';
            templateSrvStub.replace.mockReturnValue(interval);
            var queries = ds.interpolateVariablesInQueries([query], { Interval: { text: interval, value: interval } });
            expect(templateSrvStub.replace).toBeCalledTimes(2);
            expect(queries[0].interval).toBe(interval);
        });
    });
    describe('applyTemplateVariables', function () {
        it('should call replace function for legendFormat', function () {
            var query = {
                expr: 'test{job="bar"}',
                legendFormat: '$legend',
                refId: 'A',
            };
            var legend = 'baz';
            templateSrvStub.replace.mockReturnValue(legend);
            var interpolatedQuery = ds.applyTemplateVariables(query, { legend: { text: legend, value: legend } });
            expect(interpolatedQuery.legendFormat).toBe(legend);
        });
        it('should call replace function for expr', function () {
            var query = {
                expr: 'test{job="$job"}',
                refId: 'A',
            };
            var job = 'bar';
            templateSrvStub.replace.mockReturnValue(job);
            var interpolatedQuery = ds.applyTemplateVariables(query, { job: { text: job, value: job } });
            expect(interpolatedQuery.expr).toBe(job);
        });
        it('should not call replace function for interval', function () {
            var query = {
                expr: 'test{job="bar"}',
                interval: '$interval',
                refId: 'A',
            };
            var interval = '10s';
            templateSrvStub.replace.mockReturnValue(interval);
            var interpolatedQuery = ds.applyTemplateVariables(query, { interval: { text: interval, value: interval } });
            expect(interpolatedQuery.interval).not.toBe(interval);
        });
    });
    describe('metricFindQuery', function () {
        beforeEach(function () {
            var query = 'query_result(topk(5,rate(http_request_duration_microseconds_count[$__interval])))';
            templateSrvStub.replace = jest.fn();
            ds.metricFindQuery(query);
        });
        afterAll(function () {
            templateSrvStub.replace = jest.fn(function (a) { return a; });
        });
        it('should call templateSrv.replace with scopedVars', function () {
            expect(templateSrvStub.replace.mock.calls[0][1]).toBeDefined();
        });
        it('should have the correct range and range_ms', function () {
            var range = templateSrvStub.replace.mock.calls[0][1].__range;
            var rangeMs = templateSrvStub.replace.mock.calls[0][1].__range_ms;
            var rangeS = templateSrvStub.replace.mock.calls[0][1].__range_s;
            expect(range).toEqual({ text: '21s', value: '21s' });
            expect(rangeMs).toEqual({ text: 21031, value: 21031 });
            expect(rangeS).toEqual({ text: 21, value: 21 });
        });
        it('should pass the default interval value', function () {
            var interval = templateSrvStub.replace.mock.calls[0][1].__interval;
            var intervalMs = templateSrvStub.replace.mock.calls[0][1].__interval_ms;
            expect(interval).toEqual({ text: '15s', value: '15s' });
            expect(intervalMs).toEqual({ text: 15000, value: 15000 });
        });
    });
});
var SECOND = 1000;
var MINUTE = 60 * SECOND;
var HOUR = 60 * MINUTE;
var time = function (_a) {
    var _b = _a.hours, hours = _b === void 0 ? 0 : _b, _c = _a.seconds, seconds = _c === void 0 ? 0 : _c, _d = _a.minutes, minutes = _d === void 0 ? 0 : _d;
    return dateTime(hours * HOUR + minutes * MINUTE + seconds * SECOND);
};
describe('PrometheusDatasource', function () {
    var instanceSettings = {
        url: 'proxied',
        directUrl: 'direct',
        user: 'test',
        password: 'mupp',
        jsonData: { httpMethod: 'GET' },
    };
    var ds;
    beforeEach(function () {
        ds = new PrometheusDatasource(instanceSettings, templateSrvStub, timeSrvStub);
    });
    describe('When querying prometheus with one target using query editor target spec', function () {
        describe('and query syntax is valid', function () {
            var results;
            var query = {
                range: { from: time({ seconds: 63 }), to: time({ seconds: 183 }) },
                targets: [{ expr: 'test{job="testjob"}', format: 'time_series' }],
                interval: '60s',
            };
            // Interval alignment with step
            var urlExpected = "proxied/api/v1/query_range?query=" + encodeURIComponent('test{job="testjob"}') + "&start=60&end=180&step=60";
            beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
                var response;
                return __generator(this, function (_a) {
                    response = {
                        data: {
                            status: 'success',
                            data: {
                                resultType: 'matrix',
                                result: [
                                    {
                                        metric: { __name__: 'test', job: 'testjob' },
                                        values: [[60, '3846']],
                                    },
                                ],
                            },
                        },
                    };
                    fetchMock.mockImplementation(function () { return of(response); });
                    ds.query(query).subscribe(function (data) {
                        results = data;
                    });
                    return [2 /*return*/];
                });
            }); });
            it('should generate the correct query', function () {
                var res = fetchMock.mock.calls[0][0];
                expect(res.method).toBe('GET');
                expect(res.url).toBe(urlExpected);
            });
            it('should return series list', function () { return __awaiter(void 0, void 0, void 0, function () {
                var frame;
                return __generator(this, function (_a) {
                    frame = toDataFrame(results.data[0]);
                    expect(results.data.length).toBe(1);
                    expect(getFieldDisplayName(frame.fields[1], frame)).toBe('test{job="testjob"}');
                    return [2 /*return*/];
                });
            }); });
        });
        describe('and query syntax is invalid', function () {
            var results;
            var query = {
                range: { from: time({ seconds: 63 }), to: time({ seconds: 183 }) },
                targets: [{ expr: 'tes;;t{job="testjob"}', format: 'time_series' }],
                interval: '60s',
            };
            var errMessage = 'parse error at char 25: could not parse remaining input';
            var response = {
                data: {
                    status: 'error',
                    errorType: 'bad_data',
                    error: errMessage,
                },
            };
            it('should generate an error', function () {
                fetchMock.mockImplementation(function () { return throwError(response); });
                ds.query(query).subscribe(function (e) {
                    results = e.message;
                    expect(results).toBe("\"" + errMessage + "\"");
                });
            });
        });
    });
    describe('When querying prometheus with one target which returns multiple series', function () {
        var results;
        var start = 60;
        var end = 360;
        var step = 60;
        var query = {
            range: { from: time({ seconds: start }), to: time({ seconds: end }) },
            targets: [{ expr: 'test{job="testjob"}', format: 'time_series' }],
            interval: '60s',
        };
        beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                response = {
                    status: 'success',
                    data: {
                        data: {
                            resultType: 'matrix',
                            result: [
                                {
                                    metric: { __name__: 'test', job: 'testjob', series: 'series 1' },
                                    values: [
                                        [start + step * 1, '3846'],
                                        [start + step * 3, '3847'],
                                        [end - step * 1, '3848'],
                                    ],
                                },
                                {
                                    metric: { __name__: 'test', job: 'testjob', series: 'series 2' },
                                    values: [[start + step * 2, '4846']],
                                },
                            ],
                        },
                    },
                };
                fetchMock.mockImplementation(function () { return of(response); });
                ds.query(query).subscribe(function (data) {
                    results = data;
                });
                return [2 /*return*/];
            });
        }); });
        it('should be same length', function () {
            expect(results.data.length).toBe(2);
            expect(results.data[0].length).toBe((end - start) / step + 1);
            expect(results.data[1].length).toBe((end - start) / step + 1);
        });
        it('should fill null until first datapoint in response', function () {
            expect(results.data[0].fields[0].values.get(0)).toBe(start * 1000);
            expect(results.data[0].fields[1].values.get(0)).toBe(null);
            expect(results.data[0].fields[0].values.get(1)).toBe((start + step * 1) * 1000);
            expect(results.data[0].fields[1].values.get(1)).toBe(3846);
        });
        it('should fill null after last datapoint in response', function () {
            var length = (end - start) / step + 1;
            expect(results.data[0].fields[0].values.get(length - 2)).toBe((end - step * 1) * 1000);
            expect(results.data[0].fields[1].values.get(length - 2)).toBe(3848);
            expect(results.data[0].fields[0].values.get(length - 1)).toBe(end * 1000);
            expect(results.data[0].fields[1].values.get(length - 1)).toBe(null);
        });
        it('should fill null at gap between series', function () {
            expect(results.data[0].fields[0].values.get(2)).toBe((start + step * 2) * 1000);
            expect(results.data[0].fields[1].values.get(2)).toBe(null);
            expect(results.data[1].fields[0].values.get(1)).toBe((start + step * 1) * 1000);
            expect(results.data[1].fields[1].values.get(1)).toBe(null);
            expect(results.data[1].fields[0].values.get(3)).toBe((start + step * 3) * 1000);
            expect(results.data[1].fields[1].values.get(3)).toBe(null);
        });
    });
    describe('When querying prometheus with one target and instant = true', function () {
        var results;
        var urlExpected = "proxied/api/v1/query?query=" + encodeURIComponent('test{job="testjob"}') + "&time=123";
        var query = {
            range: { from: time({ seconds: 63 }), to: time({ seconds: 123 }) },
            targets: [{ expr: 'test{job="testjob"}', format: 'time_series', instant: true }],
            interval: '60s',
        };
        beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                response = {
                    status: 'success',
                    data: {
                        data: {
                            resultType: 'vector',
                            result: [
                                {
                                    metric: { __name__: 'test', job: 'testjob' },
                                    value: [123, '3846'],
                                },
                            ],
                        },
                    },
                };
                fetchMock.mockImplementation(function () { return of(response); });
                ds.query(query).subscribe(function (data) {
                    results = data;
                });
                return [2 /*return*/];
            });
        }); });
        it('should generate the correct query', function () {
            var res = fetchMock.mock.calls[0][0];
            expect(res.method).toBe('GET');
            expect(res.url).toBe(urlExpected);
        });
        it('should return series list', function () {
            var frame = toDataFrame(results.data[0]);
            expect(results.data.length).toBe(1);
            expect(frame.name).toBe('test{job="testjob"}');
            expect(getFieldDisplayName(frame.fields[1], frame)).toBe('test{job="testjob"}');
        });
    });
    describe('annotationQuery', function () {
        var results;
        var options = {
            annotation: {
                expr: 'ALERTS{alertstate="firing"}',
                tagKeys: 'job',
                titleFormat: '{{alertname}}',
                textFormat: '{{instance}}',
            },
            range: {
                from: time({ seconds: 63 }),
                to: time({ seconds: 123 }),
            },
        };
        var response = {
            status: 'success',
            data: {
                data: {
                    resultType: 'matrix',
                    result: [
                        {
                            metric: {
                                __name__: 'ALERTS',
                                alertname: 'InstanceDown',
                                alertstate: 'firing',
                                instance: 'testinstance',
                                job: 'testjob',
                            },
                            values: [[123, '1']],
                        },
                    ],
                },
            },
        };
        describe('when time series query is cancelled', function () {
            it('should return empty results', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            fetchMock.mockImplementation(function () { return of({ cancelled: true }); });
                            return [4 /*yield*/, ds.annotationQuery(options).then(function (data) {
                                    results = data;
                                })];
                        case 1:
                            _a.sent();
                            expect(results).toEqual([]);
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('not use useValueForTime', function () {
            beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            options.annotation.useValueForTime = false;
                            fetchMock.mockImplementation(function () { return of(response); });
                            return [4 /*yield*/, ds.annotationQuery(options).then(function (data) {
                                    results = data;
                                })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should return annotation list', function () {
                expect(results.length).toBe(1);
                expect(results[0].tags).toContain('testjob');
                expect(results[0].title).toBe('InstanceDown');
                expect(results[0].text).toBe('testinstance');
                expect(results[0].time).toBe(123 * 1000);
            });
        });
        describe('use useValueForTime', function () {
            beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            options.annotation.useValueForTime = true;
                            fetchMock.mockImplementation(function () { return of(response); });
                            return [4 /*yield*/, ds.annotationQuery(options).then(function (data) {
                                    results = data;
                                })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should return annotation list', function () {
                expect(results[0].time).toEqual(1);
            });
        });
        describe('step parameter', function () {
            beforeEach(function () {
                fetchMock.mockImplementation(function () { return of(response); });
            });
            it('should use default step for short range if no interval is given', function () {
                var query = __assign(__assign({}, options), { range: {
                        from: time({ seconds: 63 }),
                        to: time({ seconds: 123 }),
                    } });
                ds.annotationQuery(query);
                var req = fetchMock.mock.calls[0][0];
                expect(req.url).toContain('step=60');
            });
            it('should use default step for short range when annotation step is empty string', function () {
                var query = __assign(__assign({}, options), { annotation: __assign(__assign({}, options.annotation), { step: '' }), range: {
                        from: time({ seconds: 63 }),
                        to: time({ seconds: 123 }),
                    } });
                ds.annotationQuery(query);
                var req = fetchMock.mock.calls[0][0];
                expect(req.url).toContain('step=60');
            });
            it('should use custom step for short range', function () {
                var annotation = __assign(__assign({}, options.annotation), { step: '10s' });
                var query = __assign(__assign({}, options), { annotation: annotation, range: {
                        from: time({ seconds: 63 }),
                        to: time({ seconds: 123 }),
                    } });
                ds.annotationQuery(query);
                var req = fetchMock.mock.calls[0][0];
                expect(req.url).toContain('step=10');
            });
            it('should use custom step for short range', function () {
                var annotation = __assign(__assign({}, options.annotation), { step: '10s' });
                var query = __assign(__assign({}, options), { annotation: annotation, range: {
                        from: time({ seconds: 63 }),
                        to: time({ seconds: 123 }),
                    } });
                ds.annotationQuery(query);
                var req = fetchMock.mock.calls[0][0];
                expect(req.url).toContain('step=10');
            });
            it('should use dynamic step on long ranges if no option was given', function () {
                var query = __assign(__assign({}, options), { range: {
                        from: time({ seconds: 63 }),
                        to: time({ hours: 24 * 30, seconds: 63 }),
                    } });
                ds.annotationQuery(query);
                var req = fetchMock.mock.calls[0][0];
                // Range in seconds: (to - from) / 1000
                // Max_datapoints: 11000
                // Step: range / max_datapoints
                var step = 236;
                expect(req.url).toContain("step=" + step);
            });
        });
        describe('region annotations for sectors', function () {
            var options = {
                annotation: {
                    expr: 'ALERTS{alertstate="firing"}',
                    tagKeys: 'job',
                    titleFormat: '{{alertname}}',
                    textFormat: '{{instance}}',
                },
                range: {
                    from: time({ seconds: 63 }),
                    to: time({ seconds: 900 }),
                },
            };
            function runAnnotationQuery(resultValues) {
                return __awaiter(this, void 0, void 0, function () {
                    var response;
                    return __generator(this, function (_a) {
                        response = {
                            status: 'success',
                            data: {
                                data: {
                                    resultType: 'matrix',
                                    result: [
                                        {
                                            metric: { __name__: 'test', job: 'testjob' },
                                            values: resultValues,
                                        },
                                    ],
                                },
                            },
                        };
                        options.annotation.useValueForTime = false;
                        fetchMock.mockImplementation(function () { return of(response); });
                        return [2 /*return*/, ds.annotationQuery(options)];
                    });
                });
            }
            it('should handle gaps and inactive values', function () { return __awaiter(void 0, void 0, void 0, function () {
                var results;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, runAnnotationQuery([
                                [2 * 60, '1'],
                                [3 * 60, '1'],
                                // gap
                                [5 * 60, '1'],
                                [6 * 60, '1'],
                                [7 * 60, '1'],
                                [8 * 60, '0'],
                                [9 * 60, '1'],
                            ])];
                        case 1:
                            results = _a.sent();
                            expect(results.map(function (result) { return [result.time, result.timeEnd]; })).toEqual([
                                [120000, 180000],
                                [300000, 420000],
                                [540000, 540000],
                            ]);
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should handle single region', function () { return __awaiter(void 0, void 0, void 0, function () {
                var results;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, runAnnotationQuery([
                                [2 * 60, '1'],
                                [3 * 60, '1'],
                            ])];
                        case 1:
                            results = _a.sent();
                            expect(results.map(function (result) { return [result.time, result.timeEnd]; })).toEqual([[120000, 180000]]);
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should handle 0 active regions', function () { return __awaiter(void 0, void 0, void 0, function () {
                var results;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, runAnnotationQuery([
                                [2 * 60, '0'],
                                [3 * 60, '0'],
                                [5 * 60, '0'],
                            ])];
                        case 1:
                            results = _a.sent();
                            expect(results.length).toBe(0);
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should handle single active value', function () { return __awaiter(void 0, void 0, void 0, function () {
                var results;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, runAnnotationQuery([[2 * 60, '1']])];
                        case 1:
                            results = _a.sent();
                            expect(results.map(function (result) { return [result.time, result.timeEnd]; })).toEqual([[120000, 120000]]);
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
    describe('createAnnotationQueryOptions', function () {
        it.each(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      options                                | expected\n      ", "                                  | ", "\n      ", "                  | ", "\n      ", " | ", "\n      ", "      | ", "\n      ", "        | ", "\n      ", "         | ", "\n      ", "         | ", "\n      ", "      | ", "\n    "], ["\n      options                                | expected\n      ", "                                  | ", "\n      ", "                  | ", "\n      ", " | ", "\n      ", "      | ", "\n      ", "        | ", "\n      ", "         | ", "\n      ", "         | ", "\n      ", "      | ", "\n    "])), {}, { interval: '60s' }, { annotation: {} }, { annotation: {}, interval: '60s' }, { annotation: { step: undefined } }, { annotation: { step: undefined }, interval: '60s' }, { annotation: { step: null } }, { annotation: { step: null }, interval: '60s' }, { annotation: { step: '' } }, { annotation: { step: '' }, interval: '60s' }, { annotation: { step: 0 } }, { annotation: { step: 0 }, interval: '60s' }, { annotation: { step: 5 } }, { annotation: { step: 5 }, interval: '60s' }, { annotation: { step: '5m' } }, { annotation: { step: '5m' }, interval: '5m' })("when called with options: '$options'", function (_a) {
            var options = _a.options, expected = _a.expected;
            expect(ds.createAnnotationQueryOptions(options)).toEqual(expected);
        });
    });
    describe('When resultFormat is table and instant = true', function () {
        var results;
        var query = {
            range: { from: time({ seconds: 63 }), to: time({ seconds: 123 }) },
            targets: [{ expr: 'test{job="testjob"}', format: 'time_series', instant: true }],
            interval: '60s',
        };
        beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                response = {
                    status: 'success',
                    data: {
                        data: {
                            resultType: 'vector',
                            result: [
                                {
                                    metric: { __name__: 'test', job: 'testjob' },
                                    value: [123, '3846'],
                                },
                            ],
                        },
                    },
                };
                fetchMock.mockImplementation(function () { return of(response); });
                ds.query(query).subscribe(function (data) {
                    results = data;
                });
                return [2 /*return*/];
            });
        }); });
        it('should return result', function () {
            expect(results).not.toBe(null);
        });
    });
    describe('The "step" query parameter', function () {
        var response = {
            status: 'success',
            data: {
                data: {
                    resultType: 'matrix',
                    result: [],
                },
            },
        };
        it('should be min interval when greater than auto interval', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, urlExpected, res;
            return __generator(this, function (_a) {
                query = {
                    // 6 minute range
                    range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
                    targets: [
                        {
                            expr: 'test',
                            interval: '10s',
                        },
                    ],
                    interval: '5s',
                };
                urlExpected = 'proxied/api/v1/query_range?query=test&start=60&end=420&step=10';
                fetchMock.mockImplementation(function () { return of(response); });
                ds.query(query);
                res = fetchMock.mock.calls[0][0];
                expect(res.method).toBe('GET');
                expect(res.url).toBe(urlExpected);
                return [2 /*return*/];
            });
        }); });
        it('step should be fractional for sub second intervals', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, urlExpected, res;
            return __generator(this, function (_a) {
                query = {
                    // 6 minute range
                    range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
                    targets: [{ expr: 'test' }],
                    interval: '100ms',
                };
                urlExpected = 'proxied/api/v1/query_range?query=test&start=60&end=420&step=0.1';
                fetchMock.mockImplementation(function () { return of(response); });
                ds.query(query);
                res = fetchMock.mock.calls[0][0];
                expect(res.method).toBe('GET');
                expect(res.url).toBe(urlExpected);
                return [2 /*return*/];
            });
        }); });
        it('should be auto interval when greater than min interval', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, urlExpected, res;
            return __generator(this, function (_a) {
                query = {
                    // 6 minute range
                    range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
                    targets: [
                        {
                            expr: 'test',
                            interval: '5s',
                        },
                    ],
                    interval: '10s',
                };
                urlExpected = 'proxied/api/v1/query_range?query=test&start=60&end=420&step=10';
                fetchMock.mockImplementation(function () { return of(response); });
                ds.query(query);
                res = fetchMock.mock.calls[0][0];
                expect(res.method).toBe('GET');
                expect(res.url).toBe(urlExpected);
                return [2 /*return*/];
            });
        }); });
        it('should result in querying fewer than 11000 data points', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, end, start, urlExpected, res;
            return __generator(this, function (_a) {
                query = {
                    // 6 hour range
                    range: { from: time({ hours: 1 }), to: time({ hours: 7 }) },
                    targets: [{ expr: 'test' }],
                    interval: '1s',
                };
                end = 7 * 60 * 60;
                start = 60 * 60;
                urlExpected = 'proxied/api/v1/query_range?query=test&start=' + start + '&end=' + end + '&step=2';
                fetchMock.mockImplementation(function () { return of(response); });
                ds.query(query);
                res = fetchMock.mock.calls[0][0];
                expect(res.method).toBe('GET');
                expect(res.url).toBe(urlExpected);
                return [2 /*return*/];
            });
        }); });
        it('should not apply min interval when interval * intervalFactor greater', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, urlExpected, res;
            return __generator(this, function (_a) {
                query = {
                    // 6 minute range
                    range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
                    targets: [
                        {
                            expr: 'test',
                            interval: '10s',
                            intervalFactor: 10,
                        },
                    ],
                    interval: '5s',
                };
                urlExpected = 'proxied/api/v1/query_range?query=test&start=50&end=400&step=50';
                fetchMock.mockImplementation(function () { return of(response); });
                ds.query(query);
                res = fetchMock.mock.calls[0][0];
                expect(res.method).toBe('GET');
                expect(res.url).toBe(urlExpected);
                return [2 /*return*/];
            });
        }); });
        it('should apply min interval when interval * intervalFactor smaller', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, urlExpected, res;
            return __generator(this, function (_a) {
                query = {
                    // 6 minute range
                    range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
                    targets: [
                        {
                            expr: 'test',
                            interval: '15s',
                            intervalFactor: 2,
                        },
                    ],
                    interval: '5s',
                };
                urlExpected = 'proxied/api/v1/query_range?query=test' + '&start=60&end=420&step=15';
                fetchMock.mockImplementation(function () { return of(response); });
                ds.query(query);
                res = fetchMock.mock.calls[0][0];
                expect(res.method).toBe('GET');
                expect(res.url).toBe(urlExpected);
                return [2 /*return*/];
            });
        }); });
        it('should apply intervalFactor to auto interval when greater', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, urlExpected, res;
            return __generator(this, function (_a) {
                query = {
                    // 6 minute range
                    range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
                    targets: [
                        {
                            expr: 'test',
                            interval: '5s',
                            intervalFactor: 10,
                        },
                    ],
                    interval: '10s',
                };
                urlExpected = 'proxied/api/v1/query_range?query=test' + '&start=0&end=400&step=100';
                fetchMock.mockImplementation(function () { return of(response); });
                ds.query(query);
                res = fetchMock.mock.calls[0][0];
                expect(res.method).toBe('GET');
                expect(res.url).toBe(urlExpected);
                return [2 /*return*/];
            });
        }); });
        it('should not not be affected by the 11000 data points limit when large enough', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, end, start, urlExpected, res;
            return __generator(this, function (_a) {
                query = {
                    // 1 week range
                    range: { from: time({}), to: time({ hours: 7 * 24 }) },
                    targets: [
                        {
                            expr: 'test',
                            intervalFactor: 10,
                        },
                    ],
                    interval: '10s',
                };
                end = 7 * 24 * 60 * 60;
                start = 0;
                urlExpected = 'proxied/api/v1/query_range?query=test' + '&start=' + start + '&end=' + end + '&step=100';
                fetchMock.mockImplementation(function () { return of(response); });
                ds.query(query);
                res = fetchMock.mock.calls[0][0];
                expect(res.method).toBe('GET');
                expect(res.url).toBe(urlExpected);
                return [2 /*return*/];
            });
        }); });
        it('should be determined by the 11000 data points limit when too small', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, end, start, step, adjusted, urlExpected, res;
            return __generator(this, function (_a) {
                query = {
                    // 1 week range
                    range: { from: time({}), to: time({ hours: 7 * 24 }) },
                    targets: [
                        {
                            expr: 'test',
                            intervalFactor: 10,
                        },
                    ],
                    interval: '5s',
                };
                end = 7 * 24 * 60 * 60;
                end -= end % 55;
                start = 0;
                step = 55;
                adjusted = alignRange(start, end, step, timeSrvStub.timeRange().to.utcOffset() * 60);
                urlExpected = 'proxied/api/v1/query_range?query=test' + '&start=' + adjusted.start + '&end=' + adjusted.end + '&step=' + step;
                fetchMock.mockImplementation(function () { return of(response); });
                ds.query(query);
                res = fetchMock.mock.calls[0][0];
                expect(res.method).toBe('GET');
                expect(res.url).toBe(urlExpected);
                return [2 /*return*/];
            });
        }); });
    });
    describe('The __interval and __interval_ms template variables', function () {
        var response = {
            status: 'success',
            data: {
                data: {
                    resultType: 'matrix',
                    result: [],
                },
            },
        };
        it('should be unchanged when auto interval is greater than min interval', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, urlExpected, res;
            return __generator(this, function (_a) {
                query = {
                    // 6 minute range
                    range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
                    targets: [
                        {
                            expr: 'rate(test[$__interval])',
                            interval: '5s',
                        },
                    ],
                    interval: '10s',
                    scopedVars: {
                        __interval: { text: '10s', value: '10s' },
                        __interval_ms: { text: 10 * 1000, value: 10 * 1000 },
                    },
                };
                urlExpected = 'proxied/api/v1/query_range?query=' +
                    encodeURIComponent('rate(test[$__interval])') +
                    '&start=60&end=420&step=10';
                templateSrvStub.replace = jest.fn(function (str) { return str; });
                fetchMock.mockImplementation(function () { return of(response); });
                ds.query(query);
                res = fetchMock.mock.calls[0][0];
                expect(res.method).toBe('GET');
                expect(res.url).toBe(urlExpected);
                expect(templateSrvStub.replace.mock.calls[0][1]).toEqual({
                    __interval: {
                        text: '10s',
                        value: '10s',
                    },
                    __interval_ms: {
                        text: 10000,
                        value: 10000,
                    },
                });
                return [2 /*return*/];
            });
        }); });
        it('should be min interval when it is greater than auto interval', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, urlExpected, res;
            return __generator(this, function (_a) {
                query = {
                    // 6 minute range
                    range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
                    targets: [
                        {
                            expr: 'rate(test[$__interval])',
                            interval: '10s',
                        },
                    ],
                    interval: '5s',
                    scopedVars: {
                        __interval: { text: '5s', value: '5s' },
                        __interval_ms: { text: 5 * 1000, value: 5 * 1000 },
                    },
                };
                urlExpected = 'proxied/api/v1/query_range?query=' +
                    encodeURIComponent('rate(test[$__interval])') +
                    '&start=60&end=420&step=10';
                fetchMock.mockImplementation(function () { return of(response); });
                templateSrvStub.replace = jest.fn(function (str) { return str; });
                ds.query(query);
                res = fetchMock.mock.calls[0][0];
                expect(res.method).toBe('GET');
                expect(res.url).toBe(urlExpected);
                expect(templateSrvStub.replace.mock.calls[0][1]).toEqual({
                    __interval: {
                        text: '5s',
                        value: '5s',
                    },
                    __interval_ms: {
                        text: 5000,
                        value: 5000,
                    },
                });
                return [2 /*return*/];
            });
        }); });
        it('should account for intervalFactor', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, urlExpected, res;
            return __generator(this, function (_a) {
                query = {
                    // 6 minute range
                    range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
                    targets: [
                        {
                            expr: 'rate(test[$__interval])',
                            interval: '5s',
                            intervalFactor: 10,
                        },
                    ],
                    interval: '10s',
                    scopedVars: {
                        __interval: { text: '10s', value: '10s' },
                        __interval_ms: { text: 10 * 1000, value: 10 * 1000 },
                    },
                };
                urlExpected = 'proxied/api/v1/query_range?query=' +
                    encodeURIComponent('rate(test[$__interval])') +
                    '&start=0&end=400&step=100';
                fetchMock.mockImplementation(function () { return of(response); });
                templateSrvStub.replace = jest.fn(function (str) { return str; });
                ds.query(query);
                res = fetchMock.mock.calls[0][0];
                expect(res.method).toBe('GET');
                expect(res.url).toBe(urlExpected);
                expect(templateSrvStub.replace.mock.calls[0][1]).toEqual({
                    __interval: {
                        text: '10s',
                        value: '10s',
                    },
                    __interval_ms: {
                        text: 10000,
                        value: 10000,
                    },
                });
                expect(query.scopedVars.__interval.text).toBe('10s');
                expect(query.scopedVars.__interval.value).toBe('10s');
                expect(query.scopedVars.__interval_ms.text).toBe(10 * 1000);
                expect(query.scopedVars.__interval_ms.value).toBe(10 * 1000);
                return [2 /*return*/];
            });
        }); });
        it('should be interval * intervalFactor when greater than min interval', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, urlExpected, res;
            return __generator(this, function (_a) {
                query = {
                    // 6 minute range
                    range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
                    targets: [
                        {
                            expr: 'rate(test[$__interval])',
                            interval: '10s',
                            intervalFactor: 10,
                        },
                    ],
                    interval: '5s',
                    scopedVars: {
                        __interval: { text: '5s', value: '5s' },
                        __interval_ms: { text: 5 * 1000, value: 5 * 1000 },
                    },
                };
                urlExpected = 'proxied/api/v1/query_range?query=' +
                    encodeURIComponent('rate(test[$__interval])') +
                    '&start=50&end=400&step=50';
                templateSrvStub.replace = jest.fn(function (str) { return str; });
                fetchMock.mockImplementation(function () { return of(response); });
                ds.query(query);
                res = fetchMock.mock.calls[0][0];
                expect(res.method).toBe('GET');
                expect(res.url).toBe(urlExpected);
                expect(templateSrvStub.replace.mock.calls[0][1]).toEqual({
                    __interval: {
                        text: '5s',
                        value: '5s',
                    },
                    __interval_ms: {
                        text: 5000,
                        value: 5000,
                    },
                });
                return [2 /*return*/];
            });
        }); });
        it('should be min interval when greater than interval * intervalFactor', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, urlExpected, res;
            return __generator(this, function (_a) {
                query = {
                    // 6 minute range
                    range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
                    targets: [
                        {
                            expr: 'rate(test[$__interval])',
                            interval: '15s',
                            intervalFactor: 2,
                        },
                    ],
                    interval: '5s',
                    scopedVars: {
                        __interval: { text: '5s', value: '5s' },
                        __interval_ms: { text: 5 * 1000, value: 5 * 1000 },
                    },
                };
                urlExpected = 'proxied/api/v1/query_range?query=' +
                    encodeURIComponent('rate(test[$__interval])') +
                    '&start=60&end=420&step=15';
                fetchMock.mockImplementation(function () { return of(response); });
                ds.query(query);
                res = fetchMock.mock.calls[0][0];
                expect(res.method).toBe('GET');
                expect(res.url).toBe(urlExpected);
                expect(templateSrvStub.replace.mock.calls[0][1]).toEqual({
                    __interval: {
                        text: '5s',
                        value: '5s',
                    },
                    __interval_ms: {
                        text: 5000,
                        value: 5000,
                    },
                });
                return [2 /*return*/];
            });
        }); });
        it('should be determined by the 11000 data points limit, accounting for intervalFactor', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, end, start, step, adjusted, urlExpected, res;
            return __generator(this, function (_a) {
                query = {
                    // 1 week range
                    range: { from: time({}), to: time({ hours: 7 * 24 }) },
                    targets: [
                        {
                            expr: 'rate(test[$__interval])',
                            intervalFactor: 10,
                        },
                    ],
                    interval: '5s',
                    scopedVars: {
                        __interval: { text: '5s', value: '5s' },
                        __interval_ms: { text: 5 * 1000, value: 5 * 1000 },
                    },
                };
                end = 7 * 24 * 60 * 60;
                end -= end % 55;
                start = 0;
                step = 55;
                adjusted = alignRange(start, end, step, timeSrvStub.timeRange().to.utcOffset() * 60);
                urlExpected = 'proxied/api/v1/query_range?query=' +
                    encodeURIComponent('rate(test[$__interval])') +
                    '&start=' +
                    adjusted.start +
                    '&end=' +
                    adjusted.end +
                    '&step=' +
                    step;
                fetchMock.mockImplementation(function () { return of(response); });
                templateSrvStub.replace = jest.fn(function (str) { return str; });
                ds.query(query);
                res = fetchMock.mock.calls[0][0];
                expect(res.method).toBe('GET');
                expect(res.url).toBe(urlExpected);
                expect(templateSrvStub.replace.mock.calls[0][1]).toEqual({
                    __interval: {
                        text: '5s',
                        value: '5s',
                    },
                    __interval_ms: {
                        text: 5000,
                        value: 5000,
                    },
                });
                return [2 /*return*/];
            });
        }); });
    });
    describe('The __range, __range_s and __range_ms variables', function () {
        var response = {
            status: 'success',
            data: {
                data: {
                    resultType: 'matrix',
                    result: [],
                },
            },
        };
        it('should use overridden ranges, not dashboard ranges', function () { return __awaiter(void 0, void 0, void 0, function () {
            var expectedRangeSecond, expectedRangeString, query, urlExpected, res;
            return __generator(this, function (_a) {
                expectedRangeSecond = 3600;
                expectedRangeString = '3600s';
                query = {
                    range: {
                        from: time({}),
                        to: time({ hours: 1 }),
                    },
                    targets: [
                        {
                            expr: 'test[${__range_s}s]',
                        },
                    ],
                    interval: '60s',
                };
                urlExpected = "proxied/api/v1/query_range?query=" + encodeURIComponent(query.targets[0].expr) + "&start=0&end=3600&step=60";
                templateSrvStub.replace = jest.fn(function (str) { return str; });
                fetchMock.mockImplementation(function () { return of(response); });
                ds.query(query);
                res = fetchMock.mock.calls[0][0];
                expect(res.url).toBe(urlExpected);
                expect(templateSrvStub.replace.mock.calls[1][1]).toEqual({
                    __range_s: {
                        text: expectedRangeSecond,
                        value: expectedRangeSecond,
                    },
                    __range: {
                        text: expectedRangeString,
                        value: expectedRangeString,
                    },
                    __range_ms: {
                        text: expectedRangeSecond * 1000,
                        value: expectedRangeSecond * 1000,
                    },
                    __rate_interval: {
                        text: '75s',
                        value: '75s',
                    },
                });
                return [2 /*return*/];
            });
        }); });
    });
    describe('The __rate_interval variable', function () {
        var target = { expr: 'rate(process_cpu_seconds_total[$__rate_interval])', refId: 'A' };
        beforeEach(function () {
            templateSrvStub.replace.mockClear();
        });
        it('should be 4 times the scrape interval if interval + scrape interval is lower', function () {
            ds.createQuery(target, { interval: '15s' }, 0, 300);
            expect(templateSrvStub.replace.mock.calls[1][1]['__rate_interval'].value).toBe('60s');
        });
        it('should be interval + scrape interval if 4 times the scrape interval is lower', function () {
            ds.createQuery(target, { interval: '5m' }, 0, 10080);
            expect(templateSrvStub.replace.mock.calls[1][1]['__rate_interval'].value).toBe('315s');
        });
        it('should fall back to a scrape interval of 15s if min step is set to 0, resulting in 4*15s = 60s', function () {
            ds.createQuery(__assign(__assign({}, target), { interval: '' }), { interval: '15s' }, 0, 300);
            expect(templateSrvStub.replace.mock.calls[1][1]['__rate_interval'].value).toBe('60s');
        });
        it('should be 4 times the scrape interval if min step set to 1m and interval is 15s', function () {
            // For a 5m graph, $__interval is 15s
            ds.createQuery(__assign(__assign({}, target), { interval: '1m' }), { interval: '15s' }, 0, 300);
            expect(templateSrvStub.replace.mock.calls[2][1]['__rate_interval'].value).toBe('240s');
        });
        it('should be interval + scrape interval if min step set to 1m and interval is 5m', function () {
            // For a 7d graph, $__interval is 5m
            ds.createQuery(__assign(__assign({}, target), { interval: '1m' }), { interval: '5m' }, 0, 10080);
            expect(templateSrvStub.replace.mock.calls[2][1]['__rate_interval'].value).toBe('360s');
        });
        it('should be interval + scrape interval if resolution is set to 1/2 and interval is 10m', function () {
            // For a 7d graph, $__interval is 10m
            ds.createQuery(__assign(__assign({}, target), { intervalFactor: 2 }), { interval: '10m' }, 0, 10080);
            expect(templateSrvStub.replace.mock.calls[1][1]['__rate_interval'].value).toBe('1215s');
        });
        it('should be 4 times the scrape interval if resolution is set to 1/2 and interval is 15s', function () {
            // For a 5m graph, $__interval is 15s
            ds.createQuery(__assign(__assign({}, target), { intervalFactor: 2 }), { interval: '15s' }, 0, 300);
            expect(templateSrvStub.replace.mock.calls[1][1]['__rate_interval'].value).toBe('60s');
        });
        it('should interpolate min step if set', function () {
            templateSrvStub.replace = jest.fn(function (_) { return '15s'; });
            ds.createQuery(__assign(__assign({}, target), { interval: '$int' }), { interval: '15s' }, 0, 300);
            expect(templateSrvStub.replace.mock.calls).toHaveLength(3);
            templateSrvStub.replace = jest.fn(function (a) { return a; });
        });
    });
});
describe('PrometheusDatasource for POST', function () {
    var instanceSettings = {
        url: 'proxied',
        directUrl: 'direct',
        user: 'test',
        password: 'mupp',
        jsonData: { httpMethod: 'POST' },
    };
    var ds;
    beforeEach(function () {
        ds = new PrometheusDatasource(instanceSettings, templateSrvStub, timeSrvStub);
    });
    describe('When querying prometheus with one target using query editor target spec', function () {
        var results;
        var urlExpected = 'proxied/api/v1/query_range';
        var dataExpected = {
            query: 'test{job="testjob"}',
            start: 1 * 60,
            end: 2 * 60,
            step: 60,
        };
        var query = {
            range: { from: time({ minutes: 1, seconds: 3 }), to: time({ minutes: 2, seconds: 3 }) },
            targets: [{ expr: 'test{job="testjob"}', format: 'time_series' }],
            interval: '60s',
        };
        beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                response = {
                    status: 'success',
                    data: {
                        data: {
                            resultType: 'matrix',
                            result: [
                                {
                                    metric: { __name__: 'test', job: 'testjob' },
                                    values: [[2 * 60, '3846']],
                                },
                            ],
                        },
                    },
                };
                fetchMock.mockImplementation(function () { return of(response); });
                ds.query(query).subscribe(function (data) {
                    results = data;
                });
                return [2 /*return*/];
            });
        }); });
        it('should generate the correct query', function () {
            var res = fetchMock.mock.calls[0][0];
            expect(res.method).toBe('POST');
            expect(res.url).toBe(urlExpected);
            expect(res.data).toEqual(dataExpected);
        });
        it('should return series list', function () {
            var frame = toDataFrame(results.data[0]);
            expect(results.data.length).toBe(1);
            expect(getFieldDisplayName(frame.fields[1], frame)).toBe('test{job="testjob"}');
        });
    });
    describe('When querying prometheus via check headers X-Dashboard-Id and X-Panel-Id', function () {
        var options = { dashboardId: 1, panelId: 2 };
        var httpOptions = {
            headers: {},
        };
        it('with proxy access tracing headers should be added', function () {
            ds._addTracingHeaders(httpOptions, options);
            expect(httpOptions.headers['X-Dashboard-Id']).toBe(1);
            expect(httpOptions.headers['X-Panel-Id']).toBe(2);
        });
        it('with direct access tracing headers should not be added', function () {
            var mockDs = new PrometheusDatasource(__assign(__assign({}, instanceSettings), { url: 'http://127.0.0.1:8000' }), templateSrvStub, timeSrvStub);
            mockDs._addTracingHeaders(httpOptions, options);
            expect(httpOptions.headers['X-Dashboard-Id']).toBe(undefined);
            expect(httpOptions.headers['X-Panel-Id']).toBe(undefined);
        });
    });
});
function getPrepareTargetsContext(_a) {
    var targets = _a.targets, app = _a.app, queryOptions = _a.queryOptions, languageProvider = _a.languageProvider;
    var instanceSettings = {
        url: 'proxied',
        directUrl: 'direct',
        user: 'test',
        password: 'mupp',
        jsonData: { httpMethod: 'POST' },
    };
    var start = 0;
    var end = 1;
    var panelId = '2';
    var options = __assign({ targets: targets, interval: '1s', panelId: panelId, app: app }, queryOptions);
    var ds = new PrometheusDatasource(instanceSettings, templateSrvStub, timeSrvStub);
    if (languageProvider) {
        ds.languageProvider = languageProvider;
    }
    var _b = ds.prepareTargets(options, start, end), queries = _b.queries, activeTargets = _b.activeTargets;
    return {
        queries: queries,
        activeTargets: activeTargets,
        start: start,
        end: end,
        panelId: panelId,
    };
}
describe('prepareTargets', function () {
    describe('when run from a Panel', function () {
        it('then it should just add targets', function () {
            var target = {
                refId: 'A',
                expr: 'up',
                requestId: '2A',
            };
            var _a = getPrepareTargetsContext({ targets: [target] }), queries = _a.queries, activeTargets = _a.activeTargets, panelId = _a.panelId, end = _a.end, start = _a.start;
            expect(queries.length).toBe(1);
            expect(activeTargets.length).toBe(1);
            expect(queries[0]).toEqual({
                end: end,
                expr: 'up',
                headers: {
                    'X-Dashboard-Id': undefined,
                    'X-Panel-Id': panelId,
                },
                hinting: undefined,
                instant: undefined,
                refId: target.refId,
                requestId: panelId + target.refId,
                start: start,
                step: 1,
            });
            expect(activeTargets[0]).toEqual(target);
        });
        it('should give back 3 targets when multiple queries with exemplar enabled and same metric', function () {
            var targetA = {
                refId: 'A',
                expr: 'histogram_quantile(0.95, sum(rate(tns_request_duration_seconds_bucket[5m])) by (le))',
                exemplar: true,
            };
            var targetB = {
                refId: 'B',
                expr: 'histogram_quantile(0.5, sum(rate(tns_request_duration_seconds_bucket[5m])) by (le))',
                exemplar: true,
            };
            var _a = getPrepareTargetsContext({
                targets: [targetA, targetB],
                languageProvider: {
                    histogramMetrics: ['tns_request_duration_seconds_bucket'],
                },
            }), queries = _a.queries, activeTargets = _a.activeTargets;
            expect(queries).toHaveLength(3);
            expect(activeTargets).toHaveLength(3);
        });
        it('should give back 4 targets when multiple queries with exemplar enabled', function () {
            var targetA = {
                refId: 'A',
                expr: 'histogram_quantile(0.95, sum(rate(tns_request_duration_seconds_bucket[5m])) by (le))',
                exemplar: true,
            };
            var targetB = {
                refId: 'B',
                expr: 'histogram_quantile(0.5, sum(rate(tns_request_duration_bucket[5m])) by (le))',
                exemplar: true,
            };
            var _a = getPrepareTargetsContext({
                targets: [targetA, targetB],
                languageProvider: {
                    histogramMetrics: ['tns_request_duration_seconds_bucket'],
                },
            }), queries = _a.queries, activeTargets = _a.activeTargets;
            expect(queries).toHaveLength(4);
            expect(activeTargets).toHaveLength(4);
        });
        it('should give back 2 targets when exemplar enabled', function () {
            var target = {
                refId: 'A',
                expr: 'up',
                exemplar: true,
            };
            var _a = getPrepareTargetsContext({ targets: [target] }), queries = _a.queries, activeTargets = _a.activeTargets;
            expect(queries).toHaveLength(2);
            expect(activeTargets).toHaveLength(2);
            expect(activeTargets[0].exemplar).toBe(true);
            expect(activeTargets[1].exemplar).toBe(false);
        });
        it('should give back 1 target when exemplar and instant are enabled', function () {
            var target = {
                refId: 'A',
                expr: 'up',
                exemplar: true,
                instant: true,
            };
            var _a = getPrepareTargetsContext({ targets: [target] }), queries = _a.queries, activeTargets = _a.activeTargets;
            expect(queries).toHaveLength(1);
            expect(activeTargets).toHaveLength(1);
            expect(activeTargets[0].instant).toBe(true);
        });
    });
    describe('when run from Explore', function () {
        describe('when query type Both is selected', function () {
            it('should give back 6 targets when multiple queries with exemplar enabled', function () {
                var targetA = {
                    refId: 'A',
                    expr: 'histogram_quantile(0.95, sum(rate(tns_request_duration_seconds_bucket[5m])) by (le))',
                    instant: true,
                    range: true,
                    exemplar: true,
                };
                var targetB = {
                    refId: 'B',
                    expr: 'histogram_quantile(0.5, sum(rate(tns_request_duration_bucket[5m])) by (le))',
                    exemplar: true,
                    instant: true,
                    range: true,
                };
                var _a = getPrepareTargetsContext({
                    targets: [targetA, targetB],
                    app: CoreApp.Explore,
                    languageProvider: {
                        histogramMetrics: ['tns_request_duration_seconds_bucket'],
                    },
                }), queries = _a.queries, activeTargets = _a.activeTargets;
                expect(queries).toHaveLength(6);
                expect(activeTargets).toHaveLength(6);
            });
            it('should give back 5 targets when multiple queries with exemplar enabled and same metric', function () {
                var targetA = {
                    refId: 'A',
                    expr: 'histogram_quantile(0.95, sum(rate(tns_request_duration_seconds_bucket[5m])) by (le))',
                    instant: true,
                    range: true,
                    exemplar: true,
                };
                var targetB = {
                    refId: 'B',
                    expr: 'histogram_quantile(0.5, sum(rate(tns_request_duration_seconds_bucket[5m])) by (le))',
                    exemplar: true,
                    instant: true,
                    range: true,
                };
                var _a = getPrepareTargetsContext({
                    targets: [targetA, targetB],
                    app: CoreApp.Explore,
                    languageProvider: {
                        histogramMetrics: ['tns_request_duration_seconds_bucket'],
                    },
                }), queries = _a.queries, activeTargets = _a.activeTargets;
                expect(queries).toHaveLength(5);
                expect(activeTargets).toHaveLength(5);
            });
            it('then it should return both instant and time series related objects', function () {
                var target = {
                    refId: 'A',
                    expr: 'up',
                    range: true,
                    instant: true,
                    requestId: '2A',
                };
                var _a = getPrepareTargetsContext({
                    targets: [target],
                    app: CoreApp.Explore,
                }), queries = _a.queries, activeTargets = _a.activeTargets, panelId = _a.panelId, end = _a.end, start = _a.start;
                expect(queries.length).toBe(2);
                expect(activeTargets.length).toBe(2);
                expect(queries[0]).toEqual({
                    end: end,
                    expr: 'up',
                    headers: {
                        'X-Dashboard-Id': undefined,
                        'X-Panel-Id': panelId,
                    },
                    hinting: undefined,
                    instant: true,
                    refId: target.refId,
                    requestId: panelId + target.refId + '_instant',
                    start: start,
                    step: 1,
                });
                expect(activeTargets[0]).toEqual(__assign(__assign({}, target), { format: 'table', instant: true, requestId: panelId + target.refId + '_instant', valueWithRefId: true }));
                expect(queries[1]).toEqual({
                    end: end,
                    expr: 'up',
                    headers: {
                        'X-Dashboard-Id': undefined,
                        'X-Panel-Id': panelId,
                    },
                    hinting: undefined,
                    instant: false,
                    refId: target.refId,
                    requestId: panelId + target.refId,
                    start: start,
                    step: 1,
                });
                expect(activeTargets[1]).toEqual(__assign(__assign({}, target), { format: 'time_series', instant: false, requestId: panelId + target.refId }));
            });
        });
        describe('when query type Instant is selected', function () {
            it('then it should target and modify its format to table', function () {
                var target = {
                    refId: 'A',
                    expr: 'up',
                    instant: true,
                    range: false,
                    requestId: '2A',
                };
                var _a = getPrepareTargetsContext({
                    targets: [target],
                    app: CoreApp.Explore,
                }), queries = _a.queries, activeTargets = _a.activeTargets, panelId = _a.panelId, end = _a.end, start = _a.start;
                expect(queries.length).toBe(1);
                expect(activeTargets.length).toBe(1);
                expect(queries[0]).toEqual({
                    end: end,
                    expr: 'up',
                    headers: {
                        'X-Dashboard-Id': undefined,
                        'X-Panel-Id': panelId,
                    },
                    hinting: undefined,
                    instant: true,
                    refId: target.refId,
                    requestId: panelId + target.refId,
                    start: start,
                    step: 1,
                });
                expect(activeTargets[0]).toEqual(__assign(__assign({}, target), { format: 'table' }));
            });
        });
    });
    describe('when query type Range is selected', function () {
        it('then it should just add targets', function () {
            var target = {
                refId: 'A',
                expr: 'up',
                range: true,
                instant: false,
                requestId: '2A',
            };
            var _a = getPrepareTargetsContext({
                targets: [target],
                app: CoreApp.Explore,
            }), queries = _a.queries, activeTargets = _a.activeTargets, panelId = _a.panelId, end = _a.end, start = _a.start;
            expect(queries.length).toBe(1);
            expect(activeTargets.length).toBe(1);
            expect(queries[0]).toEqual({
                end: end,
                expr: 'up',
                headers: {
                    'X-Dashboard-Id': undefined,
                    'X-Panel-Id': panelId,
                },
                hinting: undefined,
                instant: false,
                refId: target.refId,
                requestId: panelId + target.refId,
                start: start,
                step: 1,
            });
            expect(activeTargets[0]).toEqual(target);
        });
    });
});
describe('modifyQuery', function () {
    describe('when called with ADD_FILTER', function () {
        describe('and query has no labels', function () {
            it('then the correct label should be added', function () {
                var query = { refId: 'A', expr: 'go_goroutines' };
                var action = { key: 'cluster', value: 'us-cluster', type: 'ADD_FILTER' };
                var instanceSettings = { jsonData: {} };
                var ds = new PrometheusDatasource(instanceSettings, templateSrvStub, timeSrvStub);
                var result = ds.modifyQuery(query, action);
                expect(result.refId).toEqual('A');
                expect(result.expr).toEqual('go_goroutines{cluster="us-cluster"}');
            });
        });
        describe('and query has labels', function () {
            it('then the correct label should be added', function () {
                var query = { refId: 'A', expr: 'go_goroutines{cluster="us-cluster"}' };
                var action = { key: 'pod', value: 'pod-123', type: 'ADD_FILTER' };
                var instanceSettings = { jsonData: {} };
                var ds = new PrometheusDatasource(instanceSettings, templateSrvStub, timeSrvStub);
                var result = ds.modifyQuery(query, action);
                expect(result.refId).toEqual('A');
                expect(result.expr).toEqual('go_goroutines{cluster="us-cluster",pod="pod-123"}');
            });
        });
    });
    describe('when called with ADD_FILTER_OUT', function () {
        describe('and query has no labels', function () {
            it('then the correct label should be added', function () {
                var query = { refId: 'A', expr: 'go_goroutines' };
                var action = { key: 'cluster', value: 'us-cluster', type: 'ADD_FILTER_OUT' };
                var instanceSettings = { jsonData: {} };
                var ds = new PrometheusDatasource(instanceSettings, templateSrvStub, timeSrvStub);
                var result = ds.modifyQuery(query, action);
                expect(result.refId).toEqual('A');
                expect(result.expr).toEqual('go_goroutines{cluster!="us-cluster"}');
            });
        });
        describe('and query has labels', function () {
            it('then the correct label should be added', function () {
                var query = { refId: 'A', expr: 'go_goroutines{cluster="us-cluster"}' };
                var action = { key: 'pod', value: 'pod-123', type: 'ADD_FILTER_OUT' };
                var instanceSettings = { jsonData: {} };
                var ds = new PrometheusDatasource(instanceSettings, templateSrvStub, timeSrvStub);
                var result = ds.modifyQuery(query, action);
                expect(result.refId).toEqual('A');
                expect(result.expr).toEqual('go_goroutines{cluster="us-cluster",pod!="pod-123"}');
            });
        });
    });
});
function createDataRequest(targets, overrides) {
    var defaults = {
        app: CoreApp.Dashboard,
        targets: targets.map(function (t) {
            return __assign({ instant: false, start: dateTime().subtract(5, 'minutes'), end: dateTime(), expr: 'test' }, t);
        }),
        range: {
            from: dateTime(),
            to: dateTime(),
        },
        interval: '15s',
        showingGraph: true,
    };
    return Object.assign(defaults, overrides || {});
}
function createDefaultPromResponse() {
    return {
        data: {
            data: {
                result: [
                    {
                        metric: {
                            __name__: 'test_metric',
                        },
                        values: [[1568369640, 1]],
                    },
                ],
                resultType: 'matrix',
            },
        },
    };
}
var templateObject_1;
//# sourceMappingURL=datasource.test.js.map