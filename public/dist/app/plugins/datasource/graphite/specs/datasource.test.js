var _this = this;
import * as tslib_1 from "tslib";
import { GraphiteDatasource } from '../datasource';
import moment from 'moment';
import _ from 'lodash';
import $q from 'q';
import { TemplateSrvStub } from 'test/specs/helpers';
describe('graphiteDatasource', function () {
    var ctx = {
        backendSrv: {},
        $q: $q,
        templateSrv: new TemplateSrvStub(),
        instanceSettings: { url: 'url', name: 'graphiteProd', jsonData: {} },
    };
    beforeEach(function () {
        ctx.instanceSettings.url = '/api/datasources/proxy/1';
        ctx.ds = new GraphiteDatasource(ctx.instanceSettings, ctx.$q, ctx.backendSrv, ctx.templateSrv);
    });
    describe('When querying graphite with one target using query editor target spec', function () {
        var query = {
            panelId: 3,
            dashboardId: 5,
            rangeRaw: { from: 'now-1h', to: 'now' },
            targets: [{ target: 'prod1.count' }, { target: 'prod2.count' }],
            maxDataPoints: 500,
        };
        var results;
        var requestOptions;
        beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ctx.backendSrv.datasourceRequest = function (options) {
                            requestOptions = options;
                            return ctx.$q.when({
                                data: [{ target: 'prod1.count', datapoints: [[10, 1], [12, 1]] }],
                            });
                        };
                        return [4 /*yield*/, ctx.ds.query(query).then(function (data) {
                                results = data;
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('X-Dashboard and X-Panel headers to be set!', function () {
            expect(requestOptions.headers['X-Dashboard-Id']).toBe(5);
            expect(requestOptions.headers['X-Panel-Id']).toBe(3);
        });
        it('should generate the correct query', function () {
            expect(requestOptions.url).toBe('/api/datasources/proxy/1/render');
        });
        it('should set unique requestId', function () {
            expect(requestOptions.requestId).toBe('graphiteProd.panelId.3');
        });
        it('should query correctly', function () {
            var params = requestOptions.data.split('&');
            expect(params).toContain('target=prod1.count');
            expect(params).toContain('target=prod2.count');
            expect(params).toContain('from=-1h');
            expect(params).toContain('until=now');
        });
        it('should exclude undefined params', function () {
            var params = requestOptions.data.split('&');
            expect(params).not.toContain('cacheTimeout=undefined');
        });
        it('should return series list', function () {
            expect(results.data.length).toBe(1);
            expect(results.data[0].target).toBe('prod1.count');
        });
        it('should convert to millisecond resolution', function () {
            expect(results.data[0].datapoints[0][0]).toBe(10);
        });
    });
    describe('when fetching Graphite Events as annotations', function () {
        var results;
        var options = {
            annotation: {
                tags: 'tag1',
            },
            range: {
                from: moment(1432288354),
                to: moment(1432288401),
            },
            rangeRaw: { from: 'now-24h', to: 'now' },
        };
        describe('and tags are returned as string', function () {
            var response = {
                data: [
                    {
                        when: 1507222850,
                        tags: 'tag1 tag2',
                        data: 'some text',
                        id: 2,
                        what: 'Event - deploy',
                    },
                ],
            };
            beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ctx.backendSrv.datasourceRequest = function (options) {
                                return ctx.$q.when(response);
                            };
                            return [4 /*yield*/, ctx.ds.annotationQuery(options).then(function (data) {
                                    results = data;
                                })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should parse the tags string into an array', function () {
                expect(_.isArray(results[0].tags)).toEqual(true);
                expect(results[0].tags.length).toEqual(2);
                expect(results[0].tags[0]).toEqual('tag1');
                expect(results[0].tags[1]).toEqual('tag2');
            });
        });
        describe('and tags are returned as an array', function () {
            var response = {
                data: [
                    {
                        when: 1507222850,
                        tags: ['tag1', 'tag2'],
                        data: 'some text',
                        id: 2,
                        what: 'Event - deploy',
                    },
                ],
            };
            beforeEach(function () {
                ctx.backendSrv.datasourceRequest = function (options) {
                    return ctx.$q.when(response);
                };
                ctx.ds.annotationQuery(options).then(function (data) {
                    results = data;
                });
                // ctx.$rootScope.$apply();
            });
            it('should parse the tags string into an array', function () {
                expect(_.isArray(results[0].tags)).toEqual(true);
                expect(results[0].tags.length).toEqual(2);
                expect(results[0].tags[0]).toEqual('tag1');
                expect(results[0].tags[1]).toEqual('tag2');
            });
        });
    });
    describe('building graphite params', function () {
        it('should return empty array if no targets', function () {
            var results = ctx.ds.buildGraphiteParams({
                targets: [{}],
            });
            expect(results.length).toBe(0);
        });
        it('should uri escape targets', function () {
            var results = ctx.ds.buildGraphiteParams({
                targets: [{ target: 'prod1.{test,test2}' }, { target: 'prod2.count' }],
            });
            expect(results).toContain('target=prod1.%7Btest%2Ctest2%7D');
        });
        it('should replace target placeholder', function () {
            var results = ctx.ds.buildGraphiteParams({
                targets: [{ target: 'series1' }, { target: 'series2' }, { target: 'asPercent(#A,#B)' }],
            });
            expect(results[2]).toBe('target=asPercent(series1%2Cseries2)');
        });
        it('should replace target placeholder for hidden series', function () {
            var results = ctx.ds.buildGraphiteParams({
                targets: [
                    { target: 'series1', hide: true },
                    { target: 'sumSeries(#A)', hide: true },
                    { target: 'asPercent(#A,#B)' },
                ],
            });
            expect(results[0]).toBe('target=' + encodeURIComponent('asPercent(series1,sumSeries(series1))'));
        });
        it('should replace target placeholder when nesting query references', function () {
            var results = ctx.ds.buildGraphiteParams({
                targets: [{ target: 'series1' }, { target: 'sumSeries(#A)' }, { target: 'asPercent(#A,#B)' }],
            });
            expect(results[2]).toBe('target=' + encodeURIComponent('asPercent(series1,sumSeries(series1))'));
        });
        it('should fix wrong minute interval parameters', function () {
            var results = ctx.ds.buildGraphiteParams({
                targets: [{ target: "summarize(prod.25m.count, '25m', 'sum')" }],
            });
            expect(results[0]).toBe('target=' + encodeURIComponent("summarize(prod.25m.count, '25min', 'sum')"));
        });
        it('should fix wrong month interval parameters', function () {
            var results = ctx.ds.buildGraphiteParams({
                targets: [{ target: "summarize(prod.5M.count, '5M', 'sum')" }],
            });
            expect(results[0]).toBe('target=' + encodeURIComponent("summarize(prod.5M.count, '5mon', 'sum')"));
        });
        it('should ignore empty targets', function () {
            var results = ctx.ds.buildGraphiteParams({
                targets: [{ target: 'series1' }, { target: '' }],
            });
            expect(results.length).toBe(2);
        });
    });
    describe('querying for template variables', function () {
        var results;
        var requestOptions;
        beforeEach(function () {
            ctx.backendSrv.datasourceRequest = function (options) {
                requestOptions = options;
                return ctx.$q.when({
                    data: ['backend_01', 'backend_02'],
                });
            };
        });
        it('should generate tags query', function () {
            ctx.ds.metricFindQuery('tags()').then(function (data) {
                results = data;
            });
            expect(requestOptions.url).toBe('/api/datasources/proxy/1/tags/autoComplete/tags');
            expect(requestOptions.params.expr).toEqual([]);
            expect(results).not.toBe(null);
        });
        it('should generate tags query with a filter expression', function () {
            ctx.ds.metricFindQuery('tags(server=backend_01)').then(function (data) {
                results = data;
            });
            expect(requestOptions.url).toBe('/api/datasources/proxy/1/tags/autoComplete/tags');
            expect(requestOptions.params.expr).toEqual(['server=backend_01']);
            expect(results).not.toBe(null);
        });
        it('should generate tags query for an expression with whitespace after', function () {
            ctx.ds.metricFindQuery('tags(server=backend_01 )').then(function (data) {
                results = data;
            });
            expect(requestOptions.url).toBe('/api/datasources/proxy/1/tags/autoComplete/tags');
            expect(requestOptions.params.expr).toEqual(['server=backend_01']);
            expect(results).not.toBe(null);
        });
        it('should generate tag values query for one tag', function () {
            ctx.ds.metricFindQuery('tag_values(server)').then(function (data) {
                results = data;
            });
            expect(requestOptions.url).toBe('/api/datasources/proxy/1/tags/autoComplete/values');
            expect(requestOptions.params.tag).toBe('server');
            expect(requestOptions.params.expr).toEqual([]);
            expect(results).not.toBe(null);
        });
        it('should generate tag values query for a tag and expression', function () {
            ctx.ds.metricFindQuery('tag_values(server,server=~backend*)').then(function (data) {
                results = data;
            });
            expect(requestOptions.url).toBe('/api/datasources/proxy/1/tags/autoComplete/values');
            expect(requestOptions.params.tag).toBe('server');
            expect(requestOptions.params.expr).toEqual(['server=~backend*']);
            expect(results).not.toBe(null);
        });
        it('should generate tag values query for a tag with whitespace after', function () {
            ctx.ds.metricFindQuery('tag_values(server )').then(function (data) {
                results = data;
            });
            expect(requestOptions.url).toBe('/api/datasources/proxy/1/tags/autoComplete/values');
            expect(requestOptions.params.tag).toBe('server');
            expect(requestOptions.params.expr).toEqual([]);
            expect(results).not.toBe(null);
        });
        it('should generate tag values query for a tag and expression with whitespace after', function () {
            ctx.ds.metricFindQuery('tag_values(server , server=~backend* )').then(function (data) {
                results = data;
            });
            expect(requestOptions.url).toBe('/api/datasources/proxy/1/tags/autoComplete/values');
            expect(requestOptions.params.tag).toBe('server');
            expect(requestOptions.params.expr).toEqual(['server=~backend*']);
            expect(results).not.toBe(null);
        });
    });
});
function accessScenario(name, url, fn) {
    describe('access scenario ' + name, function () {
        var ctx = {
            backendSrv: {},
            $q: $q,
            templateSrv: new TemplateSrvStub(),
            instanceSettings: { url: 'url', name: 'graphiteProd', jsonData: {} },
        };
        var httpOptions = {
            headers: {},
        };
        describe('when using proxy mode', function () {
            var options = { dashboardId: 1, panelId: 2 };
            it('tracing headers should be added', function () {
                ctx.instanceSettings.url = url;
                var ds = new GraphiteDatasource(ctx.instanceSettings, ctx.$q, ctx.backendSrv, ctx.templateSrv);
                ds.addTracingHeaders(httpOptions, options);
                fn(httpOptions);
            });
        });
    });
}
accessScenario('with proxy access', '/api/datasources/proxy/1', function (httpOptions) {
    expect(httpOptions.headers['X-Dashboard-Id']).toBe(1);
    expect(httpOptions.headers['X-Panel-Id']).toBe(2);
});
accessScenario('with direct access', 'http://localhost:8080', function (httpOptions) {
    expect(httpOptions.headers['X-Dashboard-Id']).toBe(undefined);
    expect(httpOptions.headers['X-Panel-Id']).toBe(undefined);
});
//# sourceMappingURL=datasource.test.js.map