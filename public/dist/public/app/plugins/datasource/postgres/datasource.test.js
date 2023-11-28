import { __awaiter } from "tslib";
import { of } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { getDefaultTimeRange, dataFrameToJSON, dateTime, FieldType, LoadingState, createDataFrame, } from '@grafana/data';
import { getBackendSrv, setBackendSrv, getDataSourceSrv, setDataSourceSrv, } from '@grafana/runtime';
import { QueryFormat } from 'app/features/plugins/sql/types';
import { makeVariable } from 'app/features/plugins/sql/utils/testHelpers';
import { PostgresDatasource } from './datasource';
const backendSrv = {
    // this will get mocked below, it only needs to exist
    fetch: () => undefined,
}; // we cast it so that we do not have to implement all the methods
// we type this as `any` to not have to define the whole type
const fakeDataSourceSrv = {
    getInstanceSettings: () => ({ id: 8674 }),
};
let origBackendSrv;
let origDataSourceSrv;
beforeAll(() => {
    origBackendSrv = getBackendSrv();
    origDataSourceSrv = getDataSourceSrv();
    setBackendSrv(backendSrv);
    setDataSourceSrv(fakeDataSourceSrv);
});
afterAll(() => {
    setBackendSrv(origBackendSrv);
    setDataSourceSrv(origDataSourceSrv);
});
describe('PostgreSQLDatasource', () => {
    const defaultRange = getDefaultTimeRange(); // it does not matter what value this has
    const fetchMock = jest.spyOn(backendSrv, 'fetch');
    const setupTestContext = (data, mock, templateSrv) => {
        jest.clearAllMocks();
        const defaultMock = () => mock !== null && mock !== void 0 ? mock : of(createFetchResponse(data));
        fetchMock.mockImplementation(defaultMock);
        const instanceSettings = {
            jsonData: {
                defaultProject: 'testproject',
            },
        };
        const variable = makeVariable('id1', 'name1');
        const ds = new PostgresDatasource(instanceSettings);
        if (templateSrv !== undefined) {
            Reflect.set(ds, 'templateSrv', templateSrv);
        }
        return { ds, variable };
    };
    // https://rxjs-dev.firebaseapp.com/guide/testing/marble-testing
    const runMarbleTest = (args) => {
        const { expectedValues, expectedMarble, options, values, marble } = args;
        const scheduler = new TestScheduler((actual, expected) => {
            expect(actual).toEqual(expected);
        });
        const { ds } = setupTestContext({});
        scheduler.run(({ cold, expectObservable }) => {
            const source = cold(marble, values);
            jest.clearAllMocks();
            fetchMock.mockImplementation(() => source);
            const result = ds.query(options);
            expectObservable(result).toBe(expectedMarble, expectedValues);
        });
    };
    const simpleTemplateSrv = {
        replace: (text) => text,
    };
    describe('When performing a time series query', () => {
        it('should transform response correctly', () => {
            const options = {
                range: {
                    from: dateTime(1432288354),
                    to: dateTime(1432288401),
                    raw: {
                        from: 'now-24h',
                        to: 'now',
                    },
                },
                targets: [
                    {
                        format: QueryFormat.Timeseries,
                        rawQuery: true,
                        rawSql: 'select time, metric from grafana_metric',
                        refId: 'A',
                        datasource: { type: 'gdev-ds', uid: 'gdev-ds' },
                    },
                ],
                requestId: 'test',
                interval: '1m',
                intervalMs: 60000,
                scopedVars: {},
                timezone: 'Etc/UTC',
                app: 'Grafana',
                startTime: 1432288354,
            };
            const response = {
                results: {
                    A: {
                        refId: 'A',
                        frames: [
                            dataFrameToJSON(createDataFrame({
                                fields: [
                                    { name: 'time', values: [1599643351085] },
                                    { name: 'metric', values: [30.226249741223704], labels: { metric: 'America' } },
                                ],
                                meta: {
                                    executedQueryString: 'select time, metric from grafana_metric',
                                },
                            })),
                        ],
                    },
                },
            };
            const values = { a: createFetchResponse(response) };
            const marble = '-a|';
            const expectedMarble = '-a|';
            const expectedValues = {
                a: {
                    data: [
                        {
                            fields: [
                                {
                                    config: {},
                                    entities: {},
                                    name: 'time',
                                    type: 'time',
                                    values: [1599643351085],
                                },
                                {
                                    config: {},
                                    entities: {},
                                    labels: {
                                        metric: 'America',
                                    },
                                    name: 'metric',
                                    type: 'number',
                                    values: [30.226249741223704],
                                },
                            ],
                            length: 1,
                            meta: {
                                executedQueryString: 'select time, metric from grafana_metric',
                            },
                            name: undefined,
                            refId: 'A',
                        },
                    ],
                    state: LoadingState.Done,
                },
            };
            runMarbleTest({ options, marble, values, expectedMarble, expectedValues });
        });
    });
    describe('When performing a table query', () => {
        it('should transform response correctly', () => {
            const options = {
                range: {
                    from: dateTime(1432288354),
                    to: dateTime(1432288401),
                    raw: {
                        from: 'now-24h',
                        to: 'now',
                    },
                },
                targets: [
                    {
                        format: QueryFormat.Table,
                        rawQuery: true,
                        rawSql: 'select time, metric, value from grafana_metric',
                        refId: 'A',
                        datasource: { type: 'gdev-ds', uid: 'gdev-ds' },
                    },
                ],
                requestId: 'test',
                interval: '1m',
                intervalMs: 60000,
                scopedVars: {},
                timezone: 'Etc/UTC',
                app: 'Grafana',
                startTime: 1432288354,
            };
            const response = {
                results: {
                    A: {
                        refId: 'A',
                        frames: [
                            dataFrameToJSON(createDataFrame({
                                fields: [
                                    { name: 'time', values: [1599643351085] },
                                    { name: 'metric', values: ['America'] },
                                    { name: 'value', values: [30.226249741223704] },
                                ],
                                meta: {
                                    executedQueryString: 'select time, metric, value from grafana_metric',
                                },
                            })),
                        ],
                    },
                },
            };
            const values = { a: createFetchResponse(response) };
            const marble = '-a|';
            const expectedMarble = '-a|';
            const expectedValues = {
                a: {
                    data: [
                        {
                            fields: [
                                {
                                    config: {},
                                    entities: {},
                                    name: 'time',
                                    type: 'time',
                                    values: [1599643351085],
                                },
                                {
                                    config: {},
                                    entities: {},
                                    name: 'metric',
                                    type: 'string',
                                    values: ['America'],
                                },
                                {
                                    config: {},
                                    entities: {},
                                    name: 'value',
                                    type: 'number',
                                    values: [30.226249741223704],
                                },
                            ],
                            length: 1,
                            meta: {
                                executedQueryString: 'select time, metric, value from grafana_metric',
                            },
                            name: undefined,
                            refId: 'A',
                        },
                    ],
                    state: LoadingState.Done,
                },
            };
            runMarbleTest({ options, marble, values, expectedMarble, expectedValues });
        });
    });
    describe('When performing a query with hidden target', () => {
        it('should return empty result and backendSrv.fetch should not be called', () => __awaiter(void 0, void 0, void 0, function* () {
            const options = {
                range: {
                    from: dateTime(1432288354),
                    to: dateTime(1432288401),
                },
                targets: [
                    {
                        format: 'table',
                        rawQuery: true,
                        rawSql: 'select time, metric, value from grafana_metric',
                        refId: 'A',
                        datasource: 'gdev-ds',
                        hide: true,
                    },
                ],
            };
            const { ds } = setupTestContext({});
            yield expect(ds.query(options)).toEmitValuesWith((received) => {
                expect(received[0]).toEqual({ data: [] });
                expect(fetchMock).not.toHaveBeenCalled();
            });
        }));
    });
    describe('When runSql returns an empty dataframe', () => {
        const response = {
            results: {
                tempvar: {
                    refId: 'tempvar',
                    frames: [],
                },
            },
        };
        it('should return an empty array when metricFindQuery is called', () => __awaiter(void 0, void 0, void 0, function* () {
            const ds = setupTestContext(response, undefined, simpleTemplateSrv).ds;
            const query = 'select * from atable';
            const results = yield ds.metricFindQuery(query, { range: defaultRange });
            expect(results.length).toBe(0);
        }));
        it('should return an empty array when fetchTables is called', () => __awaiter(void 0, void 0, void 0, function* () {
            const ds = setupTestContext(response).ds;
            const results = yield ds.fetchTables();
            expect(results.length).toBe(0);
        }));
        it('should return empty string when getVersion is called', () => __awaiter(void 0, void 0, void 0, function* () {
            const ds = setupTestContext(response).ds;
            const results = yield ds.getVersion();
            expect(results).toBe('');
        }));
        it('should return undefined when getTimescaleDBVersion is called', () => __awaiter(void 0, void 0, void 0, function* () {
            const ds = setupTestContext(response).ds;
            const results = yield ds.getTimescaleDBVersion();
            expect(results).toBe(undefined);
        }));
        it('should return an empty array when fetchFields is called', () => __awaiter(void 0, void 0, void 0, function* () {
            const ds = setupTestContext(response).ds;
            const query = {
                refId: 'refId',
                table: 'schema.table',
                dataset: 'dataset',
            };
            const results = yield ds.fetchFields(query);
            expect(results.length).toBe(0);
        }));
    });
    describe('When runSql returns a populated dataframe', () => {
        it('should return a list of tables when fetchTables is called', () => __awaiter(void 0, void 0, void 0, function* () {
            const fetchTableResponse = {
                results: {
                    tables: {
                        refId: 'tables',
                        frames: [
                            dataFrameToJSON(createDataFrame({
                                fields: [{ name: 'table', type: FieldType.string, values: ['test1', 'test2', 'test3'] }],
                            })),
                        ],
                    },
                },
            };
            const { ds } = setupTestContext(fetchTableResponse);
            const results = yield ds.fetchTables();
            expect(results.length).toBe(3);
            expect(results).toEqual(['test1', 'test2', 'test3']);
        }));
        it('should return a version string when getVersion is called', () => __awaiter(void 0, void 0, void 0, function* () {
            const fetchVersionResponse = {
                results: {
                    meta: {
                        refId: 'meta',
                        frames: [
                            dataFrameToJSON(createDataFrame({
                                fields: [{ name: 'version', type: FieldType.string, values: ['test1'] }],
                            })),
                        ],
                    },
                },
            };
            const { ds } = setupTestContext(fetchVersionResponse);
            const version = yield ds.getVersion();
            expect(version).toBe('test1');
        }));
        it('should return a version string when getTimescaleDBVersion is called', () => __awaiter(void 0, void 0, void 0, function* () {
            const fetchVersionResponse = {
                results: {
                    meta: {
                        refId: 'meta',
                        frames: [
                            dataFrameToJSON(createDataFrame({
                                fields: [{ name: 'extversion', type: FieldType.string, values: ['test1'] }],
                            })),
                        ],
                    },
                },
            };
            const { ds } = setupTestContext(fetchVersionResponse);
            const version = yield ds.getTimescaleDBVersion();
            expect(version).toBe('test1');
        }));
        it('should return a list of fields when fetchFields is called', () => __awaiter(void 0, void 0, void 0, function* () {
            const fetchFieldsResponse = {
                results: {
                    columns: {
                        refId: 'columns',
                        frames: [
                            dataFrameToJSON(createDataFrame({
                                fields: [
                                    { name: 'column', type: FieldType.string, values: ['test1', 'test2', 'test3'] },
                                    { name: 'type', type: FieldType.string, values: ['int', 'char', 'bool'] },
                                ],
                            })),
                        ],
                    },
                },
            };
            const { ds } = setupTestContext(fetchFieldsResponse);
            const sqlQuery = {
                refId: 'fields',
                table: 'table',
                dataset: 'dataset',
            };
            const results = yield ds.fetchFields(sqlQuery);
            expect(results.length).toBe(3);
            expect(results[0].label).toBe('test1');
            expect(results[0].value).toBe('test1');
            expect(results[0].type).toBe('int');
            expect(results[1].label).toBe('test2');
            expect(results[1].value).toBe('test2');
            expect(results[1].type).toBe('char');
            expect(results[2].label).toBe('test3');
            expect(results[2].value).toBe('test3');
            expect(results[2].type).toBe('bool');
        }));
    });
    describe('When performing metricFindQuery that returns multiple string fields', () => {
        it('should return list of all string field values', () => __awaiter(void 0, void 0, void 0, function* () {
            const query = 'select * from atable';
            const response = {
                results: {
                    tempvar: {
                        refId: 'tempvar',
                        frames: [
                            dataFrameToJSON(createDataFrame({
                                fields: [
                                    { name: 'title', values: ['aTitle', 'aTitle2', 'aTitle3'] },
                                    { name: 'text', values: ['some text', 'some text2', 'some text3'] },
                                ],
                                meta: {
                                    executedQueryString: 'select * from atable',
                                },
                            })),
                        ],
                    },
                },
            };
            const { ds } = setupTestContext(response, undefined, simpleTemplateSrv);
            const results = yield ds.metricFindQuery(query, { range: defaultRange });
            expect(results.length).toBe(6);
            expect(results[0].text).toBe('aTitle');
            expect(results[5].text).toBe('some text3');
        }));
    });
    describe('When performing metricFindQuery with $__searchFilter and a searchFilter is given', () => {
        it('should return list of all column values', () => __awaiter(void 0, void 0, void 0, function* () {
            const query = "select title from atable where title LIKE '$__searchFilter'";
            const response = {
                results: {
                    tempvar: {
                        refId: 'tempvar',
                        frames: [
                            dataFrameToJSON(createDataFrame({
                                fields: [
                                    { name: 'title', values: ['aTitle', 'aTitle2', 'aTitle3'] },
                                    { name: 'text', values: ['some text', 'some text2', 'some text3'] },
                                ],
                                meta: {
                                    executedQueryString: 'select * from atable',
                                },
                            })),
                        ],
                    },
                },
            };
            const templateSrv = {
                replace: (text, scopedVars) => {
                    expect(text).toBe("select title from atable where title LIKE '$__searchFilter'");
                    expect(scopedVars).toStrictEqual({
                        __searchFilter: {
                            value: 'aTit%',
                            text: '',
                        },
                    });
                    return "select title from atable where title LIKE 'aTit%'";
                },
            };
            const { ds } = setupTestContext(response, undefined, templateSrv);
            const results = yield ds.metricFindQuery(query, { range: defaultRange, searchFilter: 'aTit' });
            expect(fetchMock).toBeCalledTimes(1);
            expect(fetchMock.mock.calls[0][0].data.queries[0].rawSql).toBe("select title from atable where title LIKE 'aTit%'");
            expect(results).toEqual([
                { text: 'aTitle' },
                { text: 'aTitle2' },
                { text: 'aTitle3' },
                { text: 'some text' },
                { text: 'some text2' },
                { text: 'some text3' },
            ]);
        }));
    });
    describe('When performing metricFindQuery with $__searchFilter but no searchFilter is given', () => {
        it('should return list of all column values', () => __awaiter(void 0, void 0, void 0, function* () {
            const query = "select title from atable where title LIKE '$__searchFilter'";
            const response = {
                results: {
                    tempvar: {
                        refId: 'tempvar',
                        frames: [
                            dataFrameToJSON(createDataFrame({
                                fields: [
                                    { name: 'title', values: ['aTitle', 'aTitle2', 'aTitle3'] },
                                    { name: 'text', values: ['some text', 'some text2', 'some text3'] },
                                ],
                                meta: {
                                    executedQueryString: 'select * from atable',
                                },
                            })),
                        ],
                    },
                },
            };
            const templateSrv = {
                replace: (text, scopedVars) => {
                    expect(text).toBe("select title from atable where title LIKE '$__searchFilter'");
                    expect(scopedVars).toStrictEqual({
                        __searchFilter: {
                            value: '%',
                            text: '',
                        },
                    });
                    return "select title from atable where title LIKE '%'";
                },
            };
            const { ds } = setupTestContext(response, undefined, templateSrv);
            const results = yield ds.metricFindQuery(query, { range: defaultRange });
            expect(fetchMock).toBeCalledTimes(1);
            expect(fetchMock.mock.calls[0][0].data.queries[0].rawSql).toBe("select title from atable where title LIKE '%'");
            expect(results).toEqual([
                { text: 'aTitle' },
                { text: 'aTitle2' },
                { text: 'aTitle3' },
                { text: 'some text' },
                { text: 'some text2' },
                { text: 'some text3' },
            ]);
        }));
    });
    describe('When performing metricFindQuery with key, value columns', () => {
        it('should return list of as text, value', () => __awaiter(void 0, void 0, void 0, function* () {
            const query = 'select * from atable';
            const response = {
                results: {
                    tempvar: {
                        refId: 'tempvar',
                        frames: [
                            dataFrameToJSON(createDataFrame({
                                fields: [
                                    { name: '__value', values: ['value1', 'value2', 'value3'] },
                                    { name: '__text', values: ['aTitle', 'aTitle2', 'aTitle3'] },
                                ],
                                meta: {
                                    executedQueryString: 'select * from atable',
                                },
                            })),
                        ],
                    },
                },
            };
            const { ds } = setupTestContext(response, undefined, simpleTemplateSrv);
            const results = yield ds.metricFindQuery(query, { range: defaultRange });
            expect(results).toEqual([
                { text: 'aTitle', value: 'value1' },
                { text: 'aTitle2', value: 'value2' },
                { text: 'aTitle3', value: 'value3' },
            ]);
        }));
    });
    describe('When performing metricFindQuery without key, value columns', () => {
        it('should return list of all field values as text', () => __awaiter(void 0, void 0, void 0, function* () {
            const query = 'select id, values from atable';
            const response = {
                results: {
                    tempvar: {
                        refId: 'tempvar',
                        frames: [
                            dataFrameToJSON(createDataFrame({
                                fields: [
                                    { name: 'id', values: [1, 2, 3] },
                                    { name: 'values', values: ['test1', 'test2', 'test3'] },
                                ],
                                meta: {
                                    executedQueryString: 'select id, values from atable',
                                },
                            })),
                        ],
                    },
                },
            };
            const { ds } = setupTestContext(response, undefined, simpleTemplateSrv);
            const results = yield ds.metricFindQuery(query, { range: defaultRange });
            expect(results).toEqual([
                { text: 1 },
                { text: 2 },
                { text: 3 },
                { text: 'test1' },
                { text: 'test2' },
                { text: 'test3' },
            ]);
        }));
    });
    describe('When performing metricFindQuery with key, value columns and with duplicate keys', () => {
        it('should return list of unique keys', () => __awaiter(void 0, void 0, void 0, function* () {
            const query = 'select * from atable';
            const response = {
                results: {
                    tempvar: {
                        refId: 'tempvar',
                        frames: [
                            dataFrameToJSON(createDataFrame({
                                fields: [
                                    { name: '__text', values: ['aTitle', 'aTitle', 'aTitle'] },
                                    { name: '__value', values: ['same', 'same', 'diff'] },
                                ],
                                meta: {
                                    executedQueryString: 'select * from atable',
                                },
                            })),
                        ],
                    },
                },
            };
            const { ds } = setupTestContext(response, undefined, simpleTemplateSrv);
            const results = yield ds.metricFindQuery(query, { range: defaultRange });
            expect(results).toEqual([{ text: 'aTitle', value: 'same' }]);
        }));
    });
    describe('When interpolating variables', () => {
        describe('and value is a string', () => {
            it('should return an unquoted value', () => {
                const { ds, variable } = setupTestContext({});
                expect(ds.interpolateVariable('abc', variable)).toEqual('abc');
            });
        });
        describe('and value is a number', () => {
            it('should return an unquoted value', () => {
                const { ds, variable } = setupTestContext({});
                expect(ds.interpolateVariable(1000, variable)).toEqual(1000);
            });
        });
        describe('and value is an array of strings', () => {
            it('should return comma separated quoted values', () => {
                const { ds, variable } = setupTestContext({});
                expect(ds.interpolateVariable(['a', 'b', 'c'], variable)).toEqual("'a','b','c'");
            });
        });
        describe('and variable allows multi-value and is a string', () => {
            it('should return a quoted value', () => {
                const { ds, variable } = setupTestContext({});
                variable.multi = true;
                expect(ds.interpolateVariable('abc', variable)).toEqual("'abc'");
            });
        });
        describe('and variable contains single quote', () => {
            it('should return a quoted value', () => {
                const { ds, variable } = setupTestContext({});
                variable.multi = true;
                expect(ds.interpolateVariable("a'bc", variable)).toEqual("'a''bc'");
                expect(ds.interpolateVariable("a'b'c", variable)).toEqual("'a''b''c'");
            });
        });
        describe('and variable allows all and is a string', () => {
            it('should return a quoted value', () => {
                const { ds, variable } = setupTestContext({});
                variable.includeAll = true;
                expect(ds.interpolateVariable('abc', variable)).toEqual("'abc'");
            });
        });
    });
    describe('targetContainsTemplate', () => {
        it('given query that contains template variable it should return true', () => {
            const rawSql = `SELECT
      $__timeGroup("createdAt",'$summarize'),
      avg(value) as "value",
      hostname as "metric"
    FROM
      grafana_metric
    WHERE
      $__timeFilter("createdAt") AND
      measurement = 'logins.count' AND
      hostname IN($host)
    GROUP BY time, metric
    ORDER BY time`;
            const query = {
                rawSql,
                refId: 'A',
                rawQuery: true,
            };
            // a fake template server:
            // it assumes there are two template variables defined:
            // - summarize
            // - host
            const templateSrv = {
                containsTemplate: (text) => {
                    // when the text arrives here, it has been already pre-processed
                    // by the sql datasource, sql-specific variables have been removed
                    expect(text).toBe(rawSql.replace(/\$__time(Filter)?/g, ''));
                    return true;
                },
            };
            const { ds } = setupTestContext({}, undefined, templateSrv);
            expect(ds.targetContainsTemplate(query)).toBeTruthy();
        });
        it('given query that only contains global template variable it should return false', () => {
            const rawSql = `SELECT
      $__timeGroup("createdAt",'$__interval'),
      avg(value) as "value",
      hostname as "metric"
    FROM
      grafana_metric
    WHERE
      $__timeFilter("createdAt") AND
      measurement = 'logins.count'
    GROUP BY time, metric
    ORDER BY time`;
            const query = {
                rawSql,
                refId: 'A',
                rawQuery: true,
            };
            // a fake template server:
            // it assumes there are two template variables defined:
            // - summarize
            // - host
            const templateSrv = {
                containsTemplate: (text) => {
                    // when the text arrives here, it has been already pre-processed
                    // by the sql datasource, sql-specific variables has been removed
                    expect(text).toBe(rawSql.replace(/\$__time(Filter)?/g, ''));
                    return false;
                },
            };
            const { ds } = setupTestContext({}, undefined, templateSrv);
            expect(ds.targetContainsTemplate(query)).toBeFalsy();
        });
    });
});
const createFetchResponse = (data) => ({
    data,
    status: 200,
    url: 'http://localhost:3000/api/query',
    config: { url: 'http://localhost:3000/api/query' },
    type: 'basic',
    statusText: 'Ok',
    redirected: false,
    headers: {},
    ok: true,
});
//# sourceMappingURL=datasource.test.js.map