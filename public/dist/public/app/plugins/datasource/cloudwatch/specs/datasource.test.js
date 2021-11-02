import { __assign, __awaiter, __generator } from "tslib";
import { interval, lastValueFrom, of, throwError } from 'rxjs';
import { DataQueryErrorType, dateMath, getFrameDisplayName, } from '@grafana/data';
import * as redux from 'app/store/store';
import { CloudWatchDatasource, MAX_ATTEMPTS } from '../datasource';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { CloudWatchLogsQueryStatus, } from '../types';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { convertToStoreState } from '../../../../../test/helpers/convertToStoreState';
import { getTemplateSrvDependencies } from 'test/helpers/getTemplateSrvDependencies';
import { initialVariableModelState, VariableHide } from '../../../../features/variables/types';
import * as rxjsUtils from '../utils/rxjs/increasingInterval';
import { createFetchResponse } from 'test/helpers/createFetchResponse';
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: function () { return backendSrv; } })); });
function getTestContext(_a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.response, response = _c === void 0 ? {} : _c, _d = _b.throws, throws = _d === void 0 ? false : _d, _e = _b.templateSrv, templateSrv = _e === void 0 ? new TemplateSrv() : _e;
    jest.clearAllMocks();
    var fetchMock = jest.spyOn(backendSrv, 'fetch');
    throws
        ? fetchMock.mockImplementation(function () { return throwError(response); })
        : fetchMock.mockImplementation(function () { return of(createFetchResponse(response)); });
    var instanceSettings = {
        jsonData: { defaultRegion: 'us-east-1' },
        name: 'TestDatasource',
    };
    var timeSrv = {
        time: { from: '2016-12-31 15:00:00Z', to: '2016-12-31 16:00:00Z' },
        timeRange: function () {
            return {
                from: dateMath.parse(timeSrv.time.from, false),
                to: dateMath.parse(timeSrv.time.to, true),
            };
        },
    };
    var ds = new CloudWatchDatasource(instanceSettings, templateSrv, timeSrv);
    return { ds: ds, fetchMock: fetchMock, instanceSettings: instanceSettings };
}
describe('CloudWatchDatasource', function () {
    var start = 1483196400 * 1000;
    var defaultTimeRange = { from: new Date(start), to: new Date(start + 3600 * 1000) };
    beforeEach(function () {
        jest.clearAllMocks();
    });
    describe('When getting log groups', function () {
        it('should return log groups as an array of strings', function () { return __awaiter(void 0, void 0, void 0, function () {
            var response, ds, expectedLogGroups, logGroups;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        response = {
                            results: {
                                A: {
                                    frames: [
                                        {
                                            schema: {
                                                name: 'logGroups',
                                                refId: 'A',
                                                fields: [{ name: 'logGroupName', type: 'string', typeInfo: { frame: 'string', nullable: true } }],
                                            },
                                            data: {
                                                values: [
                                                    [
                                                        '/aws/containerinsights/dev303-workshop/application',
                                                        '/aws/containerinsights/dev303-workshop/dataplane',
                                                        '/aws/containerinsights/dev303-workshop/flowlogs',
                                                        '/aws/containerinsights/dev303-workshop/host',
                                                        '/aws/containerinsights/dev303-workshop/performance',
                                                        '/aws/containerinsights/dev303-workshop/prometheus',
                                                        '/aws/containerinsights/ecommerce-sockshop/application',
                                                        '/aws/containerinsights/ecommerce-sockshop/dataplane',
                                                        '/aws/containerinsights/ecommerce-sockshop/host',
                                                        '/aws/containerinsights/ecommerce-sockshop/performance',
                                                        '/aws/containerinsights/watchdemo-perf/application',
                                                        '/aws/containerinsights/watchdemo-perf/dataplane',
                                                        '/aws/containerinsights/watchdemo-perf/host',
                                                        '/aws/containerinsights/watchdemo-perf/performance',
                                                        '/aws/containerinsights/watchdemo-perf/prometheus',
                                                        '/aws/containerinsights/watchdemo-prod-us-east-1/performance',
                                                        '/aws/containerinsights/watchdemo-staging/application',
                                                        '/aws/containerinsights/watchdemo-staging/dataplane',
                                                        '/aws/containerinsights/watchdemo-staging/host',
                                                        '/aws/containerinsights/watchdemo-staging/performance',
                                                        '/aws/ecs/containerinsights/bugbash-ec2/performance',
                                                        '/aws/ecs/containerinsights/ecs-demoworkshop/performance',
                                                        '/aws/ecs/containerinsights/ecs-workshop-dev/performance',
                                                        '/aws/eks/dev303-workshop/cluster',
                                                        '/aws/events/cloudtrail',
                                                        '/aws/events/ecs',
                                                        '/aws/lambda/cwsyn-mycanary-fac97ded-f134-499a-9d71-4c3be1f63182',
                                                        '/aws/lambda/cwsyn-watch-linkchecks-ef7ef273-5da2-4663-af54-d2f52d55b060',
                                                        '/ecs/ecs-cwagent-daemon-service',
                                                        '/ecs/ecs-demo-limitTask',
                                                        'CloudTrail/DefaultLogGroup',
                                                        'container-insights-prometheus-beta',
                                                        'container-insights-prometheus-demo',
                                                    ],
                                                ],
                                            },
                                        },
                                    ],
                                },
                            },
                        };
                        ds = getTestContext({ response: response }).ds;
                        expectedLogGroups = [
                            '/aws/containerinsights/dev303-workshop/application',
                            '/aws/containerinsights/dev303-workshop/dataplane',
                            '/aws/containerinsights/dev303-workshop/flowlogs',
                            '/aws/containerinsights/dev303-workshop/host',
                            '/aws/containerinsights/dev303-workshop/performance',
                            '/aws/containerinsights/dev303-workshop/prometheus',
                            '/aws/containerinsights/ecommerce-sockshop/application',
                            '/aws/containerinsights/ecommerce-sockshop/dataplane',
                            '/aws/containerinsights/ecommerce-sockshop/host',
                            '/aws/containerinsights/ecommerce-sockshop/performance',
                            '/aws/containerinsights/watchdemo-perf/application',
                            '/aws/containerinsights/watchdemo-perf/dataplane',
                            '/aws/containerinsights/watchdemo-perf/host',
                            '/aws/containerinsights/watchdemo-perf/performance',
                            '/aws/containerinsights/watchdemo-perf/prometheus',
                            '/aws/containerinsights/watchdemo-prod-us-east-1/performance',
                            '/aws/containerinsights/watchdemo-staging/application',
                            '/aws/containerinsights/watchdemo-staging/dataplane',
                            '/aws/containerinsights/watchdemo-staging/host',
                            '/aws/containerinsights/watchdemo-staging/performance',
                            '/aws/ecs/containerinsights/bugbash-ec2/performance',
                            '/aws/ecs/containerinsights/ecs-demoworkshop/performance',
                            '/aws/ecs/containerinsights/ecs-workshop-dev/performance',
                            '/aws/eks/dev303-workshop/cluster',
                            '/aws/events/cloudtrail',
                            '/aws/events/ecs',
                            '/aws/lambda/cwsyn-mycanary-fac97ded-f134-499a-9d71-4c3be1f63182',
                            '/aws/lambda/cwsyn-watch-linkchecks-ef7ef273-5da2-4663-af54-d2f52d55b060',
                            '/ecs/ecs-cwagent-daemon-service',
                            '/ecs/ecs-demo-limitTask',
                            'CloudTrail/DefaultLogGroup',
                            'container-insights-prometheus-beta',
                            'container-insights-prometheus-demo',
                        ];
                        return [4 /*yield*/, ds.describeLogGroups({})];
                    case 1:
                        logGroups = _a.sent();
                        expect(logGroups).toEqual(expectedLogGroups);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When performing CloudWatch logs query', function () {
        beforeEach(function () {
            jest.spyOn(rxjsUtils, 'increasingInterval').mockImplementation(function () { return interval(100); });
        });
        it('should stop querying when no more data received a number of times in a row', function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds, fakeFrames, initialRecordsMatched, i_1, finalRecordsMatched, i_2, i, myResponse, expectedData;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = getTestContext().ds;
                        fakeFrames = genMockFrames(20);
                        initialRecordsMatched = fakeFrames[0].meta.stats.find(function (stat) { return stat.displayName === 'Records scanned'; })
                            .value;
                        for (i_1 = 1; i_1 < 4; i_1++) {
                            fakeFrames[i_1].meta.stats = [
                                {
                                    displayName: 'Records scanned',
                                    value: initialRecordsMatched,
                                },
                            ];
                        }
                        finalRecordsMatched = fakeFrames[9].meta.stats.find(function (stat) { return stat.displayName === 'Records scanned'; })
                            .value;
                        for (i_2 = 10; i_2 < fakeFrames.length; i_2++) {
                            fakeFrames[i_2].meta.stats = [
                                {
                                    displayName: 'Records scanned',
                                    value: finalRecordsMatched,
                                },
                            ];
                        }
                        i = 0;
                        jest.spyOn(ds, 'makeLogActionRequest').mockImplementation(function (subtype) {
                            if (subtype === 'GetQueryResults') {
                                var mockObservable = of([fakeFrames[i]]);
                                i++;
                                return mockObservable;
                            }
                            else {
                                return of([]);
                            }
                        });
                        return [4 /*yield*/, lastValueFrom(ds.logsQuery([{ queryId: 'fake-query-id', region: 'default', refId: 'A' }]))];
                    case 1:
                        myResponse = _a.sent();
                        expectedData = [
                            __assign(__assign({}, fakeFrames[14]), { meta: {
                                    custom: {
                                        Status: 'Cancelled',
                                    },
                                    stats: fakeFrames[14].meta.stats,
                                } }),
                        ];
                        expect(myResponse).toEqual({
                            data: expectedData,
                            key: 'test-key',
                            state: 'Done',
                            error: {
                                type: DataQueryErrorType.Timeout,
                                message: "error: query timed out after " + MAX_ATTEMPTS + " attempts",
                            },
                        });
                        expect(i).toBe(15);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should continue querying as long as new data is being received', function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds, fakeFrames, i, myResponse;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = getTestContext().ds;
                        fakeFrames = genMockFrames(15);
                        i = 0;
                        jest.spyOn(ds, 'makeLogActionRequest').mockImplementation(function (subtype) {
                            if (subtype === 'GetQueryResults') {
                                var mockObservable = of([fakeFrames[i]]);
                                i++;
                                return mockObservable;
                            }
                            else {
                                return of([]);
                            }
                        });
                        return [4 /*yield*/, lastValueFrom(ds.logsQuery([{ queryId: 'fake-query-id', region: 'default', refId: 'A' }]))];
                    case 1:
                        myResponse = _a.sent();
                        expect(myResponse).toEqual({
                            data: [fakeFrames[fakeFrames.length - 1]],
                            key: 'test-key',
                            state: 'Done',
                        });
                        expect(i).toBe(15);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should stop querying when results come back with status "Complete"', function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds, fakeFrames, i, myResponse;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = getTestContext().ds;
                        fakeFrames = genMockFrames(3);
                        i = 0;
                        jest.spyOn(ds, 'makeLogActionRequest').mockImplementation(function (subtype) {
                            if (subtype === 'GetQueryResults') {
                                var mockObservable = of([fakeFrames[i]]);
                                i++;
                                return mockObservable;
                            }
                            else {
                                return of([]);
                            }
                        });
                        return [4 /*yield*/, lastValueFrom(ds.logsQuery([{ queryId: 'fake-query-id', region: 'default', refId: 'A' }]))];
                    case 1:
                        myResponse = _a.sent();
                        expect(myResponse).toEqual({
                            data: [fakeFrames[2]],
                            key: 'test-key',
                            state: 'Done',
                        });
                        expect(i).toBe(3);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When performing CloudWatch metrics query', function () {
        var query = {
            range: defaultTimeRange,
            rangeRaw: { from: 1483228800, to: 1483232400 },
            targets: [
                {
                    type: 'Metrics',
                    expression: '',
                    refId: 'A',
                    region: 'us-east-1',
                    namespace: 'AWS/EC2',
                    metricName: 'CPUUtilization',
                    dimensions: {
                        InstanceId: 'i-12345678',
                    },
                    statistic: 'Average',
                    period: '300',
                },
            ],
        };
        var response = {
            timings: [null],
            results: {
                A: {
                    type: 'Metrics',
                    error: '',
                    refId: 'A',
                    meta: {},
                    series: [
                        {
                            name: 'CPUUtilization_Average',
                            points: [
                                [1, 1483228800000],
                                [2, 1483229100000],
                                [5, 1483229700000],
                            ],
                            tags: {
                                InstanceId: 'i-12345678',
                            },
                        },
                    ],
                },
            },
        };
        it('should generate the correct query', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, ds, fetchMock;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = getTestContext({ response: response }), ds = _a.ds, fetchMock = _a.fetchMock;
                        return [4 /*yield*/, expect(ds.query(query)).toEmitValuesWith(function () {
                                expect(fetchMock.mock.calls[0][0].data.queries).toMatchObject(expect.arrayContaining([
                                    expect.objectContaining({
                                        namespace: query.targets[0].namespace,
                                        metricName: query.targets[0].metricName,
                                        dimensions: { InstanceId: ['i-12345678'] },
                                        statistic: query.targets[0].statistic,
                                        period: query.targets[0].period,
                                    }),
                                ]));
                            })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should generate the correct query with interval variable', function () { return __awaiter(void 0, void 0, void 0, function () {
            var period, templateSrv, query, _a, ds, fetchMock;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        period = __assign(__assign({}, initialVariableModelState), { id: 'period', name: 'period', index: 0, current: { value: '10m', text: '10m', selected: true }, options: [{ value: '10m', text: '10m', selected: true }], multi: false, includeAll: false, query: '', hide: VariableHide.dontHide, type: 'custom' });
                        templateSrv = new TemplateSrv();
                        templateSrv.init([period]);
                        query = {
                            range: defaultTimeRange,
                            rangeRaw: { from: 1483228800, to: 1483232400 },
                            targets: [
                                {
                                    type: 'Metrics',
                                    refId: 'A',
                                    region: 'us-east-1',
                                    namespace: 'AWS/EC2',
                                    metricName: 'CPUUtilization',
                                    dimensions: {
                                        InstanceId: 'i-12345678',
                                    },
                                    statistic: 'Average',
                                    period: '[[period]]',
                                },
                            ],
                        };
                        _a = getTestContext({ response: response, templateSrv: templateSrv }), ds = _a.ds, fetchMock = _a.fetchMock;
                        return [4 /*yield*/, expect(ds.query(query)).toEmitValuesWith(function () {
                                expect(fetchMock.mock.calls[0][0].data.queries[0].period).toEqual('600');
                            })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should return series list', function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = getTestContext({ response: response }).ds;
                        return [4 /*yield*/, expect(ds.query(query)).toEmitValuesWith(function (received) {
                                var result = received[0];
                                expect(getFrameDisplayName(result.data[0])).toBe(response.results.A.series[0].name);
                                expect(result.data[0].fields[1].values.buffer[0]).toBe(response.results.A.series[0].points[0][0]);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        describe('and throttling exception is thrown', function () {
            var partialQuery = {
                type: 'Metrics',
                namespace: 'AWS/EC2',
                metricName: 'CPUUtilization',
                dimensions: {
                    InstanceId: 'i-12345678',
                },
                statistic: 'Average',
                period: '300',
                expression: '',
            };
            var query = {
                range: defaultTimeRange,
                rangeRaw: { from: 1483228800, to: 1483232400 },
                targets: [
                    __assign(__assign({}, partialQuery), { refId: 'A', region: 'us-east-1' }),
                    __assign(__assign({}, partialQuery), { refId: 'B', region: 'us-east-2' }),
                    __assign(__assign({}, partialQuery), { refId: 'C', region: 'us-east-1' }),
                    __assign(__assign({}, partialQuery), { refId: 'D', region: 'us-east-2' }),
                    __assign(__assign({}, partialQuery), { refId: 'E', region: 'eu-north-1' }),
                ],
            };
            var backendErrorResponse = {
                data: {
                    message: 'Throttling: exception',
                    results: {
                        A: {
                            error: 'Throttling: exception',
                            refId: 'A',
                            meta: {},
                        },
                        B: {
                            error: 'Throttling: exception',
                            refId: 'B',
                            meta: {},
                        },
                        C: {
                            error: 'Throttling: exception',
                            refId: 'C',
                            meta: {},
                        },
                        D: {
                            error: 'Throttling: exception',
                            refId: 'D',
                            meta: {},
                        },
                        E: {
                            error: 'Throttling: exception',
                            refId: 'E',
                            meta: {},
                        },
                    },
                },
            };
            beforeEach(function () {
                redux.setStore({
                    dispatch: jest.fn(),
                });
            });
            it('should display one alert error message per region+datasource combination', function () { return __awaiter(void 0, void 0, void 0, function () {
                var ds, memoizedDebounceSpy;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ds = getTestContext({ response: backendErrorResponse, throws: true }).ds;
                            memoizedDebounceSpy = jest.spyOn(ds, 'debouncedAlert');
                            return [4 /*yield*/, expect(ds.query(query)).toEmitValuesWith(function (received) {
                                    expect(memoizedDebounceSpy).toHaveBeenCalledWith('TestDatasource', 'us-east-1');
                                    expect(memoizedDebounceSpy).toHaveBeenCalledWith('TestDatasource', 'us-east-2');
                                    expect(memoizedDebounceSpy).toHaveBeenCalledWith('TestDatasource', 'eu-north-1');
                                    expect(memoizedDebounceSpy).toBeCalledTimes(3);
                                })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('when regions query is used', function () {
            describe('and region param is left out', function () {
                it('should use the default region', function () { return __awaiter(void 0, void 0, void 0, function () {
                    var _a, ds, instanceSettings;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                _a = getTestContext(), ds = _a.ds, instanceSettings = _a.instanceSettings;
                                ds.doMetricQueryRequest = jest.fn().mockResolvedValue([]);
                                return [4 /*yield*/, ds.metricFindQuery('metrics(testNamespace)')];
                            case 1:
                                _b.sent();
                                expect(ds.doMetricQueryRequest).toHaveBeenCalledWith('metrics', {
                                    namespace: 'testNamespace',
                                    region: instanceSettings.jsonData.defaultRegion,
                                });
                                return [2 /*return*/];
                        }
                    });
                }); });
            });
            describe('and region param is defined by user', function () {
                it('should use the user defined region', function () { return __awaiter(void 0, void 0, void 0, function () {
                    var ds;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                ds = getTestContext().ds;
                                ds.doMetricQueryRequest = jest.fn().mockResolvedValue([]);
                                return [4 /*yield*/, ds.metricFindQuery('metrics(testNamespace2, custom-region)')];
                            case 1:
                                _a.sent();
                                expect(ds.doMetricQueryRequest).toHaveBeenCalledWith('metrics', {
                                    namespace: 'testNamespace2',
                                    region: 'custom-region',
                                });
                                return [2 /*return*/];
                        }
                    });
                }); });
            });
        });
    });
    describe('When query region is "default"', function () {
        it('should return the datasource region if empty or "default"', function () {
            var _a = getTestContext(), ds = _a.ds, instanceSettings = _a.instanceSettings;
            var defaultRegion = instanceSettings.jsonData.defaultRegion;
            expect(ds.getActualRegion()).toBe(defaultRegion);
            expect(ds.getActualRegion('')).toBe(defaultRegion);
            expect(ds.getActualRegion('default')).toBe(defaultRegion);
        });
        it('should return the specified region if specified', function () {
            var ds = getTestContext().ds;
            expect(ds.getActualRegion('some-fake-region-1')).toBe('some-fake-region-1');
        });
        it('should query for the datasource region if empty or "default"', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, ds, instanceSettings, performTimeSeriesQueryMock, query;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = getTestContext(), ds = _a.ds, instanceSettings = _a.instanceSettings;
                        performTimeSeriesQueryMock = jest.spyOn(ds, 'performTimeSeriesQuery').mockReturnValue(of({}));
                        query = {
                            range: defaultTimeRange,
                            rangeRaw: { from: 1483228800, to: 1483232400 },
                            targets: [
                                {
                                    type: 'Metrics',
                                    refId: 'A',
                                    region: 'default',
                                    namespace: 'AWS/EC2',
                                    metricName: 'CPUUtilization',
                                    dimensions: {
                                        InstanceId: 'i-12345678',
                                    },
                                    statistic: 'Average',
                                    period: '300s',
                                },
                            ],
                        };
                        return [4 /*yield*/, expect(ds.query(query)).toEmitValuesWith(function () {
                                expect(performTimeSeriesQueryMock.mock.calls[0][0].queries[0].region).toBe(instanceSettings.jsonData.defaultRegion);
                            })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When interpolating variables', function () {
        it('should return an empty array if no queries are provided', function () {
            var templateSrv = { replace: jest.fn() };
            var ds = getTestContext({ templateSrv: templateSrv }).ds;
            expect(ds.interpolateVariablesInQueries([], {})).toHaveLength(0);
        });
        it('should replace correct variables in CloudWatchLogsQuery', function () {
            var templateSrv = { replace: jest.fn() };
            var ds = getTestContext({ templateSrv: templateSrv }).ds;
            var variableName = 'someVar';
            var logQuery = {
                id: 'someId',
                refId: 'someRefId',
                queryMode: 'Logs',
                expression: "$" + variableName,
                region: "$" + variableName,
            };
            ds.interpolateVariablesInQueries([logQuery], {});
            // We interpolate `expression` and `region` in CloudWatchLogsQuery
            expect(templateSrv.replace).toHaveBeenCalledWith("$" + variableName, {});
            expect(templateSrv.replace).toHaveBeenCalledTimes(2);
        });
        it('should replace correct variables in CloudWatchMetricsQuery', function () {
            var _a;
            var templateSrv = { replace: jest.fn() };
            var ds = getTestContext({ templateSrv: templateSrv }).ds;
            var variableName = 'someVar';
            var logQuery = {
                id: 'someId',
                refId: 'someRefId',
                queryMode: 'Metrics',
                expression: "$" + variableName,
                region: "$" + variableName,
                period: "$" + variableName,
                alias: "$" + variableName,
                metricName: "$" + variableName,
                namespace: "$" + variableName,
                dimensions: (_a = {},
                    _a["$" + variableName] = "$" + variableName,
                    _a),
                matchExact: false,
                statistic: '',
            };
            ds.interpolateVariablesInQueries([logQuery], {});
            // We interpolate `expression`, `region`, `period`, `alias`, `metricName`, `nameSpace` and `dimensions` in CloudWatchMetricsQuery
            expect(templateSrv.replace).toHaveBeenCalledWith("$" + variableName, {});
            expect(templateSrv.replace).toHaveBeenCalledTimes(8);
        });
    });
    describe('When performing CloudWatch query for extended statistic', function () {
        var query = {
            range: defaultTimeRange,
            rangeRaw: { from: 1483228800, to: 1483232400 },
            targets: [
                {
                    type: 'Metrics',
                    refId: 'A',
                    region: 'us-east-1',
                    namespace: 'AWS/ApplicationELB',
                    metricName: 'TargetResponseTime',
                    dimensions: {
                        LoadBalancer: 'lb',
                        TargetGroup: 'tg',
                    },
                    statistic: 'p90.00',
                    period: '300s',
                },
            ],
        };
        var response = {
            timings: [null],
            results: {
                A: {
                    error: '',
                    refId: 'A',
                    meta: {},
                    series: [
                        {
                            name: 'TargetResponseTime_p90.00',
                            points: [
                                [1, 1483228800000],
                                [2, 1483229100000],
                                [5, 1483229700000],
                            ],
                            tags: {
                                LoadBalancer: 'lb',
                                TargetGroup: 'tg',
                            },
                        },
                    ],
                },
            },
        };
        it('should return series list', function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = getTestContext({ response: response }).ds;
                        return [4 /*yield*/, expect(ds.query(query)).toEmitValuesWith(function (received) {
                                var result = received[0];
                                expect(getFrameDisplayName(result.data[0])).toBe(response.results.A.series[0].name);
                                expect(result.data[0].fields[1].values.buffer[0]).toBe(response.results.A.series[0].points[0][0]);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When performing CloudWatch query with template variables', function () {
        var templateSrv;
        beforeEach(function () {
            var var1 = __assign(__assign({}, initialVariableModelState), { id: 'var1', name: 'var1', index: 0, current: { value: 'var1-foo', text: 'var1-foo', selected: true }, options: [{ value: 'var1-foo', text: 'var1-foo', selected: true }], multi: false, includeAll: false, query: '', hide: VariableHide.dontHide, type: 'custom' });
            var var2 = __assign(__assign({}, initialVariableModelState), { id: 'var2', name: 'var2', index: 1, current: { value: 'var2-foo', text: 'var2-foo', selected: true }, options: [{ value: 'var2-foo', text: 'var2-foo', selected: true }], multi: false, includeAll: false, query: '', hide: VariableHide.dontHide, type: 'custom' });
            var var3 = __assign(__assign({}, initialVariableModelState), { id: 'var3', name: 'var3', index: 2, current: { value: ['var3-foo', 'var3-baz'], text: 'var3-foo + var3-baz', selected: true }, options: [
                    { selected: true, value: 'var3-foo', text: 'var3-foo' },
                    { selected: false, value: 'var3-bar', text: 'var3-bar' },
                    { selected: true, value: 'var3-baz', text: 'var3-baz' },
                ], multi: true, includeAll: false, query: '', hide: VariableHide.dontHide, type: 'custom' });
            var var4 = __assign(__assign({}, initialVariableModelState), { id: 'var4', name: 'var4', index: 3, options: [
                    { selected: true, value: 'var4-foo', text: 'var4-foo' },
                    { selected: false, value: 'var4-bar', text: 'var4-bar' },
                    { selected: true, value: 'var4-baz', text: 'var4-baz' },
                ], current: { value: ['var4-foo', 'var4-baz'], text: 'var4-foo + var4-baz', selected: true }, multi: true, includeAll: false, query: '', hide: VariableHide.dontHide, type: 'custom' });
            var variables = [var1, var2, var3, var4];
            var state = convertToStoreState(variables);
            templateSrv = new TemplateSrv(getTemplateSrvDependencies(state));
            templateSrv.init(variables);
        });
        it('should generate the correct query for single template variable', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, ds, fetchMock, query;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = getTestContext({ templateSrv: templateSrv }), ds = _a.ds, fetchMock = _a.fetchMock;
                        query = {
                            range: defaultTimeRange,
                            rangeRaw: { from: 1483228800, to: 1483232400 },
                            targets: [
                                {
                                    type: 'Metrics',
                                    refId: 'A',
                                    region: 'us-east-1',
                                    namespace: 'TestNamespace',
                                    metricName: 'TestMetricName',
                                    dimensions: {
                                        dim2: '[[var2]]',
                                    },
                                    statistic: 'Average',
                                    period: '300s',
                                },
                            ],
                        };
                        return [4 /*yield*/, expect(ds.query(query)).toEmitValuesWith(function () {
                                expect(fetchMock.mock.calls[0][0].data.queries[0].dimensions['dim2']).toStrictEqual(['var2-foo']);
                            })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should generate the correct query in the case of one multilple template variables', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, ds, fetchMock, query;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = getTestContext({ templateSrv: templateSrv }), ds = _a.ds, fetchMock = _a.fetchMock;
                        query = {
                            range: defaultTimeRange,
                            rangeRaw: { from: 1483228800, to: 1483232400 },
                            targets: [
                                {
                                    type: 'Metrics',
                                    refId: 'A',
                                    region: 'us-east-1',
                                    namespace: 'TestNamespace',
                                    metricName: 'TestMetricName',
                                    dimensions: {
                                        dim1: '[[var1]]',
                                        dim2: '[[var2]]',
                                        dim3: '[[var3]]',
                                    },
                                    statistic: 'Average',
                                    period: '300s',
                                },
                            ],
                            scopedVars: {
                                var1: { selected: true, value: 'var1-foo' },
                                var2: { selected: true, value: 'var2-foo' },
                            },
                        };
                        return [4 /*yield*/, expect(ds.query(query)).toEmitValuesWith(function () {
                                expect(fetchMock.mock.calls[0][0].data.queries[0].dimensions['dim1']).toStrictEqual(['var1-foo']);
                                expect(fetchMock.mock.calls[0][0].data.queries[0].dimensions['dim2']).toStrictEqual(['var2-foo']);
                                expect(fetchMock.mock.calls[0][0].data.queries[0].dimensions['dim3']).toStrictEqual(['var3-foo', 'var3-baz']);
                            })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should generate the correct query in the case of multilple multi template variables', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, ds, fetchMock, query;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = getTestContext({ templateSrv: templateSrv }), ds = _a.ds, fetchMock = _a.fetchMock;
                        query = {
                            range: defaultTimeRange,
                            rangeRaw: { from: 1483228800, to: 1483232400 },
                            targets: [
                                {
                                    type: 'Metrics',
                                    refId: 'A',
                                    region: 'us-east-1',
                                    namespace: 'TestNamespace',
                                    metricName: 'TestMetricName',
                                    dimensions: {
                                        dim1: '[[var1]]',
                                        dim3: '[[var3]]',
                                        dim4: '[[var4]]',
                                    },
                                    statistic: 'Average',
                                    period: '300s',
                                },
                            ],
                        };
                        return [4 /*yield*/, expect(ds.query(query)).toEmitValuesWith(function () {
                                expect(fetchMock.mock.calls[0][0].data.queries[0].dimensions['dim1']).toStrictEqual(['var1-foo']);
                                expect(fetchMock.mock.calls[0][0].data.queries[0].dimensions['dim3']).toStrictEqual(['var3-foo', 'var3-baz']);
                                expect(fetchMock.mock.calls[0][0].data.queries[0].dimensions['dim4']).toStrictEqual(['var4-foo', 'var4-baz']);
                            })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should generate the correct query for multilple template variables, lack scopedVars', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, ds, fetchMock, query;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = getTestContext({ templateSrv: templateSrv }), ds = _a.ds, fetchMock = _a.fetchMock;
                        query = {
                            range: defaultTimeRange,
                            rangeRaw: { from: 1483228800, to: 1483232400 },
                            targets: [
                                {
                                    type: 'Metrics',
                                    refId: 'A',
                                    region: 'us-east-1',
                                    namespace: 'TestNamespace',
                                    metricName: 'TestMetricName',
                                    dimensions: {
                                        dim1: '[[var1]]',
                                        dim2: '[[var2]]',
                                        dim3: '[[var3]]',
                                    },
                                    statistic: 'Average',
                                    period: '300',
                                },
                            ],
                            scopedVars: {
                                var1: { selected: true, value: 'var1-foo' },
                            },
                        };
                        return [4 /*yield*/, expect(ds.query(query)).toEmitValuesWith(function () {
                                expect(fetchMock.mock.calls[0][0].data.queries[0].dimensions['dim1']).toStrictEqual(['var1-foo']);
                                expect(fetchMock.mock.calls[0][0].data.queries[0].dimensions['dim2']).toStrictEqual(['var2-foo']);
                                expect(fetchMock.mock.calls[0][0].data.queries[0].dimensions['dim3']).toStrictEqual(['var3-foo', 'var3-baz']);
                            })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    function describeMetricFindQuery(query, func) {
        var _this = this;
        describe('metricFindQuery ' + query, function () {
            var scenario = {};
            scenario.setup = function (setupCallback) { return __awaiter(_this, void 0, void 0, function () {
                var _this = this;
                return __generator(this, function (_a) {
                    beforeEach(function () { return __awaiter(_this, void 0, void 0, function () {
                        var ds;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, setupCallback()];
                                case 1:
                                    _a.sent();
                                    ds = getTestContext({ response: scenario.requestResponse }).ds;
                                    ds.metricFindQuery(query).then(function (args) {
                                        scenario.result = args;
                                    });
                                    return [2 /*return*/];
                            }
                        });
                    }); });
                    return [2 /*return*/];
                });
            }); };
            func(scenario);
        });
    }
    describeMetricFindQuery('regions()', function (scenario) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, scenario.setup(function () {
                        scenario.requestResponse = {
                            results: {
                                metricFindQuery: {
                                    tables: [{ rows: [['us-east-1', 'us-east-1']] }],
                                },
                            },
                        };
                    })];
                case 1:
                    _a.sent();
                    it('should call __GetRegions and return result', function () {
                        expect(scenario.result[0].text).toContain('us-east-1');
                        expect(scenario.request.queries[0].type).toBe('metricFindQuery');
                        expect(scenario.request.queries[0].subtype).toBe('regions');
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    describeMetricFindQuery('namespaces()', function (scenario) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, scenario.setup(function () {
                        scenario.requestResponse = {
                            results: {
                                metricFindQuery: {
                                    tables: [{ rows: [['AWS/EC2', 'AWS/EC2']] }],
                                },
                            },
                        };
                    })];
                case 1:
                    _a.sent();
                    it('should call __GetNamespaces and return result', function () {
                        expect(scenario.result[0].text).toContain('AWS/EC2');
                        expect(scenario.request.queries[0].type).toBe('metricFindQuery');
                        expect(scenario.request.queries[0].subtype).toBe('namespaces');
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    describeMetricFindQuery('metrics(AWS/EC2, us-east-2)', function (scenario) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, scenario.setup(function () {
                        scenario.requestResponse = {
                            results: {
                                metricFindQuery: {
                                    tables: [{ rows: [['CPUUtilization', 'CPUUtilization']] }],
                                },
                            },
                        };
                    })];
                case 1:
                    _a.sent();
                    it('should call __GetMetrics and return result', function () {
                        expect(scenario.result[0].text).toBe('CPUUtilization');
                        expect(scenario.request.queries[0].type).toBe('metricFindQuery');
                        expect(scenario.request.queries[0].subtype).toBe('metrics');
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    describeMetricFindQuery('dimension_keys(AWS/EC2)', function (scenario) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, scenario.setup(function () {
                        scenario.requestResponse = {
                            results: {
                                metricFindQuery: {
                                    tables: [{ rows: [['InstanceId', 'InstanceId']] }],
                                },
                            },
                        };
                    })];
                case 1:
                    _a.sent();
                    it('should call __GetDimensions and return result', function () {
                        expect(scenario.result[0].text).toBe('InstanceId');
                        expect(scenario.request.queries[0].type).toBe('metricFindQuery');
                        expect(scenario.request.queries[0].subtype).toBe('dimension_keys');
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    describeMetricFindQuery('dimension_values(us-east-1,AWS/EC2,CPUUtilization,InstanceId)', function (scenario) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, scenario.setup(function () {
                        scenario.requestResponse = {
                            results: {
                                metricFindQuery: {
                                    tables: [{ rows: [['i-12345678', 'i-12345678']] }],
                                },
                            },
                        };
                    })];
                case 1:
                    _a.sent();
                    it('should call __ListMetrics and return result', function () {
                        expect(scenario.result[0].text).toContain('i-12345678');
                        expect(scenario.request.queries[0].type).toBe('metricFindQuery');
                        expect(scenario.request.queries[0].subtype).toBe('dimension_values');
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    describeMetricFindQuery('dimension_values(default,AWS/EC2,CPUUtilization,InstanceId)', function (scenario) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, scenario.setup(function () {
                        scenario.requestResponse = {
                            results: {
                                metricFindQuery: {
                                    tables: [{ rows: [['i-12345678', 'i-12345678']] }],
                                },
                            },
                        };
                    })];
                case 1:
                    _a.sent();
                    it('should call __ListMetrics and return result', function () {
                        expect(scenario.result[0].text).toContain('i-12345678');
                        expect(scenario.request.queries[0].type).toBe('metricFindQuery');
                        expect(scenario.request.queries[0].subtype).toBe('dimension_values');
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    describeMetricFindQuery('resource_arns(default,ec2:instance,{"environment":["production"]})', function (scenario) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, scenario.setup(function () {
                        scenario.requestResponse = {
                            results: {
                                metricFindQuery: {
                                    tables: [
                                        {
                                            rows: [
                                                [
                                                    'arn:aws:ec2:us-east-1:123456789012:instance/i-12345678901234567',
                                                    'arn:aws:ec2:us-east-1:123456789012:instance/i-76543210987654321',
                                                ],
                                            ],
                                        },
                                    ],
                                },
                            },
                        };
                    })];
                case 1:
                    _a.sent();
                    it('should call __ListMetrics and return result', function () {
                        expect(scenario.result[0].text).toContain('arn:aws:ec2:us-east-1:123456789012:instance/i-12345678901234567');
                        expect(scenario.request.queries[0].type).toBe('metricFindQuery');
                        expect(scenario.request.queries[0].subtype).toBe('resource_arns');
                    });
                    return [2 /*return*/];
            }
        });
    }); });
});
function genMockFrames(numResponses) {
    var recordIncrement = 50;
    var mockFrames = [];
    for (var i = 0; i < numResponses; i++) {
        mockFrames.push({
            fields: [],
            meta: {
                custom: {
                    Status: i === numResponses - 1 ? CloudWatchLogsQueryStatus.Complete : CloudWatchLogsQueryStatus.Running,
                },
                stats: [
                    {
                        displayName: 'Records scanned',
                        value: (i + 1) * recordIncrement,
                    },
                ],
            },
            refId: 'A',
            length: 0,
        });
    }
    return mockFrames;
}
//# sourceMappingURL=datasource.test.js.map