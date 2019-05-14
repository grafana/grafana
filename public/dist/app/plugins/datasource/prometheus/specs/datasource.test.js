var _this = this;
import * as tslib_1 from "tslib";
import _ from 'lodash';
import moment from 'moment';
import q from 'q';
import { alignRange, extractRuleMappingFromGroups, PrometheusDatasource, prometheusSpecialRegexEscape, prometheusRegularEscape, } from '../datasource';
jest.mock('../metric_find_query');
var DEFAULT_TEMPLATE_SRV_MOCK = {
    getAdhocFilters: function () { return []; },
    replace: function (a) { return a; },
};
describe('PrometheusDatasource', function () {
    var ctx = {};
    var instanceSettings = {
        url: 'proxied',
        directUrl: 'direct',
        user: 'test',
        password: 'mupp',
        jsonData: {},
    };
    ctx.backendSrvMock = {};
    ctx.templateSrvMock = DEFAULT_TEMPLATE_SRV_MOCK;
    ctx.timeSrvMock = {
        timeRange: function () {
            return {
                from: moment(1531468681),
                to: moment(1531489712),
            };
        },
    };
    beforeEach(function () {
        ctx.ds = new PrometheusDatasource(instanceSettings, q, ctx.backendSrvMock, ctx.templateSrvMock, ctx.timeSrvMock);
    });
    describe('Datasource metadata requests', function () {
        it('should perform a GET request with the default config', function () {
            ctx.backendSrvMock.datasourceRequest = jest.fn();
            ctx.ds.metadataRequest('/foo');
            expect(ctx.backendSrvMock.datasourceRequest.mock.calls.length).toBe(1);
            expect(ctx.backendSrvMock.datasourceRequest.mock.calls[0][0].method).toBe('GET');
        });
        it('should still perform a GET request with the DS HTTP method set to POST', function () {
            ctx.backendSrvMock.datasourceRequest = jest.fn();
            var postSettings = _.cloneDeep(instanceSettings);
            postSettings.jsonData.httpMethod = 'POST';
            var ds = new PrometheusDatasource(postSettings, q, ctx.backendSrvMock, ctx.templateSrvMock, ctx.timeSrvMock);
            ds.metadataRequest('/foo');
            expect(ctx.backendSrvMock.datasourceRequest.mock.calls.length).toBe(1);
            expect(ctx.backendSrvMock.datasourceRequest.mock.calls[0][0].method).toBe('GET');
        });
    });
    describe('When using adhoc filters', function () {
        var DEFAULT_QUERY_EXPRESSION = 'metric{job="foo"} - metric';
        var target = { expr: DEFAULT_QUERY_EXPRESSION };
        afterEach(function () {
            ctx.templateSrvMock.getAdhocFilters = DEFAULT_TEMPLATE_SRV_MOCK.getAdhocFilters;
        });
        it('should not modify expression with no filters', function () {
            var result = ctx.ds.createQuery(target, { interval: '15s' });
            expect(result).toMatchObject({ expr: DEFAULT_QUERY_EXPRESSION });
        });
        it('should add filters to expression', function () {
            ctx.templateSrvMock.getAdhocFilters = function () { return [
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
            ]; };
            var result = ctx.ds.createQuery(target, { interval: '15s' });
            expect(result).toMatchObject({ expr: 'metric{job="foo",k1="v1",k2!="v2"} - metric{k1="v1",k2!="v2"}' });
        });
    });
    describe('When performing performSuggestQuery', function () {
        it('should cache response', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var results;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ctx.backendSrvMock.datasourceRequest.mockReturnValue(Promise.resolve({
                            status: 'success',
                            data: { data: ['value1', 'value2', 'value3'] },
                        }));
                        return [4 /*yield*/, ctx.ds.performSuggestQuery('value', true)];
                    case 1:
                        results = _a.sent();
                        expect(results).toHaveLength(3);
                        ctx.backendSrvMock.datasourceRequest.mockReset();
                        return [4 /*yield*/, ctx.ds.performSuggestQuery('value', true)];
                    case 2:
                        results = _a.sent();
                        expect(results).toHaveLength(3);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When converting prometheus histogram to heatmap format', function () {
        beforeEach(function () {
            ctx.query = {
                range: { from: moment(1443454528000), to: moment(1443454528000) },
                targets: [{ expr: 'test{job="testjob"}', format: 'heatmap', legendFormat: '{{le}}' }],
                interval: '1s',
            };
        });
        it('should convert cumullative histogram to ordinary', function () {
            var resultMock = [
                {
                    metric: { __name__: 'metric', job: 'testjob', le: '10' },
                    values: [[1443454528.0, '10'], [1443454528.0, '10']],
                },
                {
                    metric: { __name__: 'metric', job: 'testjob', le: '20' },
                    values: [[1443454528.0, '20'], [1443454528.0, '10']],
                },
                {
                    metric: { __name__: 'metric', job: 'testjob', le: '30' },
                    values: [[1443454528.0, '25'], [1443454528.0, '10']],
                },
            ];
            var responseMock = { data: { data: { result: resultMock } } };
            var expected = [
                {
                    target: '10',
                    datapoints: [[10, 1443454528000], [10, 1443454528000]],
                },
                {
                    target: '20',
                    datapoints: [[10, 1443454528000], [0, 1443454528000]],
                },
                {
                    target: '30',
                    datapoints: [[5, 1443454528000], [0, 1443454528000]],
                },
            ];
            ctx.ds.performTimeSeriesQuery = jest.fn().mockReturnValue(responseMock);
            return ctx.ds.query(ctx.query).then(function (result) {
                var results = result.data;
                return expect(results).toMatchObject(expected);
            });
        });
        it('should sort series by label value', function () {
            var resultMock = [
                {
                    metric: { __name__: 'metric', job: 'testjob', le: '2' },
                    values: [[1443454528.0, '10'], [1443454528.0, '10']],
                },
                {
                    metric: { __name__: 'metric', job: 'testjob', le: '4' },
                    values: [[1443454528.0, '20'], [1443454528.0, '10']],
                },
                {
                    metric: { __name__: 'metric', job: 'testjob', le: '+Inf' },
                    values: [[1443454528.0, '25'], [1443454528.0, '10']],
                },
                {
                    metric: { __name__: 'metric', job: 'testjob', le: '1' },
                    values: [[1443454528.0, '25'], [1443454528.0, '10']],
                },
            ];
            var responseMock = { data: { data: { result: resultMock } } };
            var expected = ['1', '2', '4', '+Inf'];
            ctx.ds.performTimeSeriesQuery = jest.fn().mockReturnValue(responseMock);
            return ctx.ds.query(ctx.query).then(function (result) {
                var seriesLabels = _.map(result.data, 'target');
                return expect(seriesLabels).toEqual(expected);
            });
        });
    });
    describe('alignRange', function () {
        it('does not modify already aligned intervals with perfect step', function () {
            var range = alignRange(0, 3, 3);
            expect(range.start).toEqual(0);
            expect(range.end).toEqual(3);
        });
        it('does modify end-aligned intervals to reflect number of steps possible', function () {
            var range = alignRange(1, 6, 3);
            expect(range.start).toEqual(0);
            expect(range.end).toEqual(6);
        });
        it('does align intervals that are a multiple of steps', function () {
            var range = alignRange(1, 4, 3);
            expect(range.start).toEqual(0);
            expect(range.end).toEqual(6);
        });
        it('does align intervals that are not a multiple of steps', function () {
            var range = alignRange(1, 5, 3);
            expect(range.start).toEqual(0);
            expect(range.end).toEqual(6);
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
        it('should escape multiple characters', function () {
            expect(prometheusRegularEscape("'looking'glass'")).toEqual("\\\\'looking\\\\'glass\\\\'");
        });
    });
    describe('Prometheus regexes escaping', function () {
        it('should not escape simple string', function () {
            expect(prometheusSpecialRegexEscape('cryptodepression')).toEqual('cryptodepression');
        });
        it('should escape $^*+?.()\\', function () {
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
        });
        it('should escape multiple special characters', function () {
            expect(prometheusSpecialRegexEscape('+looking$glass?')).toEqual('\\\\+looking\\\\$glass\\\\?');
        });
    });
    describe('metricFindQuery', function () {
        beforeEach(function () {
            var query = 'query_result(topk(5,rate(http_request_duration_microseconds_count[$__interval])))';
            ctx.templateSrvMock.replace = jest.fn();
            ctx.timeSrvMock.timeRange = function () {
                return {
                    from: moment(1531468681),
                    to: moment(1531489712),
                };
            };
            ctx.ds = new PrometheusDatasource(instanceSettings, q, ctx.backendSrvMock, ctx.templateSrvMock, ctx.timeSrvMock);
            ctx.ds.metricFindQuery(query);
        });
        it('should call templateSrv.replace with scopedVars', function () {
            expect(ctx.templateSrvMock.replace.mock.calls[0][1]).toBeDefined();
        });
        it('should have the correct range and range_ms', function () {
            var range = ctx.templateSrvMock.replace.mock.calls[0][1].__range;
            var rangeMs = ctx.templateSrvMock.replace.mock.calls[0][1].__range_ms;
            var rangeS = ctx.templateSrvMock.replace.mock.calls[0][1].__range_s;
            expect(range).toEqual({ text: '21s', value: '21s' });
            expect(rangeMs).toEqual({ text: 21031, value: 21031 });
            expect(rangeS).toEqual({ text: 21, value: 21 });
        });
        it('should pass the default interval value', function () {
            var interval = ctx.templateSrvMock.replace.mock.calls[0][1].__interval;
            var intervalMs = ctx.templateSrvMock.replace.mock.calls[0][1].__interval_ms;
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
    return moment(hours * HOUR + minutes * MINUTE + seconds * SECOND);
};
var ctx = {};
var instanceSettings = {
    url: 'proxied',
    directUrl: 'direct',
    user: 'test',
    password: 'mupp',
    jsonData: { httpMethod: 'GET' },
};
var backendSrv = {
    datasourceRequest: jest.fn(),
};
var templateSrv = {
    getAdhocFilters: function () { return []; },
    replace: jest.fn(function (str) { return str; }),
};
var timeSrv = {
    timeRange: function () {
        return { to: { diff: function () { return 2000; } }, from: '' };
    },
};
describe('PrometheusDatasource', function () {
    describe('When querying prometheus with one target using query editor target spec', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var results, query, urlExpected;
        var _this = this;
        return tslib_1.__generator(this, function (_a) {
            query = {
                range: { from: time({ seconds: 63 }), to: time({ seconds: 183 }) },
                targets: [{ expr: 'test{job="testjob"}', format: 'time_series' }],
                interval: '60s',
            };
            urlExpected = 'proxied/api/v1/query_range?query=' + encodeURIComponent('test{job="testjob"}') + '&start=60&end=240&step=60';
            beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                var response;
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
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
                            backendSrv.datasourceRequest = jest.fn(function () { return Promise.resolve(response); });
                            ctx.ds = new PrometheusDatasource(instanceSettings, q, backendSrv, templateSrv, timeSrv);
                            return [4 /*yield*/, ctx.ds.query(query).then(function (data) {
                                    results = data;
                                })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should generate the correct query', function () {
                var res = backendSrv.datasourceRequest.mock.calls[0][0];
                expect(res.method).toBe('GET');
                expect(res.url).toBe(urlExpected);
            });
            it('should return series list', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                return tslib_1.__generator(this, function (_a) {
                    expect(results.data.length).toBe(1);
                    expect(results.data[0].target).toBe('test{job="testjob"}');
                    return [2 /*return*/];
                });
            }); });
            return [2 /*return*/];
        });
    }); });
    describe('When querying prometheus with one target which return multiple series', function () {
        var results;
        var start = 60;
        var end = 360;
        var step = 60;
        var query = {
            range: { from: time({ seconds: start }), to: time({ seconds: end }) },
            targets: [{ expr: 'test{job="testjob"}', format: 'time_series' }],
            interval: '60s',
        };
        beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var response;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        response = {
                            status: 'success',
                            data: {
                                data: {
                                    resultType: 'matrix',
                                    result: [
                                        {
                                            metric: { __name__: 'test', job: 'testjob', series: 'series 1' },
                                            values: [[start + step * 1, '3846'], [start + step * 3, '3847'], [end - step * 1, '3848']],
                                        },
                                        {
                                            metric: { __name__: 'test', job: 'testjob', series: 'series 2' },
                                            values: [[start + step * 2, '4846']],
                                        },
                                    ],
                                },
                            },
                        };
                        backendSrv.datasourceRequest = jest.fn(function () { return Promise.resolve(response); });
                        ctx.ds = new PrometheusDatasource(instanceSettings, q, backendSrv, templateSrv, timeSrv);
                        return [4 /*yield*/, ctx.ds.query(query).then(function (data) {
                                results = data;
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should be same length', function () {
            expect(results.data.length).toBe(2);
            expect(results.data[0].datapoints.length).toBe((end - start) / step + 1);
            expect(results.data[1].datapoints.length).toBe((end - start) / step + 1);
        });
        it('should fill null until first datapoint in response', function () {
            expect(results.data[0].datapoints[0][1]).toBe(start * 1000);
            expect(results.data[0].datapoints[0][0]).toBe(null);
            expect(results.data[0].datapoints[1][1]).toBe((start + step * 1) * 1000);
            expect(results.data[0].datapoints[1][0]).toBe(3846);
        });
        it('should fill null after last datapoint in response', function () {
            var length = (end - start) / step + 1;
            expect(results.data[0].datapoints[length - 2][1]).toBe((end - step * 1) * 1000);
            expect(results.data[0].datapoints[length - 2][0]).toBe(3848);
            expect(results.data[0].datapoints[length - 1][1]).toBe(end * 1000);
            expect(results.data[0].datapoints[length - 1][0]).toBe(null);
        });
        it('should fill null at gap between series', function () {
            expect(results.data[0].datapoints[2][1]).toBe((start + step * 2) * 1000);
            expect(results.data[0].datapoints[2][0]).toBe(null);
            expect(results.data[1].datapoints[1][1]).toBe((start + step * 1) * 1000);
            expect(results.data[1].datapoints[1][0]).toBe(null);
            expect(results.data[1].datapoints[3][1]).toBe((start + step * 3) * 1000);
            expect(results.data[1].datapoints[3][0]).toBe(null);
        });
    });
    describe('When querying prometheus with one target and instant = true', function () {
        var results;
        var urlExpected = 'proxied/api/v1/query?query=' + encodeURIComponent('test{job="testjob"}') + '&time=123';
        var query = {
            range: { from: time({ seconds: 63 }), to: time({ seconds: 123 }) },
            targets: [{ expr: 'test{job="testjob"}', format: 'time_series', instant: true }],
            interval: '60s',
        };
        beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var response;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
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
                        backendSrv.datasourceRequest = jest.fn(function () { return Promise.resolve(response); });
                        ctx.ds = new PrometheusDatasource(instanceSettings, q, backendSrv, templateSrv, timeSrv);
                        return [4 /*yield*/, ctx.ds.query(query).then(function (data) {
                                results = data;
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should generate the correct query', function () {
            var res = backendSrv.datasourceRequest.mock.calls[0][0];
            expect(res.method).toBe('GET');
            expect(res.url).toBe(urlExpected);
        });
        it('should return series list', function () {
            expect(results.data.length).toBe(1);
            expect(results.data[0].target).toBe('test{job="testjob"}');
        });
    });
    describe('When performing annotationQuery', function () {
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
        describe('not use useValueForTime', function () {
            beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            options.annotation.useValueForTime = false;
                            backendSrv.datasourceRequest = jest.fn(function () { return Promise.resolve(response); });
                            ctx.ds = new PrometheusDatasource(instanceSettings, q, backendSrv, templateSrv, timeSrv);
                            return [4 /*yield*/, ctx.ds.annotationQuery(options).then(function (data) {
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
            beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            options.annotation.useValueForTime = true;
                            backendSrv.datasourceRequest = jest.fn(function () { return Promise.resolve(response); });
                            ctx.ds = new PrometheusDatasource(instanceSettings, q, backendSrv, templateSrv, timeSrv);
                            return [4 /*yield*/, ctx.ds.annotationQuery(options).then(function (data) {
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
                backendSrv.datasourceRequest = jest.fn(function () { return Promise.resolve(response); });
                ctx.ds = new PrometheusDatasource(instanceSettings, q, backendSrv, templateSrv, timeSrv);
            });
            it('should use default step for short range if no interval is given', function () {
                var query = tslib_1.__assign({}, options, { range: {
                        from: time({ seconds: 63 }),
                        to: time({ seconds: 123 }),
                    } });
                ctx.ds.annotationQuery(query);
                var req = backendSrv.datasourceRequest.mock.calls[0][0];
                expect(req.url).toContain('step=60');
            });
            it('should use custom step for short range', function () {
                var annotation = tslib_1.__assign({}, options.annotation, { step: '10s' });
                var query = tslib_1.__assign({}, options, { annotation: annotation, range: {
                        from: time({ seconds: 63 }),
                        to: time({ seconds: 123 }),
                    } });
                ctx.ds.annotationQuery(query);
                var req = backendSrv.datasourceRequest.mock.calls[0][0];
                expect(req.url).toContain('step=10');
            });
            it('should use custom step for short range', function () {
                var annotation = tslib_1.__assign({}, options.annotation, { step: '10s' });
                var query = tslib_1.__assign({}, options, { annotation: annotation, range: {
                        from: time({ seconds: 63 }),
                        to: time({ seconds: 123 }),
                    } });
                ctx.ds.annotationQuery(query);
                var req = backendSrv.datasourceRequest.mock.calls[0][0];
                expect(req.url).toContain('step=10');
            });
            it('should use dynamic step on long ranges if no option was given', function () {
                var query = tslib_1.__assign({}, options, { range: {
                        from: time({ seconds: 63 }),
                        to: time({ hours: 24 * 30, seconds: 63 }),
                    } });
                ctx.ds.annotationQuery(query);
                var req = backendSrv.datasourceRequest.mock.calls[0][0];
                // Range in seconds: (to - from) / 1000
                // Max_datapoints: 11000
                // Step: range / max_datapoints
                var step = 236;
                expect(req.url).toContain("step=" + step);
            });
        });
    });
    describe('When resultFormat is table and instant = true', function () {
        var results;
        var query = {
            range: { from: time({ seconds: 63 }), to: time({ seconds: 123 }) },
            targets: [{ expr: 'test{job="testjob"}', format: 'time_series', instant: true }],
            interval: '60s',
        };
        beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var response;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
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
                        backendSrv.datasourceRequest = jest.fn(function () { return Promise.resolve(response); });
                        ctx.ds = new PrometheusDatasource(instanceSettings, q, backendSrv, templateSrv, timeSrv);
                        return [4 /*yield*/, ctx.ds.query(query).then(function (data) {
                                results = data;
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
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
        it('should be min interval when greater than auto interval', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var query, urlExpected, res;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
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
                        backendSrv.datasourceRequest = jest.fn(function () { return Promise.resolve(response); });
                        ctx.ds = new PrometheusDatasource(instanceSettings, q, backendSrv, templateSrv, timeSrv);
                        return [4 /*yield*/, ctx.ds.query(query)];
                    case 1:
                        _a.sent();
                        res = backendSrv.datasourceRequest.mock.calls[0][0];
                        expect(res.method).toBe('GET');
                        expect(res.url).toBe(urlExpected);
                        return [2 /*return*/];
                }
            });
        }); });
        it('step should never go below 1', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var query, urlExpected, res;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = {
                            // 6 minute range
                            range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
                            targets: [{ expr: 'test' }],
                            interval: '100ms',
                        };
                        urlExpected = 'proxied/api/v1/query_range?query=test&start=60&end=420&step=1';
                        backendSrv.datasourceRequest = jest.fn(function () { return Promise.resolve(response); });
                        ctx.ds = new PrometheusDatasource(instanceSettings, q, backendSrv, templateSrv, timeSrv);
                        return [4 /*yield*/, ctx.ds.query(query)];
                    case 1:
                        _a.sent();
                        res = backendSrv.datasourceRequest.mock.calls[0][0];
                        expect(res.method).toBe('GET');
                        expect(res.url).toBe(urlExpected);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should be auto interval when greater than min interval', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var query, urlExpected, res;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
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
                        backendSrv.datasourceRequest = jest.fn(function () { return Promise.resolve(response); });
                        ctx.ds = new PrometheusDatasource(instanceSettings, q, backendSrv, templateSrv, timeSrv);
                        return [4 /*yield*/, ctx.ds.query(query)];
                    case 1:
                        _a.sent();
                        res = backendSrv.datasourceRequest.mock.calls[0][0];
                        expect(res.method).toBe('GET');
                        expect(res.url).toBe(urlExpected);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should result in querying fewer than 11000 data points', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var query, end, start, urlExpected, res;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = {
                            // 6 hour range
                            range: { from: time({ hours: 1 }), to: time({ hours: 7 }) },
                            targets: [{ expr: 'test' }],
                            interval: '1s',
                        };
                        end = 7 * 60 * 60;
                        start = 60 * 60;
                        urlExpected = 'proxied/api/v1/query_range?query=test&start=' + start + '&end=' + end + '&step=2';
                        backendSrv.datasourceRequest = jest.fn(function () { return Promise.resolve(response); });
                        ctx.ds = new PrometheusDatasource(instanceSettings, q, backendSrv, templateSrv, timeSrv);
                        return [4 /*yield*/, ctx.ds.query(query)];
                    case 1:
                        _a.sent();
                        res = backendSrv.datasourceRequest.mock.calls[0][0];
                        expect(res.method).toBe('GET');
                        expect(res.url).toBe(urlExpected);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should not apply min interval when interval * intervalFactor greater', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var query, urlExpected, res;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
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
                        urlExpected = 'proxied/api/v1/query_range?query=test&start=50&end=450&step=50';
                        backendSrv.datasourceRequest = jest.fn(function () { return Promise.resolve(response); });
                        ctx.ds = new PrometheusDatasource(instanceSettings, q, backendSrv, templateSrv, timeSrv);
                        return [4 /*yield*/, ctx.ds.query(query)];
                    case 1:
                        _a.sent();
                        res = backendSrv.datasourceRequest.mock.calls[0][0];
                        expect(res.method).toBe('GET');
                        expect(res.url).toBe(urlExpected);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should apply min interval when interval * intervalFactor smaller', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var query, urlExpected, res;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
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
                        backendSrv.datasourceRequest = jest.fn(function () { return Promise.resolve(response); });
                        ctx.ds = new PrometheusDatasource(instanceSettings, q, backendSrv, templateSrv, timeSrv);
                        return [4 /*yield*/, ctx.ds.query(query)];
                    case 1:
                        _a.sent();
                        res = backendSrv.datasourceRequest.mock.calls[0][0];
                        expect(res.method).toBe('GET');
                        expect(res.url).toBe(urlExpected);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should apply intervalFactor to auto interval when greater', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var query, urlExpected, res;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
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
                        urlExpected = 'proxied/api/v1/query_range?query=test' + '&start=0&end=500&step=100';
                        backendSrv.datasourceRequest = jest.fn(function () { return Promise.resolve(response); });
                        ctx.ds = new PrometheusDatasource(instanceSettings, q, backendSrv, templateSrv, timeSrv);
                        return [4 /*yield*/, ctx.ds.query(query)];
                    case 1:
                        _a.sent();
                        res = backendSrv.datasourceRequest.mock.calls[0][0];
                        expect(res.method).toBe('GET');
                        expect(res.url).toBe(urlExpected);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should not not be affected by the 11000 data points limit when large enough', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var query, end, start, urlExpected, res;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
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
                        backendSrv.datasourceRequest = jest.fn(function () { return Promise.resolve(response); });
                        ctx.ds = new PrometheusDatasource(instanceSettings, q, backendSrv, templateSrv, timeSrv);
                        return [4 /*yield*/, ctx.ds.query(query)];
                    case 1:
                        _a.sent();
                        res = backendSrv.datasourceRequest.mock.calls[0][0];
                        expect(res.method).toBe('GET');
                        expect(res.url).toBe(urlExpected);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should be determined by the 11000 data points limit when too small', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var query, end, start, urlExpected, res;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
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
                        start = 0;
                        urlExpected = 'proxied/api/v1/query_range?query=test' + '&start=' + start + '&end=' + end + '&step=60';
                        backendSrv.datasourceRequest = jest.fn(function () { return Promise.resolve(response); });
                        ctx.ds = new PrometheusDatasource(instanceSettings, q, backendSrv, templateSrv, timeSrv);
                        return [4 /*yield*/, ctx.ds.query(query)];
                    case 1:
                        _a.sent();
                        res = backendSrv.datasourceRequest.mock.calls[0][0];
                        expect(res.method).toBe('GET');
                        expect(res.url).toBe(urlExpected);
                        return [2 /*return*/];
                }
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
        it('should be unchanged when auto interval is greater than min interval', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var query, urlExpected, res;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
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
                        templateSrv.replace = jest.fn(function (str) { return str; });
                        backendSrv.datasourceRequest = jest.fn(function () { return Promise.resolve(response); });
                        ctx.ds = new PrometheusDatasource(instanceSettings, q, backendSrv, templateSrv, timeSrv);
                        return [4 /*yield*/, ctx.ds.query(query)];
                    case 1:
                        _a.sent();
                        res = backendSrv.datasourceRequest.mock.calls[0][0];
                        expect(res.method).toBe('GET');
                        expect(res.url).toBe(urlExpected);
                        expect(templateSrv.replace.mock.calls[0][1]).toEqual({
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
                }
            });
        }); });
        it('should be min interval when it is greater than auto interval', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var query, urlExpected, res;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
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
                        backendSrv.datasourceRequest = jest.fn(function () { return Promise.resolve(response); });
                        templateSrv.replace = jest.fn(function (str) { return str; });
                        ctx.ds = new PrometheusDatasource(instanceSettings, q, backendSrv, templateSrv, timeSrv);
                        return [4 /*yield*/, ctx.ds.query(query)];
                    case 1:
                        _a.sent();
                        res = backendSrv.datasourceRequest.mock.calls[0][0];
                        expect(res.method).toBe('GET');
                        expect(res.url).toBe(urlExpected);
                        expect(templateSrv.replace.mock.calls[0][1]).toEqual({
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
                }
            });
        }); });
        it('should account for intervalFactor', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var query, urlExpected, res;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
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
                            '&start=0&end=500&step=100';
                        backendSrv.datasourceRequest = jest.fn(function () { return Promise.resolve(response); });
                        templateSrv.replace = jest.fn(function (str) { return str; });
                        ctx.ds = new PrometheusDatasource(instanceSettings, q, backendSrv, templateSrv, timeSrv);
                        return [4 /*yield*/, ctx.ds.query(query)];
                    case 1:
                        _a.sent();
                        res = backendSrv.datasourceRequest.mock.calls[0][0];
                        expect(res.method).toBe('GET');
                        expect(res.url).toBe(urlExpected);
                        expect(templateSrv.replace.mock.calls[0][1]).toEqual({
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
                }
            });
        }); });
        it('should be interval * intervalFactor when greater than min interval', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var query, urlExpected, res;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
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
                            '&start=50&end=450&step=50';
                        templateSrv.replace = jest.fn(function (str) { return str; });
                        backendSrv.datasourceRequest = jest.fn(function () { return Promise.resolve(response); });
                        ctx.ds = new PrometheusDatasource(instanceSettings, q, backendSrv, templateSrv, timeSrv);
                        return [4 /*yield*/, ctx.ds.query(query)];
                    case 1:
                        _a.sent();
                        res = backendSrv.datasourceRequest.mock.calls[0][0];
                        expect(res.method).toBe('GET');
                        expect(res.url).toBe(urlExpected);
                        expect(templateSrv.replace.mock.calls[0][1]).toEqual({
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
                }
            });
        }); });
        it('should be min interval when greater than interval * intervalFactor', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var query, urlExpected, res;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
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
                        backendSrv.datasourceRequest = jest.fn(function () { return Promise.resolve(response); });
                        ctx.ds = new PrometheusDatasource(instanceSettings, q, backendSrv, templateSrv, timeSrv);
                        return [4 /*yield*/, ctx.ds.query(query)];
                    case 1:
                        _a.sent();
                        res = backendSrv.datasourceRequest.mock.calls[0][0];
                        expect(res.method).toBe('GET');
                        expect(res.url).toBe(urlExpected);
                        expect(templateSrv.replace.mock.calls[0][1]).toEqual({
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
                }
            });
        }); });
        it('should be determined by the 11000 data points limit, accounting for intervalFactor', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var query, end, start, urlExpected, res;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
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
                        start = 0;
                        urlExpected = 'proxied/api/v1/query_range?query=' +
                            encodeURIComponent('rate(test[$__interval])') +
                            '&start=' +
                            start +
                            '&end=' +
                            end +
                            '&step=60';
                        backendSrv.datasourceRequest = jest.fn(function () { return Promise.resolve(response); });
                        templateSrv.replace = jest.fn(function (str) { return str; });
                        ctx.ds = new PrometheusDatasource(instanceSettings, q, backendSrv, templateSrv, timeSrv);
                        return [4 /*yield*/, ctx.ds.query(query)];
                    case 1:
                        _a.sent();
                        res = backendSrv.datasourceRequest.mock.calls[0][0];
                        expect(res.method).toBe('GET');
                        expect(res.url).toBe(urlExpected);
                        expect(templateSrv.replace.mock.calls[0][1]).toEqual({
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
                }
            });
        }); });
    });
});
describe('PrometheusDatasource for POST', function () {
    //   const ctx = new helpers.ServiceTestContext();
    var instanceSettings = {
        url: 'proxied',
        directUrl: 'direct',
        user: 'test',
        password: 'mupp',
        jsonData: { httpMethod: 'POST' },
    };
    describe('When querying prometheus with one target using query editor target spec', function () {
        var results;
        var urlExpected = 'proxied/api/v1/query_range';
        var dataExpected = {
            query: 'test{job="testjob"}',
            start: 1 * 60,
            end: 3 * 60,
            step: 60,
        };
        var query = {
            range: { from: time({ minutes: 1, seconds: 3 }), to: time({ minutes: 2, seconds: 3 }) },
            targets: [{ expr: 'test{job="testjob"}', format: 'time_series' }],
            interval: '60s',
        };
        beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var response;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
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
                        backendSrv.datasourceRequest = jest.fn(function () { return Promise.resolve(response); });
                        ctx.ds = new PrometheusDatasource(instanceSettings, q, backendSrv, templateSrv, timeSrv);
                        return [4 /*yield*/, ctx.ds.query(query).then(function (data) {
                                results = data;
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should generate the correct query', function () {
            var res = backendSrv.datasourceRequest.mock.calls[0][0];
            expect(res.method).toBe('POST');
            expect(res.url).toBe(urlExpected);
            expect(res.data).toEqual(dataExpected);
        });
        it('should return series list', function () {
            expect(results.data.length).toBe(1);
            expect(results.data[0].target).toBe('test{job="testjob"}');
        });
    });
});
//# sourceMappingURL=datasource.test.js.map