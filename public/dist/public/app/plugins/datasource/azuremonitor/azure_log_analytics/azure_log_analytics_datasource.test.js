import { __awaiter } from "tslib";
import { createContext } from '../__mocks__/datasource';
import createMockQuery from '../__mocks__/query';
import { singleVariable } from '../__mocks__/variables';
import { AzureQueryType } from '../types';
import FakeSchemaData from './__mocks__/schema';
import AzureLogAnalyticsDatasource from './azure_log_analytics_datasource';
let getTempVars = () => [];
let replace = () => '';
jest.mock('@grafana/runtime', () => {
    return Object.assign(Object.assign({ __esModule: true }, jest.requireActual('@grafana/runtime')), { getTemplateSrv: () => ({
            replace: replace,
            getVariables: getTempVars,
            updateTimeRange: jest.fn(),
            containsTemplate: jest.fn(),
        }) });
});
describe('AzureLogAnalyticsDatasource', () => {
    let ctx;
    beforeEach(() => {
        ctx = createContext({
            instanceSettings: { jsonData: { subscriptionId: 'xxx' }, url: 'http://azureloganalyticsapi' },
        });
    });
    describe('When performing getSchema', () => {
        beforeEach(() => {
            getTempVars = () => [];
            replace = (target) => target || '';
            ctx = createContext();
            ctx.getResource = jest.fn().mockImplementation((path) => {
                expect(path).toContain('metadata');
                return Promise.resolve(FakeSchemaData.getlogAnalyticsFakeMetadata());
            });
            ctx.datasource.azureLogAnalyticsDatasource.getResource = ctx.getResource;
        });
        it('should return a schema to use with monaco-kusto', () => __awaiter(void 0, void 0, void 0, function* () {
            const { database } = yield ctx.datasource.azureLogAnalyticsDatasource.getKustoSchema('myWorkspace');
            expect(database === null || database === void 0 ? void 0 : database.tables).toHaveLength(2);
            expect(database === null || database === void 0 ? void 0 : database.tables[0].name).toBe('Alert');
            expect(database === null || database === void 0 ? void 0 : database.tables[0].timespanColumn).toBe('TimeGenerated');
            expect(database === null || database === void 0 ? void 0 : database.tables[1].name).toBe('AzureActivity');
            expect(database === null || database === void 0 ? void 0 : database.tables[0].columns).toHaveLength(69);
            expect(database === null || database === void 0 ? void 0 : database.functions[1].inputParameters).toEqual([
                {
                    name: 'RangeStart',
                    type: 'datetime',
                    defaultValue: 'datetime(null)',
                    cslDefaultValue: 'datetime(null)',
                },
                {
                    name: 'VaultSubscriptionList',
                    type: 'string',
                    defaultValue: '"*"',
                    cslDefaultValue: '"*"',
                },
                {
                    name: 'ExcludeLegacyEvent',
                    type: 'bool',
                    defaultValue: 'True',
                    cslDefaultValue: 'True',
                },
            ]);
        }));
        it('should interpolate variables when making a request for a schema with a uri that contains template variables', () => __awaiter(void 0, void 0, void 0, function* () {
            replace = () => 'myWorkspace/var1-foo';
            ctx = createContext();
            ctx.getResource = jest.fn().mockImplementation((path) => {
                expect(path).toContain('metadata');
                return Promise.resolve(FakeSchemaData.getlogAnalyticsFakeMetadata());
            });
            ctx.datasource.azureLogAnalyticsDatasource.getResource = ctx.getResource;
            yield ctx.datasource.azureLogAnalyticsDatasource.getKustoSchema('myWorkspace/$var1');
            expect(ctx.getResource).lastCalledWith('loganalytics/v1myWorkspace/var1-foo/metadata');
        }));
        it('should include macros as suggested functions', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const result = yield ctx.datasource.azureLogAnalyticsDatasource.getKustoSchema('myWorkspace');
            expect((_a = result.database) === null || _a === void 0 ? void 0 : _a.functions.map((f) => f.name)).toEqual([
                'Func1',
                '_AzureBackup_GetVaults',
                '$__timeFilter',
                '$__timeFrom',
                '$__timeTo',
                '$__escapeMulti',
                '$__contains',
            ]);
        }));
        it('should include template variables as global parameters', () => __awaiter(void 0, void 0, void 0, function* () {
            var _b;
            getTempVars = () => [singleVariable];
            ctx = createContext();
            ctx.getResource = jest.fn().mockImplementation((path) => {
                expect(path).toContain('metadata');
                return Promise.resolve(FakeSchemaData.getlogAnalyticsFakeMetadata());
            });
            ctx.datasource.azureLogAnalyticsDatasource.getResource = ctx.getResource;
            const result = yield ctx.datasource.azureLogAnalyticsDatasource.getKustoSchema('myWorkspace');
            expect((_b = result.globalScalarParameters) === null || _b === void 0 ? void 0 : _b.map((f) => f.name)).toEqual([`$${singleVariable.name}`]);
        }));
    });
    describe('When performing getWorkspaces', () => {
        beforeEach(() => {
            ctx.datasource.azureLogAnalyticsDatasource.getResource = jest
                .fn()
                .mockResolvedValue({ value: [{ name: 'foobar', id: 'foo', properties: { customerId: 'bar' } }] });
        });
        it('should return the workspace id', () => __awaiter(void 0, void 0, void 0, function* () {
            const workspaces = yield ctx.datasource.azureLogAnalyticsDatasource.getWorkspaces('sub');
            expect(workspaces).toEqual([{ text: 'foobar', value: 'foo' }]);
        }));
    });
    describe('When performing getFirstWorkspace', () => {
        beforeEach(() => {
            ctx.datasource.azureLogAnalyticsDatasource.getDefaultOrFirstSubscription = jest.fn().mockResolvedValue('foo');
            ctx.datasource.azureLogAnalyticsDatasource.getWorkspaces = jest
                .fn()
                .mockResolvedValue([{ text: 'foobar', value: 'foo' }]);
            ctx.datasource.azureLogAnalyticsDatasource.firstWorkspace = undefined;
        });
        it('should return the stored workspace', () => __awaiter(void 0, void 0, void 0, function* () {
            ctx.datasource.azureLogAnalyticsDatasource.firstWorkspace = 'bar';
            const workspace = yield ctx.datasource.azureLogAnalyticsDatasource.getFirstWorkspace();
            expect(workspace).toEqual('bar');
            expect(ctx.datasource.azureLogAnalyticsDatasource.getDefaultOrFirstSubscription).not.toHaveBeenCalled();
        }));
        it('should return the first workspace', () => __awaiter(void 0, void 0, void 0, function* () {
            const workspace = yield ctx.datasource.azureLogAnalyticsDatasource.getFirstWorkspace();
            expect(workspace).toEqual('foo');
        }));
    });
    describe('When performing filterQuery', () => {
        let laDatasource;
        beforeEach(() => {
            laDatasource = new AzureLogAnalyticsDatasource(ctx.instanceSettings);
        });
        it('should run queries with a resource', () => {
            const query = {
                refId: 'A',
                azureLogAnalytics: {
                    resources: ['/sub/124/rg/cloud/vm/server'],
                    query: 'perf | take 100',
                },
            };
            expect(laDatasource.filterQuery(query)).toBeTruthy();
        });
        it('should run queries with a workspace', () => {
            const query = {
                refId: 'A',
                azureLogAnalytics: {
                    query: 'perf | take 100',
                    workspace: 'abc1b44e-3e57-4410-b027-6cc0ae6dee67',
                },
            };
            expect(laDatasource.filterQuery(query)).toBeTruthy();
        });
        it('should not run empty queries', () => {
            const query = {
                refId: 'A',
            };
            expect(laDatasource.filterQuery(query)).toBeFalsy();
        });
        it('should not run hidden queries', () => {
            const query = {
                refId: 'A',
                hide: true,
                azureLogAnalytics: {
                    resources: ['/sub/124/rg/cloud/vm/server'],
                    query: 'perf | take 100',
                },
            };
            expect(laDatasource.filterQuery(query)).toBeFalsy();
        });
        it('should not run queries missing a kusto query', () => {
            const query = {
                refId: 'A',
                azureLogAnalytics: {
                    resources: ['/sub/124/rg/cloud/vm/server'],
                },
            };
            expect(laDatasource.filterQuery(query)).toBeFalsy();
        });
        it('should not run queries missing a resource and a missing workspace', () => {
            const query = {
                refId: 'A',
                azureLogAnalytics: {
                    query: 'perf | take 100',
                },
            };
            expect(laDatasource.filterQuery(query)).toBeFalsy();
        });
        it('should not run traces queries missing a resource', () => {
            const query = {
                refId: 'A',
                azureTraces: {
                    resources: [],
                },
            };
            expect(laDatasource.filterQuery(query)).toBeFalsy();
        });
    });
    describe('When performing interpolateVariablesInQueries for azure_log_analytics', () => {
        beforeEach(() => {
            getTempVars = () => [];
            replace = (target) => target || '';
            ctx = createContext();
        });
        it('should return a query unchanged if no template variables are provided', () => {
            const query = createMockQuery();
            query.queryType = AzureQueryType.LogAnalytics;
            const templatedQuery = ctx.datasource.interpolateVariablesInQueries([query], {});
            expect(templatedQuery[0]).toEqual(query);
        });
        it('should return a logs query with any template variables replaced', () => {
            replace = (target) => {
                if (target === '$var') {
                    return 'template-variable';
                }
                return target || '';
            };
            ctx = createContext();
            const query = createMockQuery();
            const azureLogAnalytics = {};
            azureLogAnalytics.query = '$var';
            azureLogAnalytics.workspace = '$var';
            azureLogAnalytics.resources = ['$var'];
            query.queryType = AzureQueryType.LogAnalytics;
            query.azureLogAnalytics = Object.assign(Object.assign({}, query.azureLogAnalytics), azureLogAnalytics);
            const templatedQuery = ctx.datasource.interpolateVariablesInQueries([query], {});
            expect(templatedQuery[0]).toHaveProperty('datasource');
            expect(templatedQuery[0].azureLogAnalytics).toMatchObject({
                query: 'template-variable',
                workspace: 'template-variable',
                resources: ['template-variable'],
            });
        });
        it('should return a logs query with multiple resources template variables replaced', () => {
            replace = () => 'resource1,resource2';
            ctx = createContext();
            const query = createMockQuery();
            const azureLogAnalytics = {};
            azureLogAnalytics.resources = ['$resource'];
            query.queryType = AzureQueryType.LogAnalytics;
            query.azureLogAnalytics = Object.assign(Object.assign({}, query.azureLogAnalytics), azureLogAnalytics);
            const templatedQuery = ctx.datasource.interpolateVariablesInQueries([query], {});
            expect(templatedQuery[0]).toHaveProperty('datasource');
            expect(templatedQuery[0].azureLogAnalytics).toMatchObject({
                resources: ['resource1', 'resource2'],
            });
        });
        it('should return a traces query with any template variables replaced', () => {
            replace = (target) => (target === '$var' ? 'template-variable' : target || '');
            ctx = createContext();
            const query = createMockQuery();
            const azureTraces = {};
            azureTraces.resources = ['$var'];
            azureTraces.query = '$var';
            azureTraces.traceTypes = ['$var'];
            azureTraces.filters = [{ filters: ['$var'], operation: 'eq', property: '$var' }];
            azureTraces.operationId = '$var';
            query.queryType = AzureQueryType.AzureTraces;
            query.azureTraces = Object.assign(Object.assign({}, query.azureTraces), azureTraces);
            const templatedQuery = ctx.datasource.interpolateVariablesInQueries([query], {});
            expect(templatedQuery[0]).toHaveProperty('datasource');
            expect(templatedQuery[0].azureTraces).toMatchObject({
                query: 'template-variable',
                resources: ['template-variable'],
                operationId: 'template-variable',
                traceTypes: ['template-variable'],
                filters: [
                    {
                        filters: ['template-variable'],
                        operation: 'eq',
                        property: 'template-variable',
                    },
                ],
            });
        });
        it('should return a trace query with multiple resources template variables replaced', () => {
            replace = () => 'resource1,resource2';
            ctx = createContext();
            const query = createMockQuery();
            const azureTraces = {};
            azureTraces.resources = ['$resource'];
            query.queryType = AzureQueryType.AzureTraces;
            query.azureTraces = Object.assign(Object.assign({}, query.azureTraces), azureTraces);
            const templatedQuery = ctx.datasource.interpolateVariablesInQueries([query], {});
            expect(templatedQuery[0]).toHaveProperty('datasource');
            expect(templatedQuery[0].azureTraces).toMatchObject({
                resources: ['resource1', 'resource2'],
            });
        });
    });
});
//# sourceMappingURL=azure_log_analytics_datasource.test.js.map