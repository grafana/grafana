import { __awaiter, __generator } from "tslib";
import { DatasourceSrv } from 'app/features/plugins/datasource_srv';
import { DataSourcePlugin } from '@grafana/data';
// Datasource variable $datasource with current value 'BBB'
var templateSrv = {
    getVariables: function () { return [
        {
            type: 'datasource',
            name: 'datasource',
            current: {
                value: 'BBB',
            },
        },
        {
            type: 'datasource',
            name: 'datasourceDefault',
            current: {
                value: 'default',
            },
        },
    ]; },
    replace: function (v) {
        var result = v.replace('${datasource}', 'BBB');
        result = result.replace('${datasourceDefault}', 'default');
        return result;
    },
};
var TestDataSource = /** @class */ (function () {
    function TestDataSource(instanceSettings) {
        this.instanceSettings = instanceSettings;
    }
    return TestDataSource;
}());
jest.mock('../plugin_loader', function () { return ({
    importDataSourcePlugin: function () {
        return Promise.resolve(new DataSourcePlugin(TestDataSource));
    },
}); });
describe('datasource_srv', function () {
    var dataSourceSrv = new DatasourceSrv({}, {}, templateSrv);
    var dataSourceInit = {
        mmm: {
            type: 'test-db',
            name: 'mmm',
            uid: 'uid-code-mmm',
            meta: { metrics: true, annotations: true },
        },
        '-- Grafana --': {
            type: 'grafana',
            name: '-- Grafana --',
            meta: { builtIn: true, metrics: true, id: 'grafana' },
        },
        '-- Dashboard --': {
            type: 'dashboard',
            name: '-- Dashboard --',
            meta: { builtIn: true, metrics: true, id: 'dashboard' },
        },
        '-- Mixed --': {
            type: 'test-db',
            name: '-- Mixed --',
            meta: { builtIn: true, metrics: true, id: 'mixed' },
        },
        ZZZ: {
            type: 'test-db',
            name: 'ZZZ',
            uid: 'uid-code-ZZZ',
            meta: { metrics: true },
        },
        aaa: {
            type: 'test-db',
            name: 'aaa',
            uid: 'uid-code-aaa',
            meta: { metrics: true },
        },
        BBB: {
            type: 'test-db',
            name: 'BBB',
            uid: 'uid-code-BBB',
            meta: { metrics: true },
            isDefault: true,
        },
        Jaeger: {
            type: 'jaeger-db',
            name: 'Jaeger',
            uid: 'uid-code-Jaeger',
            meta: { tracing: true, id: 'jaeger' },
        },
        CannotBeQueried: {
            type: 'no-query',
            name: 'no-query',
            uid: 'no-query',
            meta: { id: 'no-query' },
        },
    };
    describe('Given a list of data sources', function () {
        beforeEach(function () {
            dataSourceSrv.init(dataSourceInit, 'BBB');
        });
        describe('when getting data source class instance', function () {
            it('should load plugin and create instance and set meta', function () { return __awaiter(void 0, void 0, void 0, function () {
                var ds, ds2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, dataSourceSrv.get('mmm')];
                        case 1:
                            ds = (_a.sent());
                            expect(ds.meta).toBe(dataSourceInit.mmm.meta);
                            expect(ds.instanceSettings).toBe(dataSourceInit.mmm);
                            return [4 /*yield*/, dataSourceSrv.get('mmm')];
                        case 2:
                            ds2 = _a.sent();
                            expect(ds).toBe(ds2);
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should be able to load data source using uid as well', function () { return __awaiter(void 0, void 0, void 0, function () {
                var dsByUid, dsByName;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, dataSourceSrv.get('uid-code-mmm')];
                        case 1:
                            dsByUid = _a.sent();
                            return [4 /*yield*/, dataSourceSrv.get('mmm')];
                        case 2:
                            dsByName = _a.sent();
                            expect(dsByUid.meta).toBe(dsByName.meta);
                            expect(dsByUid).toBe(dsByName);
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('when getting instance settings', function () {
            it('should work by name or uid', function () {
                expect(dataSourceSrv.getInstanceSettings('mmm')).toBe(dataSourceSrv.getInstanceSettings('uid-code-mmm'));
            });
            it('should work with variable', function () {
                var ds = dataSourceSrv.getInstanceSettings('${datasource}');
                expect(ds === null || ds === void 0 ? void 0 : ds.name).toBe('${datasource}');
                expect(ds === null || ds === void 0 ? void 0 : ds.uid).toBe('uid-code-BBB');
            });
            it('should not set isDefault when being fetched via variable', function () {
                var ds = dataSourceSrv.getInstanceSettings('${datasource}');
                expect(ds === null || ds === void 0 ? void 0 : ds.isDefault).toBe(false);
            });
            it('should work with variable', function () {
                var ds = dataSourceSrv.getInstanceSettings('${datasourceDefault}');
                expect(ds === null || ds === void 0 ? void 0 : ds.name).toBe('${datasourceDefault}');
                expect(ds === null || ds === void 0 ? void 0 : ds.uid).toBe('uid-code-BBB');
            });
        });
        describe('when getting external metric sources', function () {
            it('should return list of explore sources', function () {
                var externalSources = dataSourceSrv.getExternal();
                expect(externalSources.length).toBe(6);
            });
        });
        it('Should by default filter out data sources that cannot be queried', function () {
            var list = dataSourceSrv.getList({});
            expect(list.find(function (x) { return x.name === 'no-query'; })).toBeUndefined();
            var all = dataSourceSrv.getList({ all: true });
            expect(all.find(function (x) { return x.name === 'no-query'; })).toBeDefined();
        });
        it('Can get list of data sources with variables: true', function () {
            var list = dataSourceSrv.getList({ metrics: true, variables: true });
            expect(list[0].name).toBe('${datasourceDefault}');
            expect(list[1].name).toBe('${datasource}');
        });
        it('Can get list of data sources with tracing: true', function () {
            var list = dataSourceSrv.getList({ tracing: true });
            expect(list[0].name).toBe('Jaeger');
        });
        it('Can get list of data sources with annotation: true', function () {
            var list = dataSourceSrv.getList({ annotations: true });
            expect(list[0].name).toBe('mmm');
        });
        it('Can get get list and filter by pluginId', function () {
            var list = dataSourceSrv.getList({ pluginId: 'jaeger' });
            expect(list[0].name).toBe('Jaeger');
            expect(list.length).toBe(1);
        });
        it('Can get list  of data sources with metrics: true, builtIn: true, mixed: true', function () {
            expect(dataSourceSrv.getList({ metrics: true, dashboard: true, mixed: true })).toMatchInlineSnapshot("\n        Array [\n          Object {\n            \"meta\": Object {\n              \"metrics\": true,\n            },\n            \"name\": \"aaa\",\n            \"type\": \"test-db\",\n            \"uid\": \"uid-code-aaa\",\n          },\n          Object {\n            \"isDefault\": true,\n            \"meta\": Object {\n              \"metrics\": true,\n            },\n            \"name\": \"BBB\",\n            \"type\": \"test-db\",\n            \"uid\": \"uid-code-BBB\",\n          },\n          Object {\n            \"meta\": Object {\n              \"annotations\": true,\n              \"metrics\": true,\n            },\n            \"name\": \"mmm\",\n            \"type\": \"test-db\",\n            \"uid\": \"uid-code-mmm\",\n          },\n          Object {\n            \"meta\": Object {\n              \"metrics\": true,\n            },\n            \"name\": \"ZZZ\",\n            \"type\": \"test-db\",\n            \"uid\": \"uid-code-ZZZ\",\n          },\n          Object {\n            \"meta\": Object {\n              \"builtIn\": true,\n              \"id\": \"mixed\",\n              \"metrics\": true,\n            },\n            \"name\": \"-- Mixed --\",\n            \"type\": \"test-db\",\n            \"uid\": \"-- Mixed --\",\n          },\n          Object {\n            \"meta\": Object {\n              \"builtIn\": true,\n              \"id\": \"dashboard\",\n              \"metrics\": true,\n            },\n            \"name\": \"-- Dashboard --\",\n            \"type\": \"dashboard\",\n            \"uid\": \"-- Dashboard --\",\n          },\n          Object {\n            \"meta\": Object {\n              \"builtIn\": true,\n              \"id\": \"grafana\",\n              \"metrics\": true,\n            },\n            \"name\": \"-- Grafana --\",\n            \"type\": \"grafana\",\n            \"uid\": \"-- Grafana --\",\n          },\n        ]\n      ");
        });
    });
});
//# sourceMappingURL=datasource_srv.test.js.map