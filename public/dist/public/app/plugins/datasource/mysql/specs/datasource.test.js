import { __assign, __awaiter, __generator } from "tslib";
import { of } from 'rxjs';
import { dataFrameToJSON, dateTime, MutableDataFrame, toUtc, } from '@grafana/data';
import { MysqlDatasource } from '../datasource';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { TemplateSrv } from 'app/features/templating/template_srv';
import { initialCustomVariableModelState } from '../../../../features/variables/custom/reducer';
import { setBackendSrv } from '@grafana/runtime';
describe('MySQLDatasource', function () {
    var setupTextContext = function (response) {
        jest.clearAllMocks();
        setBackendSrv(backendSrv);
        var fetchMock = jest.spyOn(backendSrv, 'fetch');
        var instanceSettings = {
            jsonData: {
                defaultProject: 'testproject',
            },
        };
        var templateSrv = new TemplateSrv();
        var variable = __assign({}, initialCustomVariableModelState);
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
        fetchMock.mockImplementation(function (options) { return of(createFetchResponse(response)); });
        var ds = new MysqlDatasource(instanceSettings, templateSrv, timeSrvMock);
        return { ds: ds, variable: variable, templateSrv: templateSrv, fetchMock: fetchMock };
    };
    describe('When performing a query with hidden target', function () {
        it('should return empty result and backendSrv.fetch should not be called', function () { return __awaiter(void 0, void 0, void 0, function () {
            var options, _a, ds, fetchMock;
            return __generator(this, function (_b) {
                switch (_b.label) {
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
                        _a = setupTextContext({}), ds = _a.ds, fetchMock = _a.fetchMock;
                        return [4 /*yield*/, expect(ds.query(options)).toEmitValuesWith(function (received) {
                                expect(received[0]).toEqual({ data: [] });
                                expect(fetchMock).not.toHaveBeenCalled();
                            })];
                    case 1:
                        _b.sent();
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
                rawQuery: 'select time_sec, text, tags from table;',
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
                                { name: 'time_sec', values: [1432288355, 1432288390, 1432288400] },
                                { name: 'text', values: ['some text', 'some text2', 'some text3'] },
                                { name: 'tags', values: ['TagA,TagB', ' TagB , TagC', null] },
                            ],
                        })),
                    ],
                },
            },
        };
        beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = setupTextContext(response).ds;
                        return [4 /*yield*/, ds.annotationQuery(options)];
                    case 1:
                        data = _a.sent();
                        results = data;
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
        var query = 'select * from atable';
        var response = {
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
        it('should return list of all string field values', function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds, results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = setupTextContext(response).ds;
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
        var query = "select title from atable where title LIKE '$__searchFilter'";
        var response = {
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
        it('should return list of all column values', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, ds, fetchMock, results;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setupTextContext(response), ds = _a.ds, fetchMock = _a.fetchMock;
                        return [4 /*yield*/, ds.metricFindQuery(query, { searchFilter: 'aTit' })];
                    case 1:
                        results = _b.sent();
                        expect(fetchMock).toBeCalledTimes(1);
                        expect(fetchMock.mock.calls[0][0].data.queries[0].rawSql).toBe("select title from atable where title LIKE 'aTit%'");
                        expect(results.length).toBe(6);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When performing metricFindQuery with $__searchFilter but no searchFilter is given', function () {
        var query = "select title from atable where title LIKE '$__searchFilter'";
        var response = {
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
        it('should return list of all column values', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, ds, fetchMock, results;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setupTextContext(response), ds = _a.ds, fetchMock = _a.fetchMock;
                        return [4 /*yield*/, ds.metricFindQuery(query, {})];
                    case 1:
                        results = _b.sent();
                        expect(fetchMock).toBeCalledTimes(1);
                        expect(fetchMock.mock.calls[0][0].data.queries[0].rawSql).toBe("select title from atable where title LIKE '%'");
                        expect(results.length).toBe(6);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When performing metricFindQuery with key, value columns', function () {
        var query = 'select * from atable';
        var response = {
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
        it('should return list of as text, value', function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds, results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = setupTextContext(response).ds;
                        return [4 /*yield*/, ds.metricFindQuery(query, {})];
                    case 1:
                        results = _a.sent();
                        expect(results.length).toBe(3);
                        expect(results[0].text).toBe('aTitle');
                        expect(results[0].value).toBe('value1');
                        expect(results[2].text).toBe('aTitle3');
                        expect(results[2].value).toBe('value3');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When performing metricFindQuery without key, value columns', function () {
        var query = 'select id, values from atable';
        var response = {
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
        it('should return list of all field values as text', function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds, results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = setupTextContext(response).ds;
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
        var query = 'select * from atable';
        var response = {
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
        it('should return list of unique keys', function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds, results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = setupTextContext(response).ds;
                        return [4 /*yield*/, ds.metricFindQuery(query, {})];
                    case 1:
                        results = _a.sent();
                        expect(results.length).toBe(1);
                        expect(results[0].text).toBe('aTitle');
                        expect(results[0].value).toBe('same');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When interpolating variables', function () {
        describe('and value is a string', function () {
            it('should return an unquoted value', function () {
                var _a = setupTextContext({}), ds = _a.ds, variable = _a.variable;
                expect(ds.interpolateVariable('abc', variable)).toEqual('abc');
            });
        });
        describe('and value is a number', function () {
            it('should return an unquoted value', function () {
                var _a = setupTextContext({}), ds = _a.ds, variable = _a.variable;
                expect(ds.interpolateVariable(1000, variable)).toEqual(1000);
            });
        });
        describe('and value is an array of strings', function () {
            it('should return comma separated quoted values', function () {
                var _a = setupTextContext({}), ds = _a.ds, variable = _a.variable;
                expect(ds.interpolateVariable(['a', 'b', 'c'], variable)).toEqual("'a','b','c'");
            });
        });
        describe('and variable allows multi-value and value is a string', function () {
            it('should return a quoted value', function () {
                var _a = setupTextContext({}), ds = _a.ds, variable = _a.variable;
                variable.multi = true;
                expect(ds.interpolateVariable('abc', variable)).toEqual("'abc'");
            });
        });
        describe('and variable contains single quote', function () {
            it('should return a quoted value', function () {
                var _a = setupTextContext({}), ds = _a.ds, variable = _a.variable;
                variable.multi = true;
                expect(ds.interpolateVariable("a'bc", variable)).toEqual("'a''bc'");
            });
        });
        describe('and variable allows all and value is a string', function () {
            it('should return a quoted value', function () {
                var _a = setupTextContext({}), ds = _a.ds, variable = _a.variable;
                variable.includeAll = true;
                expect(ds.interpolateVariable('abc', variable)).toEqual("'abc'");
            });
        });
    });
    describe('targetContainsTemplate', function () {
        it('given query that contains template variable it should return true', function () {
            var _a = setupTextContext({}), ds = _a.ds, templateSrv = _a.templateSrv;
            var rawSql = "SELECT\n      $__timeGroup(createdAt,'$summarize') as time_sec,\n      avg(value) as value,\n      hostname as metric\n    FROM\n      grafana_metric\n    WHERE\n      $__timeFilter(createdAt) AND\n      measurement = 'logins.count' AND\n      hostname IN($host)\n    GROUP BY 1, 3\n    ORDER BY 1";
            var query = {
                rawSql: rawSql,
                rawQuery: true,
            };
            templateSrv.init([
                { type: 'query', name: 'summarize', current: { value: '1m' } },
                { type: 'query', name: 'host', current: { value: 'a' } },
            ]);
            expect(ds.targetContainsTemplate(query)).toBeTruthy();
        });
        it('given query that only contains global template variable it should return false', function () {
            var _a = setupTextContext({}), ds = _a.ds, templateSrv = _a.templateSrv;
            var rawSql = "SELECT\n      $__timeGroup(createdAt,'$__interval') as time_sec,\n      avg(value) as value,\n      hostname as metric\n    FROM\n      grafana_metric\n    WHERE\n      $__timeFilter(createdAt) AND\n      measurement = 'logins.count'\n    GROUP BY 1, 3\n    ORDER BY 1";
            var query = {
                rawSql: rawSql,
                rawQuery: true,
            };
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