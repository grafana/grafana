import { __assign, __awaiter, __generator } from "tslib";
import { of } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { dataFrameToJSON, dateTime, MutableDataFrame, toUtc, } from '@grafana/data';
import { PostgresDatasource } from '../datasource';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { TemplateSrv } from 'app/features/templating/template_srv';
import { initialCustomVariableModelState } from '../../../../features/variables/custom/reducer';
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: function () { return backendSrv; } })); });
jest.mock('@grafana/runtime/src/services', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime/src/services')), { getBackendSrv: function () { return backendSrv; }, getDataSourceSrv: function () {
        return {
            getInstanceSettings: function () { return ({ id: 8674 }); },
        };
    } })); });
describe('PostgreSQLDatasource', function () {
    var fetchMock = jest.spyOn(backendSrv, 'fetch');
    var setupTestContext = function (data) {
        jest.clearAllMocks();
        fetchMock.mockImplementation(function () { return of(createFetchResponse(data)); });
        var instanceSettings = {
            jsonData: {
                defaultProject: 'testproject',
            },
        };
        var templateSrv = new TemplateSrv();
        var raw = {
            from: toUtc('2018-04-25 10:00'),
            to: toUtc('2018-04-25 11:00'),
        };
        var timeSrvMock = {
            timeRange: function () { return ({
                from: raw.from,
                to: raw.to,
                raw: raw,
            }); },
        };
        var variable = __assign({}, initialCustomVariableModelState);
        var ds = new PostgresDatasource(instanceSettings, templateSrv, timeSrvMock);
        return { ds: ds, templateSrv: templateSrv, timeSrvMock: timeSrvMock, variable: variable };
    };
    // https://rxjs-dev.firebaseapp.com/guide/testing/marble-testing
    var runMarbleTest = function (args) {
        var expectedValues = args.expectedValues, expectedMarble = args.expectedMarble, options = args.options, values = args.values, marble = args.marble;
        var scheduler = new TestScheduler(function (actual, expected) {
            expect(actual).toEqual(expected);
        });
        var ds = setupTestContext({}).ds;
        scheduler.run(function (_a) {
            var cold = _a.cold, expectObservable = _a.expectObservable;
            var source = cold(marble, values);
            jest.clearAllMocks();
            fetchMock.mockImplementation(function () { return source; });
            var result = ds.query(options);
            expectObservable(result).toBe(expectedMarble, expectedValues);
        });
    };
    describe('When performing a time series query', function () {
        it('should transform response correctly', function () {
            var options = {
                range: {
                    from: dateTime(1432288354),
                    to: dateTime(1432288401),
                },
                targets: [
                    {
                        format: 'time_series',
                        rawQuery: true,
                        rawSql: 'select time, metric from grafana_metric',
                        refId: 'A',
                        datasource: 'gdev-ds',
                    },
                ],
            };
            var response = {
                results: {
                    A: {
                        refId: 'A',
                        frames: [
                            dataFrameToJSON(new MutableDataFrame({
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
            var values = { a: createFetchResponse(response) };
            var marble = '-a|';
            var expectedMarble = '-a|';
            var expectedValues = {
                a: {
                    data: [
                        {
                            fields: [
                                {
                                    config: {},
                                    entities: {},
                                    name: 'time',
                                    type: 'time',
                                    values: {
                                        buffer: [1599643351085],
                                    },
                                },
                                {
                                    config: {},
                                    entities: {},
                                    labels: {
                                        metric: 'America',
                                    },
                                    name: 'metric',
                                    type: 'number',
                                    values: {
                                        buffer: [30.226249741223704],
                                    },
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
                    state: 'Done',
                },
            };
            runMarbleTest({ options: options, marble: marble, values: values, expectedMarble: expectedMarble, expectedValues: expectedValues });
        });
    });
    describe('When performing a table query', function () {
        it('should transform response correctly', function () {
            var options = {
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
                    },
                ],
            };
            var response = {
                results: {
                    A: {
                        refId: 'A',
                        frames: [
                            dataFrameToJSON(new MutableDataFrame({
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
            var values = { a: createFetchResponse(response) };
            var marble = '-a|';
            var expectedMarble = '-a|';
            var expectedValues = {
                a: {
                    data: [
                        {
                            fields: [
                                {
                                    config: {},
                                    entities: {},
                                    name: 'time',
                                    type: 'time',
                                    values: {
                                        buffer: [1599643351085],
                                    },
                                },
                                {
                                    config: {},
                                    entities: {},
                                    name: 'metric',
                                    type: 'string',
                                    values: {
                                        buffer: ['America'],
                                    },
                                },
                                {
                                    config: {},
                                    entities: {},
                                    name: 'value',
                                    type: 'number',
                                    values: {
                                        buffer: [30.226249741223704],
                                    },
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
                    state: 'Done',
                },
            };
            runMarbleTest({ options: options, marble: marble, values: values, expectedMarble: expectedMarble, expectedValues: expectedValues });
        });
    });
    describe('When performing a query with hidden target', function () {
        it('should return empty result and backendSrv.fetch should not be called', function () { return __awaiter(void 0, void 0, void 0, function () {
            var options, ds;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        options = {
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
                        ds = setupTestContext({}).ds;
                        return [4 /*yield*/, expect(ds.query(options)).toEmitValuesWith(function (received) {
                                expect(received[0]).toEqual({ data: [] });
                                expect(fetchMock).not.toHaveBeenCalled();
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When performing annotationQuery', function () {
        var results;
        var annotationName = 'MyAnno';
        var options = {
            annotation: {
                name: annotationName,
                rawQuery: 'select time, title, text, tags from table;',
            },
            range: {
                from: dateTime(1432288354),
                to: dateTime(1432288401),
            },
        };
        var response = {
            results: {
                MyAnno: {
                    frames: [
                        dataFrameToJSON(new MutableDataFrame({
                            fields: [
                                { name: 'time', values: [1432288355, 1432288390, 1432288400] },
                                { name: 'text', values: ['some text', 'some text2', 'some text3'] },
                                { name: 'tags', values: ['TagA,TagB', ' TagB , TagC', null] },
                            ],
                        })),
                    ],
                },
            },
        };
        beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = setupTestContext(response).ds;
                        return [4 /*yield*/, ds.annotationQuery(options)];
                    case 1:
                        results = _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should return annotation list', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                expect(results.length).toBe(3);
                expect(results[0].text).toBe('some text');
                expect(results[0].tags[0]).toBe('TagA');
                expect(results[0].tags[1]).toBe('TagB');
                expect(results[1].tags[0]).toBe('TagB');
                expect(results[1].tags[1]).toBe('TagC');
                expect(results[2].tags.length).toBe(0);
                return [2 /*return*/];
            });
        }); });
    });
    describe('When performing metricFindQuery that returns multiple string fields', function () {
        it('should return list of all string field values', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, response, ds, results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = 'select * from atable';
                        response = {
                            results: {
                                tempvar: {
                                    refId: 'tempvar',
                                    frames: [
                                        dataFrameToJSON(new MutableDataFrame({
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
                        ds = setupTestContext(response).ds;
                        return [4 /*yield*/, ds.metricFindQuery(query, {})];
                    case 1:
                        results = _a.sent();
                        expect(results.length).toBe(6);
                        expect(results[0].text).toBe('aTitle');
                        expect(results[5].text).toBe('some text3');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When performing metricFindQuery with $__searchFilter and a searchFilter is given', function () {
        it('should return list of all column values', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, response, ds, results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = "select title from atable where title LIKE '$__searchFilter'";
                        response = {
                            results: {
                                tempvar: {
                                    refId: 'tempvar',
                                    frames: [
                                        dataFrameToJSON(new MutableDataFrame({
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
                        ds = setupTestContext(response).ds;
                        return [4 /*yield*/, ds.metricFindQuery(query, { searchFilter: 'aTit' })];
                    case 1:
                        results = _a.sent();
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
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When performing metricFindQuery with $__searchFilter but no searchFilter is given', function () {
        it('should return list of all column values', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, response, ds, results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = "select title from atable where title LIKE '$__searchFilter'";
                        response = {
                            results: {
                                tempvar: {
                                    refId: 'tempvar',
                                    frames: [
                                        dataFrameToJSON(new MutableDataFrame({
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
                        ds = setupTestContext(response).ds;
                        return [4 /*yield*/, ds.metricFindQuery(query, {})];
                    case 1:
                        results = _a.sent();
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
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When performing metricFindQuery with key, value columns', function () {
        it('should return list of as text, value', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, response, ds, results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = 'select * from atable';
                        response = {
                            results: {
                                tempvar: {
                                    refId: 'tempvar',
                                    frames: [
                                        dataFrameToJSON(new MutableDataFrame({
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
                        ds = setupTestContext(response).ds;
                        return [4 /*yield*/, ds.metricFindQuery(query, {})];
                    case 1:
                        results = _a.sent();
                        expect(results).toEqual([
                            { text: 'aTitle', value: 'value1' },
                            { text: 'aTitle2', value: 'value2' },
                            { text: 'aTitle3', value: 'value3' },
                        ]);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When performing metricFindQuery without key, value columns', function () {
        it('should return list of all field values as text', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, response, ds, results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = 'select id, values from atable';
                        response = {
                            results: {
                                tempvar: {
                                    refId: 'tempvar',
                                    frames: [
                                        dataFrameToJSON(new MutableDataFrame({
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
                        ds = setupTestContext(response).ds;
                        return [4 /*yield*/, ds.metricFindQuery(query, {})];
                    case 1:
                        results = _a.sent();
                        expect(results).toEqual([
                            { text: 1 },
                            { text: 2 },
                            { text: 3 },
                            { text: 'test1' },
                            { text: 'test2' },
                            { text: 'test3' },
                        ]);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When performing metricFindQuery with key, value columns and with duplicate keys', function () {
        it('should return list of unique keys', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, response, ds, results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = 'select * from atable';
                        response = {
                            results: {
                                tempvar: {
                                    refId: 'tempvar',
                                    frames: [
                                        dataFrameToJSON(new MutableDataFrame({
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
                        ds = setupTestContext(response).ds;
                        return [4 /*yield*/, ds.metricFindQuery(query, {})];
                    case 1:
                        results = _a.sent();
                        expect(results).toEqual([{ text: 'aTitle', value: 'same' }]);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When interpolating variables', function () {
        describe('and value is a string', function () {
            it('should return an unquoted value', function () {
                var _a = setupTestContext({}), ds = _a.ds, variable = _a.variable;
                expect(ds.interpolateVariable('abc', variable)).toEqual('abc');
            });
        });
        describe('and value is a number', function () {
            it('should return an unquoted value', function () {
                var _a = setupTestContext({}), ds = _a.ds, variable = _a.variable;
                expect(ds.interpolateVariable(1000, variable)).toEqual(1000);
            });
        });
        describe('and value is an array of strings', function () {
            it('should return comma separated quoted values', function () {
                var _a = setupTestContext({}), ds = _a.ds, variable = _a.variable;
                expect(ds.interpolateVariable(['a', 'b', 'c'], variable)).toEqual("'a','b','c'");
            });
        });
        describe('and variable allows multi-value and is a string', function () {
            it('should return a quoted value', function () {
                var _a = setupTestContext({}), ds = _a.ds, variable = _a.variable;
                variable.multi = true;
                expect(ds.interpolateVariable('abc', variable)).toEqual("'abc'");
            });
        });
        describe('and variable contains single quote', function () {
            it('should return a quoted value', function () {
                var _a = setupTestContext({}), ds = _a.ds, variable = _a.variable;
                variable.multi = true;
                expect(ds.interpolateVariable("a'bc", variable)).toEqual("'a''bc'");
                expect(ds.interpolateVariable("a'b'c", variable)).toEqual("'a''b''c'");
            });
        });
        describe('and variable allows all and is a string', function () {
            it('should return a quoted value', function () {
                var _a = setupTestContext({}), ds = _a.ds, variable = _a.variable;
                variable.includeAll = true;
                expect(ds.interpolateVariable('abc', variable)).toEqual("'abc'");
            });
        });
    });
    describe('targetContainsTemplate', function () {
        it('given query that contains template variable it should return true', function () {
            var rawSql = "SELECT\n      $__timeGroup(\"createdAt\",'$summarize'),\n      avg(value) as \"value\",\n      hostname as \"metric\"\n    FROM\n      grafana_metric\n    WHERE\n      $__timeFilter(\"createdAt\") AND\n      measurement = 'logins.count' AND\n      hostname IN($host)\n    GROUP BY time, metric\n    ORDER BY time";
            var query = {
                rawSql: rawSql,
                rawQuery: true,
            };
            var _a = setupTestContext({}), templateSrv = _a.templateSrv, ds = _a.ds;
            templateSrv.init([
                { type: 'query', name: 'summarize', current: { value: '1m' } },
                { type: 'query', name: 'host', current: { value: 'a' } },
            ]);
            expect(ds.targetContainsTemplate(query)).toBeTruthy();
        });
        it('given query that only contains global template variable it should return false', function () {
            var rawSql = "SELECT\n      $__timeGroup(\"createdAt\",'$__interval'),\n      avg(value) as \"value\",\n      hostname as \"metric\"\n    FROM\n      grafana_metric\n    WHERE\n      $__timeFilter(\"createdAt\") AND\n      measurement = 'logins.count'\n    GROUP BY time, metric\n    ORDER BY time";
            var query = {
                rawSql: rawSql,
                rawQuery: true,
            };
            var _a = setupTestContext({}), templateSrv = _a.templateSrv, ds = _a.ds;
            templateSrv.init([
                { type: 'query', name: 'summarize', current: { value: '1m' } },
                { type: 'query', name: 'host', current: { value: 'a' } },
            ]);
            expect(ds.targetContainsTemplate(query)).toBeFalsy();
        });
    });
});
var createFetchResponse = function (data) { return ({
    data: data,
    status: 200,
    url: 'http://localhost:3000/api/query',
    config: { url: 'http://localhost:3000/api/query' },
    type: 'basic',
    statusText: 'Ok',
    redirected: false,
    headers: {},
    ok: true,
}); };
//# sourceMappingURL=datasource.test.js.map