import AzureMonitorDatasource from '../datasource';
import Q from 'q';
import moment from 'moment';
import { TemplateSrv } from 'app/features/templating/template_srv';
describe('AppInsightsDatasource', function () {
    var ctx = {
        backendSrv: {},
        templateSrv: new TemplateSrv(),
    };
    beforeEach(function () {
        ctx.$q = Q;
        ctx.instanceSettings = {
            jsonData: { appInsightsAppId: '3ad4400f-ea7d-465d-a8fb-43fb20555d85' },
            url: 'http://appinsightsapi',
        };
        ctx.ds = new AzureMonitorDatasource(ctx.instanceSettings, ctx.backendSrv, ctx.templateSrv, ctx.$q);
    });
    describe('When performing testDatasource', function () {
        describe('and a list of metrics is returned', function () {
            var response = {
                metrics: {
                    'requests/count': {
                        displayName: 'Server requests',
                        defaultAggregation: 'sum',
                    },
                    'requests/duration': {
                        displayName: 'Server requests',
                        defaultAggregation: 'sum',
                    },
                },
                dimensions: {
                    'request/source': {
                        displayName: 'Request source',
                    },
                },
            };
            beforeEach(function () {
                ctx.backendSrv.datasourceRequest = function () {
                    return ctx.$q.when({ data: response, status: 200 });
                };
            });
            it('should return success status', function () {
                return ctx.ds.testDatasource().then(function (results) {
                    expect(results.status).toEqual('success');
                });
            });
        });
        describe('and a PathNotFoundError error is returned', function () {
            var error = {
                data: {
                    error: {
                        code: 'PathNotFoundError',
                        message: "An error message.",
                    },
                },
                status: 404,
                statusText: 'Not Found',
            };
            beforeEach(function () {
                ctx.backendSrv.datasourceRequest = function (options) {
                    return ctx.$q.reject(error);
                };
            });
            it('should return error status and a detailed error message', function () {
                return ctx.ds.testDatasource().then(function (results) {
                    expect(results.status).toEqual('error');
                    expect(results.message).toEqual('1. Application Insights: Not Found: Invalid Application Id for Application Insights service. ');
                });
            });
        });
        describe('and an error is returned', function () {
            var error = {
                data: {
                    error: {
                        code: 'SomeOtherError',
                        message: "An error message.",
                    },
                },
                status: 500,
                statusText: 'Error',
            };
            beforeEach(function () {
                ctx.backendSrv.datasourceRequest = function (options) {
                    return ctx.$q.reject(error);
                };
            });
            it('should return error status and a detailed error message', function () {
                return ctx.ds.testDatasource().then(function (results) {
                    expect(results.status).toEqual('error');
                    expect(results.message).toEqual('1. Application Insights: Error: SomeOtherError. An error message. ');
                });
            });
        });
    });
    describe('When performing query', function () {
        var options = {
            range: {
                from: moment.utc('2017-08-22T20:00:00Z'),
                to: moment.utc('2017-08-22T23:59:00Z'),
            },
            targets: [
                {
                    apiVersion: '2016-09-01',
                    refId: 'A',
                    queryType: 'Application Insights',
                    appInsights: {
                        metricName: 'exceptions/server',
                        groupBy: '',
                        timeGrainType: 'none',
                        timeGrain: '',
                        timeGrainUnit: '',
                        alias: '',
                    },
                },
            ],
        };
        describe('and with a single value', function () {
            var response = {
                value: {
                    start: '2017-08-30T15:53:58.845Z',
                    end: '2017-09-06T15:53:58.845Z',
                    'exceptions/server': {
                        sum: 100,
                    },
                },
            };
            beforeEach(function () {
                ctx.backendSrv.datasourceRequest = function (options) {
                    expect(options.url).toContain('/metrics/exceptions/server');
                    return ctx.$q.when({ data: response, status: 200 });
                };
            });
            it('should return a single datapoint', function () {
                return ctx.ds.query(options).then(function (results) {
                    expect(results.data.length).toBe(1);
                    expect(results.data[0].datapoints.length).toBe(1);
                    expect(results.data[0].target).toEqual('exceptions/server');
                    expect(results.data[0].datapoints[0][1]).toEqual(1504713238845);
                    expect(results.data[0].datapoints[0][0]).toEqual(100);
                });
            });
        });
        describe('and with an interval group and without a segment group by', function () {
            var response = {
                value: {
                    start: '2017-08-30T15:53:58.845Z',
                    end: '2017-09-06T15:53:58.845Z',
                    interval: 'PT1H',
                    segments: [
                        {
                            start: '2017-08-30T15:53:58.845Z',
                            end: '2017-08-30T16:00:00.000Z',
                            'exceptions/server': {
                                sum: 3,
                            },
                        },
                        {
                            start: '2017-08-30T16:00:00.000Z',
                            end: '2017-08-30T17:00:00.000Z',
                            'exceptions/server': {
                                sum: 66,
                            },
                        },
                    ],
                },
            };
            beforeEach(function () {
                options.targets[0].appInsights.timeGrainType = 'specific';
                options.targets[0].appInsights.timeGrain = '30';
                options.targets[0].appInsights.timeGrainUnit = 'minute';
                ctx.backendSrv.datasourceRequest = function (options) {
                    expect(options.url).toContain('/metrics/exceptions/server');
                    expect(options.url).toContain('interval=PT30M');
                    return ctx.$q.when({ data: response, status: 200 });
                };
            });
            it('should return a list of datapoints', function () {
                return ctx.ds.query(options).then(function (results) {
                    expect(results.data.length).toBe(1);
                    expect(results.data[0].datapoints.length).toBe(2);
                    expect(results.data[0].target).toEqual('exceptions/server');
                    expect(results.data[0].datapoints[0][1]).toEqual(1504108800000);
                    expect(results.data[0].datapoints[0][0]).toEqual(3);
                    expect(results.data[0].datapoints[1][1]).toEqual(1504112400000);
                    expect(results.data[0].datapoints[1][0]).toEqual(66);
                });
            });
        });
        describe('and with a group by', function () {
            var response = {
                value: {
                    start: '2017-08-30T15:53:58.845Z',
                    end: '2017-09-06T15:53:58.845Z',
                    interval: 'PT1H',
                    segments: [
                        {
                            start: '2017-08-30T15:53:58.845Z',
                            end: '2017-08-30T16:00:00.000Z',
                            segments: [
                                {
                                    'exceptions/server': {
                                        sum: 10,
                                    },
                                    'client/city': 'Miami',
                                },
                                {
                                    'exceptions/server': {
                                        sum: 1,
                                    },
                                    'client/city': 'San Jose',
                                },
                            ],
                        },
                        {
                            start: '2017-08-30T16:00:00.000Z',
                            end: '2017-08-30T17:00:00.000Z',
                            segments: [
                                {
                                    'exceptions/server': {
                                        sum: 20,
                                    },
                                    'client/city': 'Miami',
                                },
                                {
                                    'exceptions/server': {
                                        sum: 2,
                                    },
                                    'client/city': 'San Antonio',
                                },
                            ],
                        },
                    ],
                },
            };
            describe('and with no alias specified', function () {
                beforeEach(function () {
                    options.targets[0].appInsights.groupBy = 'client/city';
                    ctx.backendSrv.datasourceRequest = function (options) {
                        expect(options.url).toContain('/metrics/exceptions/server');
                        expect(options.url).toContain('segment=client/city');
                        return ctx.$q.when({ data: response, status: 200 });
                    };
                });
                it('should return a list of datapoints', function () {
                    return ctx.ds.query(options).then(function (results) {
                        expect(results.data.length).toBe(3);
                        expect(results.data[0].datapoints.length).toBe(2);
                        expect(results.data[0].target).toEqual('exceptions/server{client/city="Miami"}');
                        expect(results.data[0].datapoints[0][1]).toEqual(1504108800000);
                        expect(results.data[0].datapoints[0][0]).toEqual(10);
                        expect(results.data[0].datapoints[1][1]).toEqual(1504112400000);
                        expect(results.data[0].datapoints[1][0]).toEqual(20);
                    });
                });
            });
            describe('and with an alias specified', function () {
                beforeEach(function () {
                    options.targets[0].appInsights.groupBy = 'client/city';
                    options.targets[0].appInsights.alias = '{{metric}} + {{groupbyname}} + {{groupbyvalue}}';
                    ctx.backendSrv.datasourceRequest = function (options) {
                        expect(options.url).toContain('/metrics/exceptions/server');
                        expect(options.url).toContain('segment=client/city');
                        return ctx.$q.when({ data: response, status: 200 });
                    };
                });
                it('should return a list of datapoints', function () {
                    return ctx.ds.query(options).then(function (results) {
                        expect(results.data.length).toBe(3);
                        expect(results.data[0].datapoints.length).toBe(2);
                        expect(results.data[0].target).toEqual('exceptions/server + client/city + Miami');
                        expect(results.data[0].datapoints[0][1]).toEqual(1504108800000);
                        expect(results.data[0].datapoints[0][0]).toEqual(10);
                        expect(results.data[0].datapoints[1][1]).toEqual(1504112400000);
                        expect(results.data[0].datapoints[1][0]).toEqual(20);
                    });
                });
            });
        });
    });
    describe('When performing metricFindQuery', function () {
        describe('with a metric names query', function () {
            var response = {
                metrics: {
                    'exceptions/server': {},
                    'requests/count': {},
                },
            };
            beforeEach(function () {
                ctx.backendSrv.datasourceRequest = function (options) {
                    expect(options.url).toContain('/metrics/metadata');
                    return ctx.$q.when({ data: response, status: 200 });
                };
            });
            it('should return a list of metric names', function () {
                return ctx.ds.metricFindQuery('appInsightsMetricNames()').then(function (results) {
                    expect(results.length).toBe(2);
                    expect(results[0].text).toBe('exceptions/server');
                    expect(results[0].value).toBe('exceptions/server');
                    expect(results[1].text).toBe('requests/count');
                    expect(results[1].value).toBe('requests/count');
                });
            });
        });
        describe('with metadata group by query', function () {
            var response = {
                metrics: {
                    'exceptions/server': {
                        supportedAggregations: ['sum'],
                        supportedGroupBy: {
                            all: ['client/os', 'client/city', 'client/browser'],
                        },
                        defaultAggregation: 'sum',
                    },
                    'requests/count': {
                        supportedAggregations: ['avg', 'sum', 'total'],
                        supportedGroupBy: {
                            all: ['client/os', 'client/city', 'client/browser'],
                        },
                        defaultAggregation: 'avg',
                    },
                },
            };
            beforeEach(function () {
                ctx.backendSrv.datasourceRequest = function (options) {
                    expect(options.url).toContain('/metrics/metadata');
                    return ctx.$q.when({ data: response, status: 200 });
                };
            });
            it('should return a list of group bys', function () {
                return ctx.ds.metricFindQuery('appInsightsGroupBys(requests/count)').then(function (results) {
                    expect(results[0].text).toContain('client/os');
                    expect(results[0].value).toContain('client/os');
                    expect(results[1].text).toContain('client/city');
                    expect(results[1].value).toContain('client/city');
                    expect(results[2].text).toContain('client/browser');
                    expect(results[2].value).toContain('client/browser');
                });
            });
        });
    });
    describe('When getting Metric Names', function () {
        var response = {
            metrics: {
                'exceptions/server': {},
                'requests/count': {},
            },
        };
        beforeEach(function () {
            ctx.backendSrv.datasourceRequest = function (options) {
                expect(options.url).toContain('/metrics/metadata');
                return ctx.$q.when({ data: response, status: 200 });
            };
        });
        it('should return a list of metric names', function () {
            return ctx.ds.getAppInsightsMetricNames().then(function (results) {
                expect(results.length).toBe(2);
                expect(results[0].text).toBe('exceptions/server');
                expect(results[0].value).toBe('exceptions/server');
                expect(results[1].text).toBe('requests/count');
                expect(results[1].value).toBe('requests/count');
            });
        });
    });
    describe('When getting Metric Metadata', function () {
        var response = {
            metrics: {
                'exceptions/server': {
                    supportedAggregations: ['sum'],
                    supportedGroupBy: {
                        all: ['client/os', 'client/city', 'client/browser'],
                    },
                    defaultAggregation: 'sum',
                },
                'requests/count': {
                    supportedAggregations: ['avg', 'sum', 'total'],
                    supportedGroupBy: {
                        all: ['client/os', 'client/city', 'client/browser'],
                    },
                    defaultAggregation: 'avg',
                },
            },
        };
        beforeEach(function () {
            ctx.backendSrv.datasourceRequest = function (options) {
                expect(options.url).toContain('/metrics/metadata');
                return ctx.$q.when({ data: response, status: 200 });
            };
        });
        it('should return a list of group bys', function () {
            return ctx.ds.getAppInsightsMetricMetadata('requests/count').then(function (results) {
                expect(results.primaryAggType).toEqual('avg');
                expect(results.supportedAggTypes).toContain('avg');
                expect(results.supportedAggTypes).toContain('sum');
                expect(results.supportedAggTypes).toContain('total');
                expect(results.supportedGroupBy).toContain('client/os');
                expect(results.supportedGroupBy).toContain('client/city');
                expect(results.supportedGroupBy).toContain('client/browser');
            });
        });
    });
});
//# sourceMappingURL=app_insights_datasource.test.js.map