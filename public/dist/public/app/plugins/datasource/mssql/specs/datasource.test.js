import { __assign } from "tslib";
import { of } from 'rxjs';
import { dataFrameToJSON, dateTime, MutableDataFrame } from '@grafana/data';
import { MssqlDatasource } from '../datasource';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { backendSrv } from 'app/core/services/backend_srv';
import { initialCustomVariableModelState } from '../../../../features/variables/custom/reducer';
import { createFetchResponse } from 'test/helpers/createFetchResponse';
import { TimeSrvStub } from 'test/specs/helpers';
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: function () { return backendSrv; } })); });
describe('MSSQLDatasource', function () {
    var templateSrv = new TemplateSrv();
    var fetchMock = jest.spyOn(backendSrv, 'fetch');
    var ctx = {
        timeSrv: new TimeSrvStub(),
    };
    beforeEach(function () {
        jest.clearAllMocks();
        ctx.instanceSettings = { name: 'mssql' };
        ctx.ds = new MssqlDatasource(ctx.instanceSettings, templateSrv, ctx.timeSrv);
    });
    describe('When performing annotationQuery', function () {
        var results;
        var annotationName = 'MyAnno';
        var options = {
            annotation: {
                name: annotationName,
                rawQuery: 'select time, text, tags from table;',
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
                                { name: 'time', values: [1521545610656, 1521546251185, 1521546501378] },
                                { name: 'text', values: ['some text', 'some text2', 'some text3'] },
                                { name: 'tags', values: ['TagA,TagB', ' TagB , TagC', null] },
                            ],
                        })),
                    ],
                },
            },
        };
        beforeEach(function () {
            fetchMock.mockImplementation(function () { return of(createFetchResponse(response)); });
            return ctx.ds.annotationQuery(options).then(function (data) {
                results = data;
            });
        });
        it('should return annotation list', function () {
            expect(results.length).toBe(3);
            expect(results[0].text).toBe('some text');
            expect(results[0].tags[0]).toBe('TagA');
            expect(results[0].tags[1]).toBe('TagB');
            expect(results[1].tags[0]).toBe('TagB');
            expect(results[1].tags[1]).toBe('TagC');
            expect(results[2].tags.length).toBe(0);
        });
    });
    describe('When performing metricFindQuery that returns multiple string fields', function () {
        var results;
        var query = 'select * from atable';
        var response = {
            results: {
                tempvar: {
                    frames: [
                        dataFrameToJSON(new MutableDataFrame({
                            fields: [
                                { name: 'title', values: ['aTitle', 'aTitle2', 'aTitle3'] },
                                { name: 'text', values: ['some text', 'some text2', 'some text3'] },
                            ],
                        })),
                    ],
                },
            },
        };
        beforeEach(function () {
            fetchMock.mockImplementation(function () { return of(createFetchResponse(response)); });
            return ctx.ds.metricFindQuery(query).then(function (data) {
                results = data;
            });
        });
        it('should return list of all column values', function () {
            expect(results.length).toBe(6);
            expect(results[0].text).toBe('aTitle');
            expect(results[5].text).toBe('some text3');
        });
    });
    describe('When performing metricFindQuery with key, value columns', function () {
        var results;
        var query = 'select * from atable';
        var response = {
            results: {
                tempvar: {
                    frames: [
                        dataFrameToJSON(new MutableDataFrame({
                            fields: [
                                { name: '__value', values: ['value1', 'value2', 'value3'] },
                                { name: '__text', values: ['aTitle', 'aTitle2', 'aTitle3'] },
                            ],
                        })),
                    ],
                },
            },
        };
        beforeEach(function () {
            fetchMock.mockImplementation(function () { return of(createFetchResponse(response)); });
            return ctx.ds.metricFindQuery(query).then(function (data) {
                results = data;
            });
        });
        it('should return list of as text, value', function () {
            expect(results.length).toBe(3);
            expect(results[0].text).toBe('aTitle');
            expect(results[0].value).toBe('value1');
            expect(results[2].text).toBe('aTitle3');
            expect(results[2].value).toBe('value3');
        });
    });
    describe('When performing metricFindQuery without key, value columns', function () {
        var results;
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
        beforeEach(function () {
            fetchMock.mockImplementation(function () { return of(createFetchResponse(response)); });
            return ctx.ds.metricFindQuery(query).then(function (data) {
                results = data;
            });
        });
        it('should return list of all field values as text', function () {
            expect(results).toEqual([
                { text: 1 },
                { text: 2 },
                { text: 3 },
                { text: 'test1' },
                { text: 'test2' },
                { text: 'test3' },
            ]);
        });
    });
    describe('When performing metricFindQuery with key, value columns and with duplicate keys', function () {
        var results;
        var query = 'select * from atable';
        var response = {
            results: {
                tempvar: {
                    frames: [
                        dataFrameToJSON(new MutableDataFrame({
                            fields: [
                                { name: '__text', values: ['aTitle', 'aTitle', 'aTitle'] },
                                { name: '__value', values: ['same', 'same', 'diff'] },
                            ],
                        })),
                    ],
                },
            },
        };
        beforeEach(function () {
            fetchMock.mockImplementation(function () { return of(createFetchResponse(response)); });
            return ctx.ds.metricFindQuery(query).then(function (data) {
                results = data;
            });
        });
        it('should return list of unique keys', function () {
            expect(results.length).toBe(1);
            expect(results[0].text).toBe('aTitle');
            expect(results[0].value).toBe('same');
        });
    });
    describe('When performing metricFindQuery', function () {
        var query = 'select * from atable';
        var response = {
            results: {
                tempvar: {
                    frames: [
                        dataFrameToJSON(new MutableDataFrame({
                            fields: [{ name: 'test', values: ['aTitle'] }],
                        })),
                    ],
                },
            },
        };
        var time = {
            from: dateTime(1521545610656),
            to: dateTime(1521546251185),
        };
        beforeEach(function () {
            ctx.timeSrv.setTime(time);
            fetchMock.mockImplementation(function () { return of(createFetchResponse(response)); });
            return ctx.ds.metricFindQuery(query, { range: time });
        });
        it('should pass timerange to datasourceRequest', function () {
            expect(fetchMock).toBeCalledTimes(1);
            expect(fetchMock.mock.calls[0][0].data.from).toBe(time.from.valueOf().toString());
            expect(fetchMock.mock.calls[0][0].data.to).toBe(time.to.valueOf().toString());
            expect(fetchMock.mock.calls[0][0].data.queries.length).toBe(1);
            expect(fetchMock.mock.calls[0][0].data.queries[0].rawSql).toBe(query);
        });
    });
    describe('When interpolating variables', function () {
        beforeEach(function () {
            ctx.variable = __assign({}, initialCustomVariableModelState);
        });
        describe('and value is a string', function () {
            it('should return an unquoted value', function () {
                expect(ctx.ds.interpolateVariable('abc', ctx.variable)).toEqual('abc');
            });
        });
        describe('and value is a number', function () {
            it('should return an unquoted value', function () {
                expect(ctx.ds.interpolateVariable(1000, ctx.variable)).toEqual(1000);
            });
        });
        describe('and value is an array of strings', function () {
            it('should return comma separated quoted values', function () {
                expect(ctx.ds.interpolateVariable(['a', 'b', 'c'], ctx.variable)).toEqual("'a','b','c'");
            });
        });
        describe('and variable allows multi-value and value is a string', function () {
            it('should return a quoted value', function () {
                ctx.variable.multi = true;
                expect(ctx.ds.interpolateVariable('abc', ctx.variable)).toEqual("'abc'");
            });
        });
        describe('and variable contains single quote', function () {
            it('should return a quoted value', function () {
                ctx.variable.multi = true;
                expect(ctx.ds.interpolateVariable("a'bc", ctx.variable)).toEqual("'a''bc'");
            });
        });
        describe('and variable allows all and value is a string', function () {
            it('should return a quoted value', function () {
                ctx.variable.includeAll = true;
                expect(ctx.ds.interpolateVariable('abc', ctx.variable)).toEqual("'abc'");
            });
        });
    });
    describe('targetContainsTemplate', function () {
        it('given query that contains template variable it should return true', function () {
            var rawSql = "SELECT\n      $__timeGroup(createdAt,'$summarize') as time,\n      avg(value) as value,\n      hostname as metric\n    FROM\n      grafana_metric\n    WHERE\n      $__timeFilter(createdAt) AND\n      measurement = 'logins.count' AND\n      hostname IN($host)\n    GROUP BY $__timeGroup(createdAt,'$summarize'), hostname\n    ORDER BY 1";
            var query = {
                rawSql: rawSql,
            };
            templateSrv.init([
                { type: 'query', name: 'summarize', current: { value: '1m' } },
                { type: 'query', name: 'host', current: { value: 'a' } },
            ]);
            expect(ctx.ds.targetContainsTemplate(query)).toBeTruthy();
        });
        it('given query that only contains global template variable it should return false', function () {
            var rawSql = "SELECT\n      $__timeGroup(createdAt,'$__interval') as time,\n      avg(value) as value,\n      hostname as metric\n    FROM\n      grafana_metric\n    WHERE\n      $__timeFilter(createdAt) AND\n      measurement = 'logins.count'\n    GROUP BY $__timeGroup(createdAt,'$summarize'), hostname\n    ORDER BY 1";
            var query = {
                rawSql: rawSql,
            };
            templateSrv.init([
                { type: 'query', name: 'summarize', current: { value: '1m' } },
                { type: 'query', name: 'host', current: { value: 'a' } },
            ]);
            expect(ctx.ds.targetContainsTemplate(query)).toBeFalsy();
        });
    });
});
//# sourceMappingURL=datasource.test.js.map