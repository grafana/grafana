import { __awaiter } from "tslib";
import { map } from 'lodash';
import { of, throwError } from 'rxjs';
import { getQueryOptions } from 'test/helpers/getQueryOptions';
import { CoreApp, dateMath, dateTime, FieldType, MutableDataFrame, SupplementaryQueryType, toUtc, } from '@grafana/data';
import { reportInteraction, config } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { createFetchResponse } from '../../../../test/helpers/createFetchResponse';
import { enhanceDataFrame } from './LegacyQueryRunner';
import { createElasticDatasource } from './mocks';
const ELASTICSEARCH_MOCK_URL = 'http://elasticsearch.local';
const originalConsoleError = console.error;
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => backendSrv, reportInteraction: jest.fn(), getDataSourceSrv: () => {
        return {
            getInstanceSettings: () => {
                return { name: 'elastic25' };
            },
        };
    } })));
const TIMESRV_START = [2022, 8, 21, 6, 10, 10];
const TIMESRV_END = [2022, 8, 24, 6, 10, 21];
const DATAQUERY_BASE = {
    requestId: '1',
    interval: '',
    intervalMs: 0,
    scopedVars: {
        test: { text: '', value: '' },
    },
    timezone: '',
    app: 'test',
    startTime: 0,
};
jest.mock('app/features/dashboard/services/TimeSrv', () => (Object.assign(Object.assign({}, jest.requireActual('app/features/dashboard/services/TimeSrv')), { getTimeSrv: () => ({
        timeRange: () => createTimeRange(toUtc(TIMESRV_START), toUtc(TIMESRV_END)),
    }) })));
