import { __assign, __awaiter, __generator } from "tslib";
import { GraphiteDatasource } from './datasource';
import { isArray } from 'lodash';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { dateTime, getFrameDisplayName } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { of } from 'rxjs';
import { createFetchResponse } from 'test/helpers/createFetchResponse';
import { DEFAULT_GRAPHITE_VERSION } from './versions';
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: function () { return backendSrv; } })); });
describe('graphiteDatasource', function () {
    var fetchMock = jest.spyOn(backendSrv, 'fetch');
    var ctx = {};
    beforeEach(function () {
        jest.clearAllMocks();
        var instanceSettings = {
            url: '/api/datasources/proxy/1',
            name: 'graphiteProd',
            jsonData: {
                rollupIndicatorEnabled: true,
            },
        };
        var templateSrv = new TemplateSrv();
        var ds = new GraphiteDatasource(instanceSettings, templateSrv);
        ctx = { templateSrv: templateSrv, ds: ds };
    });
    it('uses default Graphite version when no graphiteVersion is provided', function () {
        expect(ctx.ds.graphiteVersion).toBe(DEFAULT_GRAPHITE_VERSION);
    });
    describe('convertResponseToDataFrames', function () {
        it('should transform regular result', function () {
            var result = ctx.ds.convertResponseToDataFrames({
                data: {
                    meta: {
                        stats: {
                            'executeplan.cache-hit-partial.count': 5,
                            'executeplan.cache-hit.count': 10,
                        },
                    },
                    series: [
                        {
                            target: 'seriesA',
                            datapoints: [
                                [100, 200],
                                [101, 201],
                            ],
                            meta: [
                                {
                                    'aggnum-norm': 1,
                                    'aggnum-rc': 7,
                                    'archive-interval': 3600,
                                    'archive-read': 1,
                                    'consolidator-normfetch': 'AverageConsolidator',
                                    'consolidator-rc': 'AverageConsolidator',
                                    count: 1,
                                    'schema-name': 'wpUsageMetrics',
                                    'schema-retentions': '1h:35d:6h:2,2h:2y:6h:2',
                                },
                            ],
                        },
                        {
                            target: 'seriesB',
                            meta: [
                                {
                                    'aggnum-norm': 1,
                                    'aggnum-rc': 0,
                                    'archive-interval': 3600,
                                    'archive-read': 0,
                                    'consolidator-normfetch': 'AverageConsolidator',
                                    'consolidator-rc': 'NoneConsolidator',
                                    count: 1,
                                    'schema-name': 'wpUsageMetrics',
                                    'schema-retentions': '1h:35d:6h:2,2h:2y:6h:2',
                                },
                            ],
                            datapoints: [
                                [200, 300],
                                [201, 301],
                            ],
                        },
                    ],
                },
            });
            expect(result.data.length).toBe(2);
            expect(getFrameDisplayName(result.data[0])).toBe('seriesA');
            expect(getFrameDisplayName(result.data[1])).toBe('seriesB');
            expect(result.data[0].length).toBe(2);
            expect(result.data[0].meta.notices.length).toBe(1);
            expect(result.data[0].meta.notices[0].text).toBe('Data is rolled up, aggregated over 2h using Average function');
            expect(result.data[1].meta.notices).toBeUndefined();
        });
    });
    describe('When querying graphite with one target using query editor target spec', function () {
        var query = {
            panelId: 3,
            dashboardId: 5,
            range: { raw: { from: 'now-1h', to: 'now' } },
            targets: [{ target: 'prod1.count' }, { target: 'prod2.count' }],
            maxDataPoints: 500,
        };
        var response;
        var requestOptions;
        beforeEach(function () {
            fetchMock.mockImplementation(function (options) {
                requestOptions = options;
                return of(createFetchResponse([
                    {
                        target: 'prod1.count',
                        datapoints: [
                            [10, 1],
                            [12, 1],
                        ],
                    },
                ]));
            });
            response = ctx.ds.query(query);
        });
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
        it('should return series list', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, expect(response).toEmitValuesWith(function (values) {
                            var results = values[0];
                            expect(results.data.length).toBe(1);
                            expect(results.data[0].name).toBe('prod1.count');
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should convert to millisecond resolution', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, expect(response).toEmitValuesWith(function (values) {
                            var results = values[0];
                            expect(results.data[0].fields[1].values.get(0)).toBe(10);
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when fetching Graphite Events as annotations', function () {
        var results;
        var options = {
            annotation: {
                tags: 'tag1',
            },
            range: {
                from: dateTime(1432288354),
                to: dateTime(1432288401),
                raw: { from: 'now-24h', to: 'now' },
            },
        };
        describe('and tags are returned as string', function () {
            var response = [
                {
                    when: 1507222850,
                    tags: 'tag1 tag2',
                    data: 'some text',
                    id: 2,
                    what: 'Event - deploy',
                },
            ];
            beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            fetchMock.mockImplementation(function (options) {
                                return of(createFetchResponse(response));
                            });
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
                expect(isArray(results[0].tags)).toEqual(true);
                expect(results[0].tags.length).toEqual(2);
                expect(results[0].tags[0]).toEqual('tag1');
                expect(results[0].tags[1]).toEqual('tag2');
            });
        });
        describe('and tags are returned as an array', function () {
            var response = [
                {
                    when: 1507222850,
                    tags: ['tag1', 'tag2'],
                    data: 'some text',
                    id: 2,
                    what: 'Event - deploy',
                },
            ];
            beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            fetchMock.mockImplementation(function (options) {
                                return of(createFetchResponse(response));
                            });
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
                expect(isArray(results[0].tags)).toEqual(true);
                expect(results[0].tags.length).toEqual(2);
                expect(results[0].tags[0]).toEqual('tag1');
                expect(results[0].tags[1]).toEqual('tag2');
            });
        });
        it('and tags response is invalid', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        fetchMock.mockImplementation(function (options) {
                            return of(createFetchResponse('zzzzzzz'));
                        });
                        return [4 /*yield*/, ctx.ds.annotationQuery(options).then(function (data) {
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
    describe('when fetching Graphite function descriptions', function () {
        // `"default": Infinity` (invalid JSON) in params passed by Graphite API in 1.1.7
        var INVALID_JSON = '{"testFunction":{"name":"function","description":"description","module":"graphite.render.functions","group":"Transform","params":[{"name":"param","type":"intOrInf","required":true,"default":Infinity}]}}';
        it('should parse the response with an invalid JSON', function () { return __awaiter(void 0, void 0, void 0, function () {
            var funcDefs;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        fetchMock.mockImplementation(function () {
                            return of(createFetchResponse(INVALID_JSON));
                        });
                        return [4 /*yield*/, ctx.ds.getFuncDefs()];
                    case 1:
                        funcDefs = _a.sent();
                        expect(funcDefs).toEqual({
                            testFunction: {
                                category: 'Transform',
                                defaultParams: ['inf'],
                                description: 'description',
                                fake: true,
                                name: 'function',
                                params: [
                                    {
                                        multiple: false,
                                        name: 'param',
                                        optional: false,
                                        options: undefined,
                                        type: 'int_or_infinity',
                                    },
                                ],
                            },
                        });
                        return [2 /*return*/];
                }
            });
        }); });
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
        describe('when formatting targets', function () {
            it('does not attempt to glob for one variable', function () {
                ctx.templateSrv.init([
                    {
                        type: 'query',
                        name: 'metric',
                        current: { value: ['b'] },
                    },
                ]);
                var results = ctx.ds.buildGraphiteParams({
                    targets: [{ target: 'my.$metric.*' }],
                });
                expect(results).toStrictEqual(['target=my.b.*', 'format=json']);
            });
            it('globs for more than one variable', function () {
                ctx.templateSrv.init([
                    {
                        type: 'query',
                        name: 'metric',
                        current: { value: ['a', 'b'] },
                    },
                ]);
                var results = ctx.ds.buildGraphiteParams({
                    targets: [{ target: 'my.[[metric]].*' }],
                });
                expect(results).toStrictEqual(['target=my.%7Ba%2Cb%7D.*', 'format=json']);
            });
        });
    });
    describe('querying for template variables', function () {
        var results;
        var requestOptions;
        beforeEach(function () {
            fetchMock.mockImplementation(function (options) {
                requestOptions = options;
                return of(createFetchResponse(['backend_01', 'backend_02']));
            });
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
        it('/metrics/find should be POST', function () {
            ctx.templateSrv.init([
                {
                    type: 'query',
                    name: 'foo',
                    current: { value: ['bar'] },
                },
            ]);
            ctx.ds.metricFindQuery('[[foo]]').then(function (data) {
                results = data;
            });
            expect(requestOptions.url).toBe('/api/datasources/proxy/1/metrics/find');
            expect(requestOptions.method).toEqual('POST');
            expect(requestOptions.headers).toHaveProperty('Content-Type', 'application/x-www-form-urlencoded');
            expect(requestOptions.data).toMatch("query=bar");
            expect(requestOptions).toHaveProperty('params');
        });
        it('should interpolate $__searchFilter with searchFilter', function () {
            ctx.ds.metricFindQuery('app.$__searchFilter', { searchFilter: 'backend' }).then(function (data) {
                results = data;
            });
            expect(requestOptions.url).toBe('/api/datasources/proxy/1/metrics/find');
            expect(requestOptions.params).toEqual({});
            expect(requestOptions.data).toEqual('query=app.backend*');
            expect(results).not.toBe(null);
        });
        it('should interpolate $__searchFilter with default when searchFilter is missing', function () {
            ctx.ds.metricFindQuery('app.$__searchFilter', {}).then(function (data) {
                results = data;
            });
            expect(requestOptions.url).toBe('/api/datasources/proxy/1/metrics/find');
            expect(requestOptions.params).toEqual({});
            expect(requestOptions.data).toEqual('query=app.*');
            expect(results).not.toBe(null);
        });
        it('should request expanded metrics', function () {
            ctx.ds.metricFindQuery('expand(*.servers.*)').then(function (data) {
                results = data;
            });
            expect(requestOptions.url).toBe('/api/datasources/proxy/1/metrics/expand');
            expect(requestOptions.params.query).toBe('*.servers.*');
            expect(results).not.toBe(null);
        });
    });
});
function accessScenario(name, url, fn) {
    describe('access scenario ' + name, function () {
        var ctx = {
            // @ts-ignore
            templateSrv: new TemplateSrv(),
            instanceSettings: { url: 'url', name: 'graphiteProd', jsonData: {} },
        };
        var httpOptions = {
            headers: {},
        };
        describe('when using proxy mode', function () {
            var options = { dashboardId: 1, panelId: 2 };
            it('tracing headers should be added', function () {
                ctx.instanceSettings.url = url;
                var ds = new GraphiteDatasource(ctx.instanceSettings, ctx.templateSrv);
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