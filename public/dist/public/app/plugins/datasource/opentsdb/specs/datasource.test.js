import { __assign, __awaiter, __generator } from "tslib";
import OpenTsDatasource from '../datasource';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { createFetchResponse } from '../../../../../test/helpers/createFetchResponse';
import { of } from 'rxjs';
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: function () { return backendSrv; } })); });
var metricFindQueryData = [
    {
        target: 'prod1.count',
        datapoints: [
            [10, 1],
            [12, 1],
        ],
    },
];
describe('opentsdb', function () {
    function getTestcontext(_a) {
        var _b = _a === void 0 ? {} : _a, _c = _b.data, data = _c === void 0 ? metricFindQueryData : _c;
        jest.clearAllMocks();
        var fetchMock = jest.spyOn(backendSrv, 'fetch');
        fetchMock.mockImplementation(function () { return of(createFetchResponse(data)); });
        var instanceSettings = { url: '', jsonData: { tsdbVersion: 1 } };
        var replace = jest.fn(function (value) { return value; });
        var templateSrv = {
            replace: replace,
        };
        var ds = new OpenTsDatasource(instanceSettings, templateSrv);
        return { ds: ds, templateSrv: templateSrv, fetchMock: fetchMock };
    }
    describe('When performing metricFindQuery', function () {
        it('metrics() should generate api suggest query', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, ds, fetchMock, results;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _a = getTestcontext(), ds = _a.ds, fetchMock = _a.fetchMock;
                        return [4 /*yield*/, ds.metricFindQuery('metrics(pew)')];
                    case 1:
                        results = _d.sent();
                        expect(fetchMock).toHaveBeenCalledTimes(1);
                        expect(fetchMock.mock.calls[0][0].url).toBe('/api/suggest');
                        expect((_b = fetchMock.mock.calls[0][0].params) === null || _b === void 0 ? void 0 : _b.type).toBe('metrics');
                        expect((_c = fetchMock.mock.calls[0][0].params) === null || _c === void 0 ? void 0 : _c.q).toBe('pew');
                        expect(results).not.toBe(null);
                        return [2 /*return*/];
                }
            });
        }); });
        it('tag_names(cpu) should generate lookup query', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, ds, fetchMock, results;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = getTestcontext(), ds = _a.ds, fetchMock = _a.fetchMock;
                        return [4 /*yield*/, ds.metricFindQuery('tag_names(cpu)')];
                    case 1:
                        results = _c.sent();
                        expect(fetchMock).toHaveBeenCalledTimes(1);
                        expect(fetchMock.mock.calls[0][0].url).toBe('/api/search/lookup');
                        expect((_b = fetchMock.mock.calls[0][0].params) === null || _b === void 0 ? void 0 : _b.m).toBe('cpu');
                        expect(results).not.toBe(null);
                        return [2 /*return*/];
                }
            });
        }); });
        it('tag_values(cpu, test) should generate lookup query', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, ds, fetchMock, results;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = getTestcontext(), ds = _a.ds, fetchMock = _a.fetchMock;
                        return [4 /*yield*/, ds.metricFindQuery('tag_values(cpu, hostname)')];
                    case 1:
                        results = _c.sent();
                        expect(fetchMock).toHaveBeenCalledTimes(1);
                        expect(fetchMock.mock.calls[0][0].url).toBe('/api/search/lookup');
                        expect((_b = fetchMock.mock.calls[0][0].params) === null || _b === void 0 ? void 0 : _b.m).toBe('cpu{hostname=*}');
                        expect(results).not.toBe(null);
                        return [2 /*return*/];
                }
            });
        }); });
        it('tag_values(cpu, test) should generate lookup query', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, ds, fetchMock, results;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = getTestcontext(), ds = _a.ds, fetchMock = _a.fetchMock;
                        return [4 /*yield*/, ds.metricFindQuery('tag_values(cpu, hostname, env=$env)')];
                    case 1:
                        results = _c.sent();
                        expect(fetchMock).toHaveBeenCalledTimes(1);
                        expect(fetchMock.mock.calls[0][0].url).toBe('/api/search/lookup');
                        expect((_b = fetchMock.mock.calls[0][0].params) === null || _b === void 0 ? void 0 : _b.m).toBe('cpu{hostname=*,env=$env}');
                        expect(results).not.toBe(null);
                        return [2 /*return*/];
                }
            });
        }); });
        it('tag_values(cpu, test) should generate lookup query', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, ds, fetchMock, results;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = getTestcontext(), ds = _a.ds, fetchMock = _a.fetchMock;
                        return [4 /*yield*/, ds.metricFindQuery('tag_values(cpu, hostname, env=$env, region=$region)')];
                    case 1:
                        results = _c.sent();
                        expect(fetchMock).toHaveBeenCalledTimes(1);
                        expect(fetchMock.mock.calls[0][0].url).toBe('/api/search/lookup');
                        expect((_b = fetchMock.mock.calls[0][0].params) === null || _b === void 0 ? void 0 : _b.m).toBe('cpu{hostname=*,env=$env,region=$region}');
                        expect(results).not.toBe(null);
                        return [2 /*return*/];
                }
            });
        }); });
        it('suggest_tagk() should generate api suggest query', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, ds, fetchMock, results;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _a = getTestcontext(), ds = _a.ds, fetchMock = _a.fetchMock;
                        return [4 /*yield*/, ds.metricFindQuery('suggest_tagk(foo)')];
                    case 1:
                        results = _d.sent();
                        expect(fetchMock).toHaveBeenCalledTimes(1);
                        expect(fetchMock.mock.calls[0][0].url).toBe('/api/suggest');
                        expect((_b = fetchMock.mock.calls[0][0].params) === null || _b === void 0 ? void 0 : _b.type).toBe('tagk');
                        expect((_c = fetchMock.mock.calls[0][0].params) === null || _c === void 0 ? void 0 : _c.q).toBe('foo');
                        expect(results).not.toBe(null);
                        return [2 /*return*/];
                }
            });
        }); });
        it('suggest_tagv() should generate api suggest query', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, ds, fetchMock, results;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _a = getTestcontext(), ds = _a.ds, fetchMock = _a.fetchMock;
                        return [4 /*yield*/, ds.metricFindQuery('suggest_tagv(bar)')];
                    case 1:
                        results = _d.sent();
                        expect(fetchMock).toHaveBeenCalledTimes(1);
                        expect(fetchMock.mock.calls[0][0].url).toBe('/api/suggest');
                        expect((_b = fetchMock.mock.calls[0][0].params) === null || _b === void 0 ? void 0 : _b.type).toBe('tagv');
                        expect((_c = fetchMock.mock.calls[0][0].params) === null || _c === void 0 ? void 0 : _c.q).toBe('bar');
                        expect(results).not.toBe(null);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When interpolating variables', function () {
        it('should return an empty array if no queries are provided', function () {
            var ds = getTestcontext().ds;
            expect(ds.interpolateVariablesInQueries([], {})).toHaveLength(0);
        });
        it('should replace correct variables', function () {
            var _a = getTestcontext(), ds = _a.ds, templateSrv = _a.templateSrv;
            var variableName = 'someVar';
            var logQuery = {
                refId: 'someRefId',
                metric: "$" + variableName,
            };
            ds.interpolateVariablesInQueries([logQuery], {});
            expect(templateSrv.replace).toHaveBeenCalledWith('$someVar', {});
            expect(templateSrv.replace).toHaveBeenCalledTimes(1);
        });
    });
});
//# sourceMappingURL=datasource.test.js.map