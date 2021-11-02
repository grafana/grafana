import { __assign, __awaiter, __generator } from "tslib";
import { lastValueFrom, of } from 'rxjs';
import { setBackendSrv, setDataSourceSrv } from '@grafana/runtime';
import { ArrayVector, dataFrameToJSON, dateTime, MutableDataFrame } from '@grafana/data';
import { CloudWatchDatasource } from './datasource';
import { toArray } from 'rxjs/operators';
import { CloudWatchLogsQueryStatus } from './types';
import { TemplateSrvMock } from '../../../features/templating/template_srv.mock';
describe('datasource', function () {
    describe('query', function () {
        it('should return error if log query and log groups is not specified', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasource, observable;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasource = setup().datasource;
                        observable = datasource.query({ targets: [{ queryMode: 'Logs' }] });
                        return [4 /*yield*/, expect(observable).toEmitValuesWith(function (received) {
                                var _a;
                                var response = received[0];
                                expect((_a = response.error) === null || _a === void 0 ? void 0 : _a.message).toBe('Log group is required');
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should return empty response if queries are hidden', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasource, observable;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasource = setup().datasource;
                        observable = datasource.query({ targets: [{ queryMode: 'Logs', hide: true }] });
                        return [4 /*yield*/, expect(observable).toEmitValuesWith(function (received) {
                                var response = received[0];
                                expect(response.data).toEqual([]);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should interpolate variables in the query', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, datasource, fetchMock;
            return __generator(this, function (_b) {
                _a = setup(), datasource = _a.datasource, fetchMock = _a.fetchMock;
                datasource.query({
                    targets: [
                        {
                            queryMode: 'Logs',
                            region: '$region',
                            expression: 'fields $fields',
                            logGroupNames: ['/some/$group'],
                        },
                    ],
                });
                expect(fetchMock.mock.calls[0][0].data.queries[0]).toMatchObject({
                    queryString: 'fields templatedField',
                    logGroupNames: ['/some/templatedGroup'],
                    region: 'templatedRegion',
                });
                return [2 /*return*/];
            });
        }); });
        it('should add links to log queries', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasource, observable, emits;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasource = setupForLogs().datasource;
                        observable = datasource.query({
                            targets: [
                                {
                                    queryMode: 'Logs',
                                    logGroupNames: ['test'],
                                    refId: 'a',
                                },
                            ],
                        });
                        return [4 /*yield*/, lastValueFrom(observable.pipe(toArray()))];
                    case 1:
                        emits = _a.sent();
                        expect(emits).toHaveLength(1);
                        expect(emits[0].data[0].fields.find(function (f) { return f.name === '@xrayTraceId'; }).config.links).toMatchObject([
                            {
                                title: 'Xray',
                                url: '',
                                internal: {
                                    query: { query: '${__value.raw}', region: 'us-west-1', queryType: 'getTrace' },
                                    datasourceUid: 'xray',
                                    datasourceName: 'Xray',
                                },
                            },
                        ]);
                        expect(emits[0].data[0].fields.find(function (f) { return f.name === '@message'; }).config.links).toMatchObject([
                            {
                                title: 'View in CloudWatch console',
                                url: "https://us-west-1.console.aws.amazon.com/cloudwatch/home?region=us-west-1#logs-insights:queryDetail=~(end~'2020-12-31T19*3a00*3a00.000Z~start~'2020-12-31T19*3a00*3a00.000Z~timeType~'ABSOLUTE~tz~'UTC~editorString~'~isLiveTail~false~source~(~'test))",
                            },
                        ]);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('performTimeSeriesQuery', function () {
        it('should return the same length of data as result', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasource, observable;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasource = setup({
                            data: {
                                results: {
                                    a: { refId: 'a', series: [{ name: 'cpu', points: [1, 1] }], meta: {} },
                                    b: { refId: 'b', series: [{ name: 'memory', points: [2, 2] }], meta: {} },
                                },
                            },
                        }).datasource;
                        observable = datasource.performTimeSeriesQuery({
                            queries: [
                                { datasourceId: 1, refId: 'a' },
                                { datasourceId: 1, refId: 'b' },
                            ],
                        }, { from: dateTime(), to: dateTime() });
                        return [4 /*yield*/, expect(observable).toEmitValuesWith(function (received) {
                                var response = received[0];
                                expect(response.data.length).toEqual(2);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('describeLogGroup', function () {
        it('replaces region correctly in the query', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, datasource, fetchMock;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), datasource = _a.datasource, fetchMock = _a.fetchMock;
                        return [4 /*yield*/, datasource.describeLogGroups({ region: 'default' })];
                    case 1:
                        _b.sent();
                        expect(fetchMock.mock.calls[0][0].data.queries[0].region).toBe('us-west-1');
                        return [4 /*yield*/, datasource.describeLogGroups({ region: 'eu-east' })];
                    case 2:
                        _b.sent();
                        expect(fetchMock.mock.calls[1][0].data.queries[0].region).toBe('eu-east');
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
function setup(_a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.data, data = _c === void 0 ? [] : _c;
    var datasource = new CloudWatchDatasource({ jsonData: { defaultRegion: 'us-west-1', tracingDatasourceUid: 'xray' } }, new TemplateSrvMock({ region: 'templatedRegion', fields: 'templatedField', group: 'templatedGroup' }), {
        timeRange: function () {
            var time = dateTime('2021-01-01T01:00:00Z');
            var range = {
                from: time.subtract(6, 'hour'),
                to: time,
            };
            return __assign(__assign({}, range), { raw: range });
        },
    });
    var fetchMock = jest.fn().mockReturnValue(of({ data: data }));
    setBackendSrv({ fetch: fetchMock });
    return { datasource: datasource, fetchMock: fetchMock };
}
function setupForLogs() {
    function envelope(frame) {
        return { data: { results: { a: { refId: 'a', frames: [dataFrameToJSON(frame)] } } } };
    }
    var _a = setup(), datasource = _a.datasource, fetchMock = _a.fetchMock;
    var startQueryFrame = new MutableDataFrame({ fields: [{ name: 'queryId', values: ['queryid'] }] });
    fetchMock.mockReturnValueOnce(of(envelope(startQueryFrame)));
    var logsFrame = new MutableDataFrame({
        fields: [
            {
                name: '@message',
                values: new ArrayVector(['something']),
            },
            {
                name: '@timestamp',
                values: new ArrayVector([1]),
            },
            {
                name: '@xrayTraceId',
                values: new ArrayVector(['1-613f0d6b-3e7cb34375b60662359611bd']),
            },
        ],
        meta: { custom: { Status: CloudWatchLogsQueryStatus.Complete } },
    });
    fetchMock.mockReturnValueOnce(of(envelope(logsFrame)));
    setDataSourceSrv({
        get: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, {
                            name: 'Xray',
                        }];
                });
            });
        },
    });
    return { datasource: datasource, fetchMock: fetchMock };
}
//# sourceMappingURL=datasource.test.js.map