const createTimeRange = (from, to) => ({
    from,
    to,
    raw: {
        from,
        to,
    },
});
function getTestContext({ data = { responses: [] }, from = 'now-5m', jsonData, fetchMockImplementation, templateSrvMock, } = {}) {
    const defaultMock = (options) => of(createFetchResponse(data));
    const fetchMock = jest.spyOn(backendSrv, 'fetch');
    fetchMock.mockImplementation(fetchMockImplementation !== null && fetchMockImplementation !== void 0 ? fetchMockImplementation : defaultMock);
    const timeSrv = {
        time: { from, to: 'now' },
        timeRange: () => ({
            from: dateMath.parse(timeSrv.time.from, false),
            to: dateMath.parse(timeSrv.time.to, true),
        }),
        setTime: (time) => {
            timeSrv.time = time;
        },
    };
    const settings = { url: ELASTICSEARCH_MOCK_URL };
    settings.jsonData = jsonData;
    const templateSrv = templateSrvMock !== null && templateSrvMock !== void 0 ? templateSrvMock : {
        replace: (text) => {
            if (text === null || text === void 0 ? void 0 : text.startsWith('$')) {
                return `resolvedVariable`;
            }
            else {
                return text;
            }
        },
        containsTemplate: jest.fn().mockImplementation((text) => { var _a; return (_a = text === null || text === void 0 ? void 0 : text.includes('$')) !== null && _a !== void 0 ? _a : false; }),
        getAdhocFilters: jest.fn().mockReturnValue([]),
    };
    const ds = createElasticDatasource(settings, templateSrv);
    return { timeSrv, ds, fetchMock, templateSrv };
}
describe('ElasticDatasource', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('When calling getTagValues', () => {
        it('should respect the currently selected time range', () => {
            const data = {
                responses: [
                    {
                        aggregations: {
                            '1': {
                                buckets: [
                                    {
                                        doc_count: 10,
                                        key: 'val1',
                                    },
                                    {
                                        doc_count: 20,
                                        key: 'val2',
                                    },
                                    {
                                        doc_count: 30,
                                        key: 'val3',
                                    },
                                ],
                            },
                        },
                    },
                ],
            };
            const { ds, fetchMock } = getTestContext({
                data,
                jsonData: { interval: 'Daily', timeField: '@timestamp' },
            });
            ds.getTagValues({ key: 'test' });
            expect(fetchMock).toHaveBeenCalledTimes(1);
            const obj = JSON.parse(fetchMock.mock.calls[0][0].data.split('\n')[1]);
            const { lte, gte } = obj.query.bool.filter[0].range['@timestamp'];
            expect(gte).toBe('1663740610000'); // 2022-09-21T06:10:10Z
            expect(lte).toBe('1663999821000'); // 2022-09-24T06:10:21Z
        });
    });
    describe('When testing datasource with index pattern', () => {
        it('should translate index pattern to current day', () => __awaiter(void 0, void 0, void 0, function* () {
            const { ds, fetchMock } = getTestContext({ jsonData: { interval: 'Daily' } });
            yield ds.testDatasource();
            const today = toUtc().format('YYYY.MM.DD');
            const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
            expect(lastCall[0].url).toBe(`${ELASTICSEARCH_MOCK_URL}/test-${today}/_mapping`);
        }));
    });
    describe('When issuing metric query with interval pattern', () => {
        function runScenario() {
            return __awaiter(this, void 0, void 0, function* () {
                const range = { from: toUtc([2015, 4, 30, 10]), to: toUtc([2015, 5, 1, 10]), raw: { from: '', to: '' } };
                const targets = [
                    {
                        refId: 'test',
                        alias: '$varAlias',
                        bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '1' }],
                        metrics: [{ type: 'count', id: '1' }],
                        query: 'escape\\:test',
                    },
                ];
                const query = Object.assign(Object.assign({}, DATAQUERY_BASE), { range, targets });
                const data = {
                    responses: [
                        {
                            aggregations: {
                                '1': {
                                    buckets: [
                                        {
                                            doc_count: 10,
                                            key: 1000,
                                        },
                                    ],
                                },
                            },
                        },
                    ],
                };
                const { ds, fetchMock } = getTestContext({ jsonData: { interval: 'Daily' }, data });
                let result = { data: [] };
                yield expect(ds.query(query)).toEmitValuesWith((received) => {
                    expect(received.length).toBe(1);
                    expect(received[0]).toEqual({
                        data: [
                            {
                                name: 'resolvedVariable',
                                refId: 'test',
                                fields: [
                                    {
                                        name: 'Time',
                                        type: FieldType.time,
                                        config: {},
                                        values: [1000],
                                    },
                                    {
                                        name: 'Value',
                                        type: FieldType.number,
                                        config: {},
                                        values: [10],
                                    },
                                ],
                                length: 1,
                            },
                        ],
                    });
                    result = received[0];
                });
                expect(fetchMock).toHaveBeenCalledTimes(1);
                const requestOptions = fetchMock.mock.calls[0][0];
                const parts = requestOptions.data.split('\n');
                const header = JSON.parse(parts[0]);
                const body = JSON.parse(parts[1]);
                return { result, body, header, query };
            });
        }
        it('should translate index pattern to current day', () => __awaiter(void 0, void 0, void 0, function* () {
            const { header } = yield runScenario();
            expect(header.index).toEqual(['test-2015.05.30', 'test-2015.05.31', 'test-2015.06.01']);
        }));
        it('should not resolve the variable in the original alias field in the query', () => __awaiter(void 0, void 0, void 0, function* () {
            const { query } = yield runScenario();
            expect(query.targets[0].alias).toEqual('$varAlias');
        }));
        it('should resolve the alias variable for the alias/target in the result', () => __awaiter(void 0, void 0, void 0, function* () {
            const { result } = yield runScenario();
            expect(result.data[0].name).toEqual('resolvedVariable');
        }));
        it('should json escape lucene query', () => __awaiter(void 0, void 0, void 0, function* () {
            const { body } = yield runScenario();
            expect(body.query.bool.filter[1].query_string.query).toBe('escape\\:test');
        }));
        it('should report query interaction', () => __awaiter(void 0, void 0, void 0, function* () {
            yield runScenario();
            expect(reportInteraction).toHaveBeenCalledWith('grafana_elasticsearch_query_executed', expect.objectContaining({
                alias: '$varAlias',
                app: 'test',
                has_data: true,
                has_error: false,
                line_limit: undefined,
                query_type: 'metric',
                simultaneously_sent_query_count: 1,
                with_lucene_query: true,
            }));
        }));
    });
    describe('When issuing logs query with interval pattern', () => {
        function setupDataSource(jsonData) {
            return __awaiter(this, void 0, void 0, function* () {
                jsonData = Object.assign({ interval: 'Daily', timeField: '@timestamp' }, (jsonData || {}));
                const { ds } = getTestContext({
                    jsonData,
                    data: logsResponse.data,
                    database: 'mock-index',
                });
                const query = {
                    range: createTimeRange(toUtc([2015, 4, 30, 10]), toUtc([2019, 7, 1, 10])),
                    targets: [
                        {
                            alias: '$varAlias',
                            refId: 'A',
                            bucketAggs: [
                                {
                                    type: 'date_histogram',
                                    settings: { interval: 'auto' },
                                    id: '2',
                                },
                            ],
                            metrics: [{ type: 'logs', id: '1' }],
                            query: 'escape\\:test',
                            timeField: '@timestamp',
                        },
                    ],
                };
                const queryBuilderSpy = jest.spyOn(ds.queryBuilder, 'getLogsQuery');
                let response = { data: [] };
                yield expect(ds.query(query)).toEmitValuesWith((received) => {
                    expect(received.length).toBe(1);
                    response = received[0];
                });
                return { queryBuilderSpy, response };
            });
        }
        it('should call getLogsQuery()', () => __awaiter(void 0, void 0, void 0, function* () {
            const { queryBuilderSpy } = yield setupDataSource();
            expect(queryBuilderSpy).toHaveBeenCalled();
        }));
        it('should enhance fields with links', () => __awaiter(void 0, void 0, void 0, function* () {
            const { response } = yield setupDataSource({
                dataLinks: [
                    {
                        field: 'host',
                        url: 'http://localhost:3000/${__value.raw}',
                        urlDisplayLabel: 'Custom Label',
                    },
                ],
            });
            expect(response.data.length).toBe(1);
            const links = response.data[0].fields.find((field) => field.name === 'host').config.links;
            expect(links.length).toBe(1);
            expect(links[0].url).toBe('http://localhost:3000/${__value.raw}');
            expect(links[0].title).toBe('Custom Label');
        }));
        it('should report query interaction', () => __awaiter(void 0, void 0, void 0, function* () {
            yield setupDataSource();
            expect(reportInteraction).toHaveBeenCalledWith('grafana_elasticsearch_query_executed', expect.objectContaining({
                alias: '$varAlias',
                app: undefined,
                has_data: true,
                has_error: false,
                line_limit: undefined,
                query_type: 'logs',
                simultaneously_sent_query_count: 1,
                with_lucene_query: true,
            }));
        }));
    });
    describe('When issuing document query', () => {
        function runScenario() {
            return __awaiter(this, void 0, void 0, function* () {
                const range = createTimeRange(dateTime([2015, 4, 30, 10]), dateTime([2015, 5, 1, 10]));
                const targets = [
                    { refId: 'A', metrics: [{ type: 'raw_document', id: '1' }], query: 'test' },
                ];
                const query = Object.assign(Object.assign({}, DATAQUERY_BASE), { range, targets });
                const data = { responses: [] };
                const { ds, fetchMock } = getTestContext({ data, database: 'test' });
                yield expect(ds.query(query)).toEmitValuesWith((received) => {
                    expect(received.length).toBe(1);
                    expect(received[0]).toEqual({ data: [] });
                });
                expect(fetchMock).toHaveBeenCalledTimes(1);
                const requestOptions = fetchMock.mock.calls[0][0];
                const parts = requestOptions.data.split('\n');
                const header = JSON.parse(parts[0]);
                const body = JSON.parse(parts[1]);
                return { body, header };
            });
        }
        it('should set search type to query_then_fetch', () => __awaiter(void 0, void 0, void 0, function* () {
            const { header } = yield runScenario();
            expect(header.search_type).toEqual('query_then_fetch');
        }));
        it('should set size', () => __awaiter(void 0, void 0, void 0, function* () {
            const { body } = yield runScenario();
            expect(body.size).toBe(500);
        }));
        it('should report query interaction', () => __awaiter(void 0, void 0, void 0, function* () {
            yield runScenario();
            expect(reportInteraction).toHaveBeenCalledWith('grafana_elasticsearch_query_executed', expect.objectContaining({
                alias: undefined,
                app: 'test',
                has_data: false,
                has_error: false,
                line_limit: undefined,
                query_type: 'raw_document',
                simultaneously_sent_query_count: 1,
                with_lucene_query: true,
            }));
        }));
    });
    describe('When getting an error on response', () => {
        const query = {
            range: createTimeRange(toUtc([2020, 1, 1, 10]), toUtc([2020, 2, 1, 10])),
            targets: [
                {
                    refId: 'A',
                    alias: '$varAlias',
                    bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '1' }],
                    metrics: [{ type: 'count', id: '1' }],
                    query: 'escape\\:test',
                },
            ],
        };
        it('should process it properly', () => __awaiter(void 0, void 0, void 0, function* () {
            const { ds } = getTestContext({
                jsonData: { interval: 'Daily' },
                data: {
                    took: 1,
                    responses: [
                        {
                            error: {
                                reason: 'all shards failed',
                            },
                            status: 400,
                        },
                    ],
                },
            });
            const errObject = {
                data: '{\n    "reason": "all shards failed"\n}',
                message: 'all shards failed',
                config: {
                    url: 'http://localhost:3000/api/ds/query',
                },
            };
            yield expect(ds.query(query)).toEmitValuesWith((received) => {
                expect(received.length).toBe(1);
                expect(received[0]).toEqual(errObject);
            });
        }));
        it('should properly throw an error with just a message', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = {
                data: {
                    error: 'Bad Request',
                    message: 'Authentication to data source failed',
                },
                status: 400,
                url: 'http://localhost:3000/api/ds/query',
                config: { url: 'http://localhost:3000/api/ds/query' },
                type: 'basic',
                statusText: 'Bad Request',
                redirected: false,
                headers: {},
                ok: false,
            };
            const { ds } = getTestContext({
                fetchMockImplementation: () => throwError(response),
                from: undefined,
            });
            const errObject = {
                error: 'Bad Request',
                message: 'Authentication to data source failed',
            };
            yield expect(ds.query(query)).toEmitValuesWith((received) => {
                expect(received.length).toBe(1);
                expect(received[0]).toEqual(errObject);
            });
        }));
        it('should properly throw an unknown error', () => __awaiter(void 0, void 0, void 0, function* () {
            const { ds } = getTestContext({
                jsonData: { interval: 'Daily' },
                data: {
                    took: 1,
                    responses: [
                        {
                            error: {},
                            status: 400,
                        },
                    ],
                },
            });
            const errObject = {
                data: '{}',
                message: 'Unknown elastic error response',
                config: {
                    url: 'http://localhost:3000/api/ds/query',
                },
            };
            yield expect(ds.query(query)).toEmitValuesWith((received) => {
                expect(received.length).toBe(1);
                expect(received[0]).toEqual(errObject);
            });
        }));
    });
    describe('When getting field mappings on indices with gaps', () => {
        const basicResponse = {
            metricbeat: {
                mappings: {
                    metricsets: {
                        _all: {},
                        properties: {
                            '@timestamp': { type: 'date' },
                            beat: {
                                properties: {
                                    hostname: { type: 'string' },
                                },
                            },
                        },
                    },
                },
            },
        };
        it('should not retry when ES is down', () => __awaiter(void 0, void 0, void 0, function* () {
            const twoDaysBefore = toUtc().subtract(2, 'day').format('YYYY.MM.DD');
            const { ds, timeSrv, fetchMock } = getTestContext({
                from: 'now-2w',
                jsonData: { interval: 'Daily' },
                fetchMockImplementation: (options) => {
                    if (options.url === `${ELASTICSEARCH_MOCK_URL}/asd-${twoDaysBefore}/_mapping`) {
                        return of(createFetchResponse(basicResponse));
                    }
                    return throwError({ status: 500 });
                },
            });
            const range = timeSrv.timeRange();
            yield expect(ds.getFields(undefined, range)).toEmitValuesWith((received) => {
                expect(received.length).toBe(1);
                expect(received[0]).toStrictEqual({ status: 500 });
                expect(fetchMock).toBeCalledTimes(1);
            });
        }));
        it('should not retry more than 7 indices', () => __awaiter(void 0, void 0, void 0, function* () {
            const { ds, timeSrv, fetchMock } = getTestContext({
                from: 'now-2w',
                jsonData: { interval: 'Daily' },
                fetchMockImplementation: (options) => {
                    return throwError({ status: 404 });
                },
            });
            const range = timeSrv.timeRange();
            yield expect(ds.getFields(undefined, range)).toEmitValuesWith((received) => {
                expect(received.length).toBe(1);
                expect(received[0]).toStrictEqual('Could not find an available index for this time range.');
                expect(fetchMock).toBeCalledTimes(7);
            });
        }));
    });
    describe('When getting fields from ES 7.0', () => {
        const data = {
            'genuine.es7._mapping.response': {
                mappings: {
                    properties: {
                        '@timestamp_millis': {
                            type: 'date',
                            format: 'epoch_millis',
                        },
                        classification_terms: {
                            type: 'keyword',
                        },
                        domains: {
                            type: 'keyword',
                        },
                        ip_address: {
                            type: 'ip',
                        },
                        justification_blob: {
                            properties: {
                                criterion: {
                                    type: 'text',
                                    fields: {
                                        keyword: {
                                            type: 'keyword',
                                            ignore_above: 256,
                                        },
                                    },
                                },
                                overall_vote_score: {
                                    type: 'float',
                                },
                                shallow: {
                                    properties: {
                                        jsi: {
                                            properties: {
                                                sdb: {
                                                    properties: {
                                                        dsel2: {
                                                            properties: {
                                                                'bootlegged-gille': {
                                                                    properties: {
                                                                        botness: {
                                                                            type: 'float',
                                                                        },
                                                                        general_algorithm_score: {
                                                                            type: 'float',
                                                                        },
                                                                    },
                                                                },
                                                                'uncombed-boris': {
                                                                    properties: {
                                                                        botness: {
                                                                            type: 'float',
                                                                        },
                                                                        general_algorithm_score: {
                                                                            type: 'float',
                                                                        },
                                                                    },
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        overall_vote_score: {
                            type: 'float',
                        },
                        ua_terms_long: {
                            type: 'keyword',
                        },
                        ua_terms_short: {
                            type: 'keyword',
                        },
                    },
                },
            },
        };
        const dateFields = ['@timestamp_millis'];
        const numberFields = [
            'justification_blob.overall_vote_score',
            'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.botness',
            'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.general_algorithm_score',
            'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.botness',
            'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.general_algorithm_score',
            'overall_vote_score',
        ];
        it('should return nested fields', () => __awaiter(void 0, void 0, void 0, function* () {
            const { ds } = getTestContext({
                data,
                database: 'genuine.es7._mapping.response',
            });
            yield expect(ds.getFields()).toEmitValuesWith((received) => {
                expect(received.length).toBe(1);
                const fieldObjects = received[0];
                const fields = map(fieldObjects, 'text');
                expect(fields).toEqual([
                    '@timestamp_millis',
                    'classification_terms',
                    'domains',
                    'ip_address',
                    'justification_blob.criterion.keyword',
                    'justification_blob.criterion',
                    'justification_blob.overall_vote_score',
                    'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.botness',
                    'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.general_algorithm_score',
                    'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.botness',
                    'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.general_algorithm_score',
                    'overall_vote_score',
                    'ua_terms_long',
                    'ua_terms_short',
                ]);
            });
        }));
        it('should return number fields', () => __awaiter(void 0, void 0, void 0, function* () {
            const { ds } = getTestContext({
                data,
                database: 'genuine.es7._mapping.response',
            });
            yield expect(ds.getFields(['number'])).toEmitValuesWith((received) => {
                expect(received.length).toBe(1);
                const fieldObjects = received[0];
                const fields = map(fieldObjects, 'text');
                expect(fields).toEqual(numberFields);
            });
        }));
        it('should return date fields', () => __awaiter(void 0, void 0, void 0, function* () {
            const { ds } = getTestContext({
                data,
                database: 'genuine.es7._mapping.response',
            });
            yield expect(ds.getFields(['date'])).toEmitValuesWith((received) => {
                expect(received.length).toBe(1);
                const fieldObjects = received[0];
                const fields = map(fieldObjects, 'text');
                expect(fields).toEqual(dateFields);
            });
        }));
    });
    describe('When issuing aggregation query on es5.x', () => {
        function runScenario() {
            return __awaiter(this, void 0, void 0, function* () {
                const range = createTimeRange(dateTime([2015, 4, 30, 10]), dateTime([2015, 5, 1, 10]));
                const targets = [
                    {
                        refId: 'A',
                        bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '2' }],
                        metrics: [{ type: 'count', id: '1' }],
                        query: 'test',
                    },
                ];
                const query = Object.assign(Object.assign({}, DATAQUERY_BASE), { range, targets });
                const data = { responses: [] };
                const { ds, fetchMock } = getTestContext({ data, database: 'test' });
                yield expect(ds.query(query)).toEmitValuesWith((received) => {
                    expect(received.length).toBe(1);
                    expect(received[0]).toEqual({ data: [] });
                });
                expect(fetchMock).toHaveBeenCalledTimes(1);
                const requestOptions = fetchMock.mock.calls[0][0];
                const parts = requestOptions.data.split('\n');
                const header = JSON.parse(parts[0]);
                const body = JSON.parse(parts[1]);
                return { body, header };
            });
        }
        it('should not set search type to count', () => __awaiter(void 0, void 0, void 0, function* () {
            const { header } = yield runScenario();
            expect(header.search_type).not.toEqual('count');
        }));
        it('should set size to 0', () => __awaiter(void 0, void 0, void 0, function* () {
            const { body } = yield runScenario();
            expect(body.size).toBe(0);
        }));
    });
    describe('When issuing metricFind query on es5.x', () => {
        function runScenario() {
            return __awaiter(this, void 0, void 0, function* () {
                const data = {
                    responses: [
                        {
                            aggregations: {
                                '1': {
                                    buckets: [
                                        { doc_count: 1, key: 'test' },
                                        {
                                            doc_count: 2,
                                            key: 'test2',
                                            key_as_string: 'test2_as_string',
                                        },
                                    ],
                                },
                            },
                        },
                    ],
                };
                const { ds, fetchMock } = getTestContext({ data, database: 'test' });
                const results = yield ds.metricFindQuery('{"find": "terms", "field": "test"}');
                expect(fetchMock).toHaveBeenCalledTimes(1);
                const requestOptions = fetchMock.mock.calls[0][0];
                const parts = requestOptions.data.split('\n');
                const header = JSON.parse(parts[0]);
                const body = JSON.parse(parts[1]);
                return { results, body, header };
            });
        }
        it('should get results', () => __awaiter(void 0, void 0, void 0, function* () {
            const { results } = yield runScenario();
            expect(results.length).toEqual(2);
        }));
        it('should use key or key_as_string', () => __awaiter(void 0, void 0, void 0, function* () {
            const { results } = yield runScenario();
            expect(results[0].text).toEqual('test');
            expect(results[1].text).toEqual('test2_as_string');
        }));
        it('should not set search type to count', () => __awaiter(void 0, void 0, void 0, function* () {
            const { header } = yield runScenario();
            expect(header.search_type).not.toEqual('count');
        }));
        it('should set size to 0', () => __awaiter(void 0, void 0, void 0, function* () {
            const { body } = yield runScenario();
            expect(body.size).toBe(0);
        }));
        it('should not set terms aggregation size to 0', () => __awaiter(void 0, void 0, void 0, function* () {
            const { body } = yield runScenario();
            expect(body['aggs']['1']['terms'].size).not.toBe(0);
        }));
    });
    describe('query', () => {
        it('should replace range as integer not string', () => __awaiter(void 0, void 0, void 0, function* () {
            const { ds } = getTestContext({ jsonData: { interval: 'Daily', timeField: '@time' } });
            const postMock = jest.fn((method, url, data, header) => of(createFetchResponse({ responses: [] })));
            ds.legacyQueryRunner['request'] = postMock;
            yield expect(ds.query(createElasticQuery())).toEmitValuesWith((received) => {
                expect(postMock).toHaveBeenCalledTimes(1);
                const query = postMock.mock.calls[0][2];
                expect(typeof JSON.parse(query.split('\n')[1]).query.bool.filter[0].range['@time'].gte).toBe('number');
            });
        }));
    });
    it('should correctly interpolate variables in query', () => {
        const { ds } = getTestContext();
        const query = {
            refId: 'A',
            bucketAggs: [{ type: 'filters', settings: { filters: [{ query: '$var', label: '' }] }, id: '1' }],
            metrics: [{ type: 'count', id: '1' }],
            query: '$var',
        };
        const interpolatedQuery = ds.interpolateVariablesInQueries([query], {})[0];
        expect(interpolatedQuery.query).toBe('resolvedVariable');
        expect(interpolatedQuery.bucketAggs[0].settings.filters[0].query).toBe('resolvedVariable');
    });
    it('should correctly add ad hoc filters when interpolating variables in query', () => {
        const templateSrvMock = {
            replace: (text) => text,
            getAdhocFilters: () => [{ key: 'bar', operator: '=', value: 'test' }],
        };
        const { ds } = getTestContext({ templateSrvMock });
        const query = {
            refId: 'A',
            bucketAggs: [{ type: 'filters', settings: { filters: [{ query: '$var', label: '' }] }, id: '1' }],
            metrics: [{ type: 'count', id: '1' }],
            query: 'foo:"bar"',
        };
        const interpolatedQuery = ds.interpolateVariablesInQueries([query], {})[0];
        expect(interpolatedQuery.query).toBe('foo:"bar" AND bar:"test"');
    });
    it('should correctly handle empty query strings in filters bucket aggregation', () => {
        const { ds } = getTestContext();
        const query = {
            refId: 'A',
            bucketAggs: [{ type: 'filters', settings: { filters: [{ query: '', label: '' }] }, id: '1' }],
            metrics: [{ type: 'count', id: '1' }],
            query: '',
        };
        const interpolatedQuery = ds.interpolateVariablesInQueries([query], {})[0];
        expect(interpolatedQuery.bucketAggs[0].settings.filters[0].query).toBe('*');
    });
    describe('getSupplementaryQuery', () => {
        let ds;
        beforeEach(() => {
            ds = getTestContext().ds;
        });
        it('does not return logs volume query for metric query', () => {
            expect(ds.getSupplementaryQuery({ type: SupplementaryQueryType.LogsVolume }, {
                refId: 'A',
                metrics: [{ type: 'count', id: '1' }],
                bucketAggs: [{ type: 'filters', settings: { filters: [{ query: 'foo', label: '' }] }, id: '1' }],
                query: 'foo="bar"',
            })).toEqual(undefined);
        });
        it('returns logs volume query for log query', () => {
            expect(ds.getSupplementaryQuery({ type: SupplementaryQueryType.LogsVolume }, {
                refId: 'A',
                metrics: [{ type: 'logs', id: '1' }],
                query: 'foo="bar"',
            })).toEqual({
                bucketAggs: [
                    {
                        field: '',
                        id: '3',
                        settings: {
                            interval: 'auto',
                            min_doc_count: '0',
                            trimEdges: '0',
                        },
                        type: 'date_histogram',
                    },
                ],
                metrics: [
                    {
                        id: '1',
                        type: 'count',
                    },
                ],
                query: 'foo="bar"',
                refId: 'log-volume-A',
                timeField: '',
            });
        });
        it('does not return logs samples for non time series queries', () => {
            expect(ds.getSupplementaryQuery({ type: SupplementaryQueryType.LogsSample, limit: 100 }, {
                refId: 'A',
                bucketAggs: [{ type: 'filters', id: '1' }],
                query: '',
            })).toEqual(undefined);
        });
        it('returns logs samples for time series queries', () => {
            expect(ds.getSupplementaryQuery({ type: SupplementaryQueryType.LogsSample, limit: 100 }, {
                refId: 'A',
                query: '',
                bucketAggs: [{ type: 'date_histogram', id: '1' }],
            })).toEqual({
                refId: `log-sample-A`,
                query: '',
                metrics: [{ type: 'logs', id: '1', settings: { limit: '100' } }],
            });
        });
    });
    describe('getDataProvider', () => {
        let ds;
        beforeEach(() => {
            ds = getTestContext().ds;
        });
        it('does not create a logs sample provider for non time series query', () => {
            const options = getQueryOptions({
                targets: [
                    {
                        refId: 'A',
                        metrics: [{ type: 'logs', id: '1', settings: { limit: '100' } }],
                    },
                ],
            });
            expect(ds.getDataProvider(SupplementaryQueryType.LogsSample, options)).not.toBeDefined();
        });
        it('does create a logs sample provider for time series query', () => {
            const options = getQueryOptions({
                targets: [
                    {
                        refId: 'A',
                        bucketAggs: [{ type: 'date_histogram', id: '1' }],
                    },
                ],
            });
            expect(ds.getDataProvider(SupplementaryQueryType.LogsSample, options)).toBeDefined();
        });
    });
    describe('getLogsSampleDataProvider', () => {
        let ds;
        beforeEach(() => {
            ds = getTestContext().ds;
        });
        it("doesn't return a logs sample provider given a non time series query", () => {
            const request = getQueryOptions({
                targets: [
                    {
                        refId: 'A',
                        metrics: [{ type: 'logs', id: '1', settings: { limit: '100' } }],
                    },
                ],
            });
            expect(ds.getLogsSampleDataProvider(request)).not.toBeDefined();
        });
        it('returns a logs sample provider given a time series query', () => {
            const request = getQueryOptions({
                targets: [
                    {
                        refId: 'A',
                        bucketAggs: [{ type: 'date_histogram', id: '1' }],
                    },
                ],
            });
            expect(ds.getLogsSampleDataProvider(request)).toBeDefined();
        });
    });
});
describe('getMultiSearchUrl', () => {
    it('Should add correct params to URL if "includeFrozen" is enabled', () => {
        const { ds } = getTestContext({ jsonData: { includeFrozen: true, xpack: true } });
        expect(ds.getMultiSearchUrl()).toMatch(/ignore_throttled=false/);
    });
    it('Should NOT add ignore_throttled if "includeFrozen" is disabled', () => {
        const { ds } = getTestContext({ jsonData: { includeFrozen: false, xpack: true } });
        expect(ds.getMultiSearchUrl()).not.toMatch(/ignore_throttled=false/);
    });
    it('Should NOT add ignore_throttled if "xpack" is disabled', () => {
        const { ds } = getTestContext({ jsonData: { includeFrozen: true, xpack: false } });
        expect(ds.getMultiSearchUrl()).not.toMatch(/ignore_throttled=false/);
    });
});
describe('enhanceDataFrame', () => {
    it('adds links to dataframe', () => {
        const df = new MutableDataFrame({
            fields: [
                {
                    name: 'urlField',
                    values: [],
                },
                {
                    name: 'traceField',
                    values: [],
                },
            ],
        });
        enhanceDataFrame(df, [
            {
                field: 'urlField',
                url: 'someUrl',
            },
            {
                field: 'urlField',
                url: 'someOtherUrl',
            },
            {
                field: 'traceField',
                url: 'query',
                datasourceUid: 'ds1',
            },
            {
                field: 'traceField',
                url: 'otherQuery',
                datasourceUid: 'ds2',
            },
        ]);
        expect(df.fields[0].config.links).toHaveLength(2);
        expect(df.fields[0].config.links).toContainEqual({
            title: '',
            url: 'someUrl',
        });
        expect(df.fields[0].config.links).toContainEqual({
            title: '',
            url: 'someOtherUrl',
        });
        expect(df.fields[1].config.links).toHaveLength(2);
        expect(df.fields[1].config.links).toContainEqual(expect.objectContaining({
            title: '',
            url: '',
            internal: expect.objectContaining({
                query: { query: 'query' },
                datasourceUid: 'ds1',
            }),
        }));
        expect(df.fields[1].config.links).toContainEqual(expect.objectContaining({
            title: '',
            url: '',
            internal: expect.objectContaining({
                query: { query: 'otherQuery' },
                datasourceUid: 'ds2',
            }),
        }));
    });
    it('adds limit to dataframe', () => {
        var _a;
        const df = new MutableDataFrame({
            fields: [
                {
                    name: 'someField',
                    values: [],
                },
            ],
        });
        enhanceDataFrame(df, [], 10);
        expect((_a = df.meta) === null || _a === void 0 ? void 0 : _a.limit).toBe(10);
    });
});
describe('modifyQuery', () => {
    let ds;
    beforeEach(() => {
        ds = getTestContext().ds;
    });
    describe('with empty query', () => {
        let query;
        beforeEach(() => {
            query = { query: '', refId: 'A' };
        });
        it('should add the filter', () => {
            expect(ds.modifyQuery(query, { type: 'ADD_FILTER', options: { key: 'foo', value: 'bar' } }).query).toBe('foo:"bar"');
        });
        it('should add the negative filter', () => {
            expect(ds.modifyQuery(query, { type: 'ADD_FILTER_OUT', options: { key: 'foo', value: 'bar' } }).query).toBe('-foo:"bar"');
        });
        it('should do nothing on unknown type', () => {
            expect(ds.modifyQuery(query, { type: 'unknown', options: { key: 'foo', value: 'bar' } }).query).toBe(query.query);
        });
    });
    describe('with non-empty query', () => {
        let query;
        beforeEach(() => {
            query = { query: 'test:"value"', refId: 'A' };
        });
        it('should add the filter', () => {
            expect(ds.modifyQuery(query, { type: 'ADD_FILTER', options: { key: 'foo', value: 'bar' } }).query).toBe('test:"value" AND foo:"bar"');
        });
        it('should add the negative filter', () => {
            expect(ds.modifyQuery(query, { type: 'ADD_FILTER_OUT', options: { key: 'foo', value: 'bar' } }).query).toBe('test:"value" AND -foo:"bar"');
        });
        it('should do nothing on unknown type', () => {
            expect(ds.modifyQuery(query, { type: 'unknown', options: { key: 'foo', value: 'bar' } }).query).toBe(query.query);
        });
    });
});
describe('toggleQueryFilter', () => {
    let ds;
    beforeEach(() => {
        ds = getTestContext().ds;
    });
    describe('with empty query', () => {
        let query;
        beforeEach(() => {
            query = { query: '', refId: 'A' };
        });
        it('should add the filter', () => {
            expect(ds.toggleQueryFilter(query, { type: 'FILTER_FOR', options: { key: 'foo', value: 'bar' } }).query).toBe('foo:"bar"');
        });
        it('should toggle the filter', () => {
            query.query = 'foo:"bar"';
            expect(ds.toggleQueryFilter(query, { type: 'FILTER_FOR', options: { key: 'foo', value: 'bar' } }).query).toBe('');
        });
        it('should add the negative filter', () => {
            expect(ds.toggleQueryFilter(query, { type: 'FILTER_OUT', options: { key: 'foo', value: 'bar' } }).query).toBe('-foo:"bar"');
        });
        it('should remove a positive filter to add a negative filter', () => {
            query.query = 'foo:"bar"';
            expect(ds.toggleQueryFilter(query, { type: 'FILTER_OUT', options: { key: 'foo', value: 'bar' } }).query).toBe('-foo:"bar"');
        });
    });
    describe('with non-empty query', () => {
        let query;
        beforeEach(() => {
            query = { query: 'test:"value"', refId: 'A' };
        });
        it('should add the filter', () => {
            expect(ds.toggleQueryFilter(query, { type: 'FILTER_FOR', options: { key: 'foo', value: 'bar' } }).query).toBe('test:"value" AND foo:"bar"');
        });
        it('should add the negative filter', () => {
            expect(ds.toggleQueryFilter(query, { type: 'FILTER_OUT', options: { key: 'foo', value: 'bar' } }).query).toBe('test:"value" AND -foo:"bar"');
        });
    });
});
describe('queryHasFilter()', () => {
    let ds;
    beforeEach(() => {
        ds = getTestContext().ds;
    });
    it('inspects queries for filter presence', () => {
        const query = { refId: 'A', query: 'grafana:"awesome"' };
        expect(ds.queryHasFilter(query, {
            key: 'grafana',
            value: 'awesome',
        })).toBe(true);
    });
});
describe('addAdhocFilters', () => {
    describe('with invalid filters', () => {
        it('should filter out ad hoc filter without key', () => {
            const { ds, templateSrv } = getTestContext();
            jest.mocked(templateSrv.getAdhocFilters).mockReturnValue([{ key: '', operator: '=', value: 'a', condition: '' }]);
            const query = ds.addAdHocFilters('foo:"bar"');
            expect(query).toBe('foo:"bar"');
        });
        it('should filter out ad hoc filter without value', () => {
            const { ds, templateSrv } = getTestContext();
            jest.mocked(templateSrv.getAdhocFilters).mockReturnValue([{ key: 'a', operator: '=', value: '', condition: '' }]);
            const query = ds.addAdHocFilters('foo:"bar"');
            expect(query).toBe('foo:"bar"');
        });
        it('should filter out filter ad hoc filter with invalid operator', () => {
            const { ds, templateSrv } = getTestContext();
            jest.mocked(templateSrv.getAdhocFilters).mockReturnValue([{ key: 'a', operator: 'A', value: '', condition: '' }]);
            const query = ds.addAdHocFilters('foo:"bar"');
            expect(query).toBe('foo:"bar"');
        });
    });
    describe('with 1 ad hoc filter', () => {
        let ds, templateSrvMock;
        beforeEach(() => {
            const { ds: datasource, templateSrv } = getTestContext();
            ds = datasource;
            templateSrvMock = templateSrv;
            jest
                .mocked(templateSrv.getAdhocFilters)
                .mockReturnValue([{ key: 'test', operator: '=', value: 'test1', condition: '' }]);
        });
        it('should correctly add 1 ad hoc filter when query is not empty', () => {
            const query = ds.addAdHocFilters('foo:"bar"');
            expect(query).toBe('foo:"bar" AND test:"test1"');
        });
        it('should correctly add 1 ad hoc filter when query is empty', () => {
            const query = ds.addAdHocFilters('');
            expect(query).toBe('test:"test1"');
        });
        it('should escape characters in filter keys', () => {
            jest
                .mocked(templateSrvMock.getAdhocFilters)
                .mockReturnValue([{ key: 'field:name', operator: '=', value: 'field:value', condition: '' }]);
            const query = ds.addAdHocFilters('');
            expect(query).toBe('field\\:name:"field:value"');
        });
        it('should escape characters in filter values', () => {
            jest
                .mocked(templateSrvMock.getAdhocFilters)
                .mockReturnValue([{ key: 'field:name', operator: '=', value: 'field "value"', condition: '' }]);
            const query = ds.addAdHocFilters('');
            expect(query).toBe('field\\:name:"field \\"value\\""');
        });
    });
    describe('with multiple ad hoc filters', () => {
        let ds;
        beforeEach(() => {
            const { ds: datasource, templateSrv } = getTestContext();
            ds = datasource;
            jest.mocked(templateSrv.getAdhocFilters).mockReturnValue([
                { key: 'bar', operator: '=', value: 'baz', condition: '' },
                { key: 'job', operator: '!=', value: 'grafana', condition: '' },
                { key: 'service', operator: '=~', value: 'service', condition: '' },
                { key: 'count', operator: '>', value: '1', condition: '' },
            ]);
        });
        it('should correctly add ad hoc filters when query is not empty', () => {
            const query = ds.addAdHocFilters('foo:"bar" AND test:"test1"');
            expect(query).toBe('foo:"bar" AND test:"test1" AND bar:"baz" AND -job:"grafana" AND service:/service/ AND count:>1');
        });
        it('should correctly add ad hoc filters when query is  empty', () => {
            const query = ds.addAdHocFilters('');
            expect(query).toBe('bar:"baz" AND -job:"grafana" AND service:/service/ AND count:>1');
        });
    });
});
const createElasticQuery = () => {
    return {
        requestId: '',
        interval: '',
        panelId: 0,
        intervalMs: 1,
        scopedVars: {},
        timezone: '',
        app: CoreApp.Dashboard,
        startTime: 0,
        range: {
            from: dateTime([2015, 4, 30, 10]),
            to: dateTime([2015, 5, 1, 10]),
            raw: {
                from: '',
                to: '',
            },
        },
        targets: [
            {
                refId: '',
                bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '2' }],
                metrics: [{ type: 'count', id: '' }],
                query: 'test',
            },
        ],
    };
};
const logsResponse = {
    data: {
        responses: [
            {
                aggregations: {
                    '2': {
                        buckets: [
                            {
                                doc_count: 10,
                                key: 1000,
                            },
                            {
                                doc_count: 15,
                                key: 2000,
                            },
                        ],
                    },
                },
                hits: {
                    hits: [
                        {
                            '@timestamp': ['2019-06-24T09:51:19.765Z'],
                            _id: 'fdsfs',
                            _type: '_doc',
                            _index: 'mock-index',
                            _source: {
                                '@timestamp': '2019-06-24T09:51:19.765Z',
                                host: 'djisaodjsoad',
                                message: 'hello, i am a message',
                            },
                            fields: {
                                '@timestamp': ['2019-06-24T09:51:19.765Z'],
                            },
                        },
                        {
                            '@timestamp': ['2019-06-24T09:52:19.765Z'],
                            _id: 'kdospaidopa',
                            _type: '_doc',
                            _index: 'mock-index',
                            _source: {
                                '@timestamp': '2019-06-24T09:52:19.765Z',
                                host: 'dsalkdakdop',
                                message: 'hello, i am also message',
                            },
                            fields: {
                                '@timestamp': ['2019-06-24T09:52:19.765Z'],
                            },
                        },
                    ],
                },
            },
        ],
    },
};
describe('targetContainsTemplate', () => {
    let ds;
    let target;
    beforeEach(() => {
        const context = getTestContext();
        ds = context.ds;
        target = {
            refId: 'test',
            bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '1' }],
            metrics: [{ type: 'count', id: '1' }],
            query: 'escape\\:test',
        };
    });
    it('returns false when there is no variable in the query', () => {
        expect(ds.targetContainsTemplate(target)).toBe(false);
    });
    it('returns true when there are variables in the query alias', () => {
        target.alias = '$variable';
        expect(ds.targetContainsTemplate(target)).toBe(true);
    });
    it('returns true when there are variables in the query', () => {
        target.query = '$variable:something';
        expect(ds.targetContainsTemplate(target)).toBe(true);
    });
    it('returns true when there are variables in the bucket aggregation', () => {
        target.bucketAggs = [{ type: 'date_histogram', field: '$field', id: '1' }];
        expect(ds.targetContainsTemplate(target)).toBe(true);
        target.bucketAggs = [{ type: 'date_histogram', field: '@timestamp', id: '1', settings: { interval: '$interval' } }];
        expect(ds.targetContainsTemplate(target)).toBe(true);
    });
    it('returns true when there are variables in the metric aggregation', () => {
        target.metrics = [{ type: 'moving_avg', id: '1', settings: { window: '$window' } }];
        expect(ds.targetContainsTemplate(target)).toBe(true);
        target.metrics = [{ type: 'moving_avg', id: '1', field: '$field' }];
        expect(ds.targetContainsTemplate(target)).toBe(true);
        target.metrics = [{ type: 'extended_stats', id: '1', meta: { something: '$something' } }];
        expect(ds.targetContainsTemplate(target)).toBe(true);
    });
    it('returns true when there are variables in an array inside an object in metrics', () => {
        target.metrics = [
            {
                field: 'counter',
                id: '1',
                settings: { percents: ['20', '40', '$qqq'] },
                type: 'percentiles',
            },
        ];
        expect(ds.targetContainsTemplate(target)).toBe(true);
    });
});
describe('ElasticDatasource using backend', () => {
    beforeEach(() => {
        console.error = jest.fn();
        config.featureToggles.enableElasticsearchBackendQuerying = true;
    });
    afterEach(() => {
        console.error = originalConsoleError;
        config.featureToggles.enableElasticsearchBackendQuerying = false;
    });
    describe('annotationQuery', () => {
        describe('results processing', () => {
            it('should return simple annotations using defaults', () => __awaiter(void 0, void 0, void 0, function* () {
                const { ds, timeSrv } = getTestContext();
                ds.postResourceRequest = jest.fn().mockResolvedValue({
                    responses: [
                        {
                            hits: {
                                hits: [
                                    { _source: { '@timestamp': 1, '@test_tags': 'foo', text: 'abc' } },
                                    { _source: { '@timestamp': 3, '@test_tags': 'bar', text: 'def' } },
                                ],
                            },
                        },
                    ],
                });
                const annotations = yield ds.annotationQuery({
                    annotation: {},
                    range: timeSrv.timeRange(),
                });
                expect(annotations).toHaveLength(2);
                expect(annotations[0].time).toBe(1);
                expect(annotations[1].time).toBe(3);
            }));
            it('should return annotation events using options', () => __awaiter(void 0, void 0, void 0, function* () {
                var _a, _b;
                const { ds, timeSrv } = getTestContext();
                ds.postResourceRequest = jest.fn().mockResolvedValue({
                    responses: [
                        {
                            hits: {
                                hits: [
                                    { _source: { '@test_time': 1, '@test_tags': 'foo', text: 'abc' } },
                                    { _source: { '@test_time': 3, '@test_tags': 'bar', text: 'def' } },
                                ],
                            },
                        },
                    ],
                });
                const annotations = yield ds.annotationQuery({
                    annotation: {
                        timeField: '@test_time',
                        name: 'foo',
                        query: 'abc',
                        tagsField: '@test_tags',
                        textField: 'text',
                    },
                    range: timeSrv.timeRange(),
                });
                expect(annotations).toHaveLength(2);
                expect(annotations[0].time).toBe(1);
                expect((_a = annotations[0].tags) === null || _a === void 0 ? void 0 : _a[0]).toBe('foo');
                expect(annotations[0].text).toBe('abc');
                expect(annotations[1].time).toBe(3);
                expect((_b = annotations[1].tags) === null || _b === void 0 ? void 0 : _b[0]).toBe('bar');
                expect(annotations[1].text).toBe('def');
            }));
        });
        describe('request processing', () => {
            it('should process annotation request using options', () => __awaiter(void 0, void 0, void 0, function* () {
                const { ds } = getTestContext();
                const postResourceRequestMock = jest.spyOn(ds, 'postResourceRequest').mockResolvedValue({
                    responses: [
                        {
                            hits: {
                                hits: [
                                    { _source: { '@test_time': 1, '@test_tags': 'foo', text: 'abc' } },
                                    { _source: { '@test_time': 3, '@test_tags': 'bar', text: 'def' } },
                                ],
                            },
                        },
                    ],
                });
                yield ds.annotationQuery({
                    annotation: {
                        timeField: '@test_time',
                        timeEndField: '@time_end_field',
                        name: 'foo',
                        query: 'abc',
                        tagsField: '@test_tags',
                        textField: 'text',
                    },
                    range: {
                        from: dateTime(1683291160012),
                        to: dateTime(1683291460012),
                    },
                });
                expect(postResourceRequestMock).toHaveBeenCalledWith('_msearch', '{"search_type":"query_then_fetch","ignore_unavailable":true,"index":"[test-]YYYY.MM.DD"}\n{"query":{"bool":{"filter":[{"bool":{"should":[{"range":{"@test_time":{"from":1683291160012,"to":1683291460012,"format":"epoch_millis"}}},{"range":{"@time_end_field":{"from":1683291160012,"to":1683291460012,"format":"epoch_millis"}}}],"minimum_should_match":1}},{"query_string":{"query":"abc"}}]}},"size":10000}\n');
            }));
            it('should process annotation request using defaults', () => __awaiter(void 0, void 0, void 0, function* () {
                const { ds } = getTestContext();
                const postResourceRequestMock = jest.spyOn(ds, 'postResourceRequest').mockResolvedValue({
                    responses: [
                        {
                            hits: {
                                hits: [
                                    { _source: { '@test_time': 1, '@test_tags': 'foo', text: 'abc' } },
                                    { _source: { '@test_time': 3, '@test_tags': 'bar', text: 'def' } },
                                ],
                            },
                        },
                    ],
                });
                yield ds.annotationQuery({
                    annotation: {},
                    range: {
                        from: dateTime(1683291160012),
                        to: dateTime(1683291460012),
                    },
                });
                expect(postResourceRequestMock).toHaveBeenCalledWith('_msearch', '{"search_type":"query_then_fetch","ignore_unavailable":true,"index":"[test-]YYYY.MM.DD"}\n{"query":{"bool":{"filter":[{"bool":{"should":[{"range":{"@timestamp":{"from":1683291160012,"to":1683291460012,"format":"epoch_millis"}}}],"minimum_should_match":1}}]}},"size":10000}\n');
            }));
        });
    });
    describe('getDatabaseVersion', () => {
        it('should correctly get db version', () => __awaiter(void 0, void 0, void 0, function* () {
            const { ds } = getTestContext();
            ds.getResource = jest.fn().mockResolvedValue({ version: { number: '8.0.0' } });
            const version = yield ds.getDatabaseVersion();
            expect(version === null || version === void 0 ? void 0 : version.raw).toBe('8.0.0');
        }));
        it('should correctly return null if invalid numeric version', () => __awaiter(void 0, void 0, void 0, function* () {
            const { ds } = getTestContext();
            ds.getResource = jest.fn().mockResolvedValue({ version: { number: 8 } });
            const version = yield ds.getDatabaseVersion();
            expect(version).toBe(null);
        }));
        it('should correctly return null if rejected request', () => __awaiter(void 0, void 0, void 0, function* () {
            const { ds } = getTestContext();
            ds.getResource = jest.fn().mockRejectedValue({});
            const version = yield ds.getDatabaseVersion();
            expect(version).toBe(null);
        }));
    });
    describe('metricFindQuery', () => {
        function runScenario() {
            return __awaiter(this, void 0, void 0, function* () {
                const data = {
                    responses: [
                        {
                            aggregations: {
                                '1': {
                                    buckets: [
                                        { doc_count: 1, key: 'test' },
                                        {
                                            doc_count: 2,
                                            key: 'test2',
                                            key_as_string: 'test2_as_string',
                                        },
                                    ],
                                },
                            },
                        },
                    ],
                };
                const { ds } = getTestContext();
                const postResourceMock = jest.spyOn(ds, 'postResource');
                postResourceMock.mockResolvedValue(data);
                const results = yield ds.metricFindQuery('{"find": "terms", "field": "test"}');
                expect(ds.postResource).toHaveBeenCalledTimes(1);
                const requestOptions = postResourceMock.mock.calls[0][1];
                const parts = requestOptions.split('\n');
                const header = JSON.parse(parts[0]);
                const body = JSON.parse(parts[1]);
                return { results, body, header };
            });
        }
        it('should get results', () => __awaiter(void 0, void 0, void 0, function* () {
            const { results } = yield runScenario();
            expect(results.length).toEqual(2);
        }));
        it('should use key or key_as_string', () => __awaiter(void 0, void 0, void 0, function* () {
            const { results } = yield runScenario();
            expect(results[0].text).toEqual('test');
            expect(results[1].text).toEqual('test2_as_string');
        }));
        it('should not set search type to count', () => __awaiter(void 0, void 0, void 0, function* () {
            const { header } = yield runScenario();
            expect(header.search_type).not.toEqual('count');
        }));
        it('should set size to 0', () => __awaiter(void 0, void 0, void 0, function* () {
            const { body } = yield runScenario();
            expect(body.size).toBe(0);
        }));
        it('should not set terms aggregation size to 0', () => __awaiter(void 0, void 0, void 0, function* () {
            const { body } = yield runScenario();
            expect(body['aggs']['1']['terms'].size).not.toBe(0);
        }));
    });
    describe('getFields', () => {
        const getFieldsMockData = {
            '[test-]YYYY.MM.DD': {
                mappings: {
                    properties: {
                        '@timestamp_millis': {
                            type: 'date',
                            format: 'epoch_millis',
                        },
                        classification_terms: {
                            type: 'keyword',
                        },
                        ip_address: {
                            type: 'ip',
                        },
                        justification_blob: {
                            properties: {
                                criterion: {
                                    type: 'text',
                                    fields: {
                                        keyword: {
                                            type: 'keyword',
                                            ignore_above: 256,
                                        },
                                    },
                                },
                                shallow: {
                                    properties: {
                                        jsi: {
                                            properties: {
                                                sdb: {
                                                    properties: {
                                                        dsel2: {
                                                            properties: {
                                                                'bootlegged-gille': {
                                                                    properties: {
                                                                        botness: {
                                                                            type: 'float',
                                                                        },
                                                                        general_algorithm_score: {
                                                                            type: 'float',
                                                                        },
                                                                    },
                                                                },
                                                                'uncombed-boris': {
                                                                    properties: {
                                                                        botness: {
                                                                            type: 'float',
                                                                        },
                                                                        general_algorithm_score: {
                                                                            type: 'float',
                                                                        },
                                                                    },
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        overall_vote_score: {
                            type: 'float',
                        },
                    },
                },
            },
        };
        it('should not retry when ES is down', () => __awaiter(void 0, void 0, void 0, function* () {
            const twoDaysBefore = toUtc().subtract(2, 'day').format('YYYY.MM.DD');
            const { ds, timeSrv } = getTestContext({
                from: 'now-2w',
                jsonData: { interval: 'Daily' },
            });
            ds.getResource = jest.fn().mockImplementation((options) => {
                if (options.url === `test-${twoDaysBefore}/_mapping`) {
                    return of({
                        data: {},
                    });
                }
                return throwError({ status: 500 });
            });
            const range = timeSrv.timeRange();
            yield expect(ds.getFields(undefined, range)).toEmitValuesWith((received) => {
                expect(received.length).toBe(1);
                expect(received[0]).toStrictEqual({ status: 500 });
                expect(ds.getResource).toBeCalledTimes(1);
            });
        }));
        it('should not retry more than 7 indices', () => __awaiter(void 0, void 0, void 0, function* () {
            const { ds, timeSrv } = getTestContext({
                from: 'now-2w',
                jsonData: { interval: 'Daily' },
            });
            const range = timeSrv.timeRange();
            ds.getResource = jest.fn().mockImplementation(() => {
                return throwError({ status: 404 });
            });
            yield expect(ds.getFields(undefined, range)).toEmitValuesWith((received) => {
                expect(received.length).toBe(1);
                expect(received[0]).toStrictEqual('Could not find an available index for this time range.');
                expect(ds.getResource).toBeCalledTimes(7);
            });
        }));
        it('should return nested fields', () => __awaiter(void 0, void 0, void 0, function* () {
            const { ds } = getTestContext({
                from: 'now-2w',
                jsonData: { interval: 'Daily' },
            });
            ds.getResource = jest.fn().mockResolvedValue(getFieldsMockData);
            yield expect(ds.getFields()).toEmitValuesWith((received) => {
                expect(received.length).toBe(1);
                const fieldObjects = received[0];
                const fields = map(fieldObjects, 'text');
                expect(fields).toEqual([
                    '@timestamp_millis',
                    'classification_terms',
                    'ip_address',
                    'justification_blob.criterion.keyword',
                    'justification_blob.criterion',
                    'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.botness',
                    'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.general_algorithm_score',
                    'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.botness',
                    'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.general_algorithm_score',
                    'overall_vote_score',
                ]);
            });
        }));
        it('should return number fields', () => __awaiter(void 0, void 0, void 0, function* () {
            const { ds } = getTestContext({});
            ds.getResource = jest.fn().mockResolvedValue(getFieldsMockData);
            yield expect(ds.getFields(['number'])).toEmitValuesWith((received) => {
                expect(received.length).toBe(1);
                const fieldObjects = received[0];
                const fields = map(fieldObjects, 'text');
                expect(fields).toEqual([
                    'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.botness',
                    'justification_blob.shallow.jsi.sdb.dsel2.bootlegged-gille.general_algorithm_score',
                    'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.botness',
                    'justification_blob.shallow.jsi.sdb.dsel2.uncombed-boris.general_algorithm_score',
                    'overall_vote_score',
                ]);
            });
        }));
        it('should return date fields', () => __awaiter(void 0, void 0, void 0, function* () {
            const { ds } = getTestContext({});
            ds.getResource = jest.fn().mockResolvedValue(getFieldsMockData);
            yield expect(ds.getFields(['date'])).toEmitValuesWith((received) => {
                expect(received.length).toBe(1);
                const fieldObjects = received[0];
                const fields = map(fieldObjects, 'text');
                expect(fields).toEqual(['@timestamp_millis']);
            });
        }));
    });
});
//# sourceMappingURL=datasource.test.js.map