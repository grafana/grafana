import { __assign, __awaiter, __generator } from "tslib";
import AzureMonitorDatasource from '../datasource';
import AzureLogAnalyticsDatasource from './azure_log_analytics_datasource';
import FakeSchemaData from './__mocks__/schema';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { toUtc } from '@grafana/data';
var templateSrv = new TemplateSrv();
jest.mock('app/core/services/backend_srv');
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getTemplateSrv: function () { return templateSrv; } })); });
var makeResourceURI = function (resourceName, resourceGroup, subscriptionID) {
    if (resourceGroup === void 0) { resourceGroup = 'test-resource-group'; }
    if (subscriptionID === void 0) { subscriptionID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'; }
    return "/subscriptions/" + subscriptionID + "/resourceGroups/" + resourceGroup + "/providers/Microsoft.OperationalInsights/workspaces/" + resourceName;
};
describe('AzureLogAnalyticsDatasource', function () {
    var ctx = {};
    beforeEach(function () {
        ctx.instanceSettings = {
            jsonData: { subscriptionId: 'xxx' },
            url: 'http://azureloganalyticsapi',
        };
        ctx.ds = new AzureMonitorDatasource(ctx.instanceSettings);
    });
    describe('When performing testDatasource', function () {
        beforeEach(function () {
            ctx.instanceSettings.jsonData.azureAuthType = 'msi';
        });
        describe('and an error is returned', function () {
            var error = {
                data: {
                    error: {
                        code: 'InvalidApiVersionParameter',
                        message: "An error message.",
                    },
                },
                status: 400,
                statusText: 'Bad Request',
            };
            beforeEach(function () {
                ctx.ds.azureLogAnalyticsDatasource.getResource = jest.fn().mockRejectedValue(error);
            });
            it('should return error status and a detailed error message', function () {
                return ctx.ds.azureLogAnalyticsDatasource.testDatasource().then(function (result) {
                    expect(result.status).toEqual('error');
                    expect(result.message).toEqual('Azure Log Analytics requires access to Azure Monitor but had the following error: Bad Request: InvalidApiVersionParameter. An error message.');
                });
            });
        });
        it('should not include double slashes when getting the resource', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ctx.ds.azureLogAnalyticsDatasource.firstWorkspace = '/foo/bar';
                        ctx.ds.azureLogAnalyticsDatasource.getResource = jest.fn().mockResolvedValue(true);
                        return [4 /*yield*/, ctx.ds.azureLogAnalyticsDatasource.testDatasource()];
                    case 1:
                        _a.sent();
                        expect(ctx.ds.azureLogAnalyticsDatasource.getResource).toHaveBeenCalledWith('loganalytics/v1/foo/bar/metadata');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When performing getSchema', function () {
        beforeEach(function () {
            ctx.ds.azureLogAnalyticsDatasource.getResource = jest.fn().mockImplementation(function (path) {
                expect(path).toContain('metadata');
                return Promise.resolve(FakeSchemaData.getlogAnalyticsFakeMetadata());
            });
        });
        it('should return a schema to use with monaco-kusto', function () { return __awaiter(void 0, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, ctx.ds.azureLogAnalyticsDatasource.getKustoSchema('myWorkspace')];
                    case 1:
                        result = _a.sent();
                        expect(result.database.tables).toHaveLength(2);
                        expect(result.database.tables[0].name).toBe('Alert');
                        expect(result.database.tables[0].timespanColumn).toBe('TimeGenerated');
                        expect(result.database.tables[1].name).toBe('AzureActivity');
                        expect(result.database.tables[0].columns).toHaveLength(69);
                        expect(result.database.functions[1].inputParameters).toEqual([
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
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When performing metricFindQuery', function () {
        var queryResults;
        var workspacesResponse = {
            value: [
                {
                    name: 'workspace1',
                    id: makeResourceURI('workspace-1'),
                    properties: {
                        customerId: 'eeee4fde-1aaa-4d60-9974-eeee562ffaa1',
                    },
                },
                {
                    name: 'workspace2',
                    id: makeResourceURI('workspace-2'),
                    properties: {
                        customerId: 'eeee4fde-1aaa-4d60-9974-eeee562ffaa2',
                    },
                },
            ],
        };
        describe('and is the workspaces() macro', function () {
            beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ctx.ds.azureLogAnalyticsDatasource.getResource = jest.fn().mockImplementation(function (path) {
                                expect(path).toContain('xxx');
                                return Promise.resolve(workspacesResponse);
                            });
                            return [4 /*yield*/, ctx.ds.metricFindQuery('workspaces()')];
                        case 1:
                            queryResults = _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should return a list of workspaces', function () {
                expect(queryResults).toEqual([
                    { text: 'workspace1', value: makeResourceURI('workspace-1') },
                    { text: 'workspace2', value: makeResourceURI('workspace-2') },
                ]);
            });
        });
        describe('and is the workspaces() macro with the subscription parameter', function () {
            beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ctx.ds.azureLogAnalyticsDatasource.getResource = jest.fn().mockImplementation(function (path) {
                                expect(path).toContain('11112222-eeee-4949-9b2d-9106972f9123');
                                return Promise.resolve(workspacesResponse);
                            });
                            return [4 /*yield*/, ctx.ds.metricFindQuery('workspaces(11112222-eeee-4949-9b2d-9106972f9123)')];
                        case 1:
                            queryResults = _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should return a list of workspaces', function () {
                expect(queryResults).toEqual([
                    { text: 'workspace1', value: makeResourceURI('workspace-1') },
                    { text: 'workspace2', value: makeResourceURI('workspace-2') },
                ]);
            });
        });
        describe('and is the workspaces() macro with the subscription parameter quoted', function () {
            beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ctx.ds.azureLogAnalyticsDatasource.getResource = jest.fn().mockImplementation(function (path) {
                                expect(path).toContain('11112222-eeee-4949-9b2d-9106972f9123');
                                return Promise.resolve(workspacesResponse);
                            });
                            return [4 /*yield*/, ctx.ds.metricFindQuery('workspaces("11112222-eeee-4949-9b2d-9106972f9123")')];
                        case 1:
                            queryResults = _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should return a list of workspaces', function () {
                expect(queryResults).toEqual([
                    { text: 'workspace1', value: makeResourceURI('workspace-1') },
                    { text: 'workspace2', value: makeResourceURI('workspace-2') },
                ]);
            });
        });
        describe('and is a custom query', function () {
            var tableResponseWithOneColumn = {
                tables: [
                    {
                        name: 'PrimaryResult',
                        columns: [
                            {
                                name: 'Category',
                                type: 'string',
                            },
                        ],
                        rows: [['Administrative'], ['Policy']],
                    },
                ],
            };
            var workspaceResponse = {
                value: [
                    {
                        name: 'aworkspace',
                        id: makeResourceURI('a-workspace'),
                        properties: {
                            source: 'Azure',
                            customerId: 'abc1b44e-3e57-4410-b027-6cc0ae6dee67',
                        },
                    },
                ],
            };
            beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    ctx.ds.azureLogAnalyticsDatasource.getResource = jest.fn().mockImplementation(function (path) {
                        if (path.indexOf('OperationalInsights/workspaces?api-version=') > -1) {
                            return Promise.resolve(workspaceResponse);
                        }
                        else {
                            return Promise.resolve(tableResponseWithOneColumn);
                        }
                    });
                    return [2 /*return*/];
                });
            }); });
            it('should return a list of categories in the correct format', function () { return __awaiter(void 0, void 0, void 0, function () {
                var results;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ds.metricFindQuery('workspace("aworkspace").AzureActivity  | distinct Category')];
                        case 1:
                            results = _a.sent();
                            expect(results.length).toBe(2);
                            expect(results[0].text).toBe('Administrative');
                            expect(results[0].value).toBe('Administrative');
                            expect(results[1].text).toBe('Policy');
                            expect(results[1].value).toBe('Policy');
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and contain options', function () {
            var queryResponse = {
                tables: [],
            };
            it('should substitute macros', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ctx.ds.azureLogAnalyticsDatasource.getResource = jest.fn().mockImplementation(function (path) {
                                var params = new URLSearchParams(path.split('?')[1]);
                                var query = params.get('query');
                                expect(query).toEqual('Perf| where TimeGenerated >= datetime(2021-01-01T05:01:00.000Z) and TimeGenerated <= datetime(2021-01-01T05:02:00.000Z)');
                                return Promise.resolve(queryResponse);
                            });
                            ctx.ds.azureLogAnalyticsDatasource.firstWorkspace = 'foo';
                            return [4 /*yield*/, ctx.ds.metricFindQuery('Perf| where TimeGenerated >= $__timeFrom() and TimeGenerated <= $__timeTo()', {
                                    range: {
                                        from: new Date('2021-01-01 00:01:00'),
                                        to: new Date('2021-01-01 00:02:00'),
                                    },
                                })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
    describe('When performing annotationQuery', function () {
        var tableResponse = {
            tables: [
                {
                    name: 'PrimaryResult',
                    columns: [
                        {
                            name: 'TimeGenerated',
                            type: 'datetime',
                        },
                        {
                            name: 'Text',
                            type: 'string',
                        },
                        {
                            name: 'Tags',
                            type: 'string',
                        },
                    ],
                    rows: [
                        ['2018-06-02T20:20:00Z', 'Computer1', 'tag1,tag2'],
                        ['2018-06-02T20:28:00Z', 'Computer2', 'tag2'],
                    ],
                },
            ],
        };
        var workspaceResponse = {
            value: [
                {
                    name: 'aworkspace',
                    id: makeResourceURI('a-workspace'),
                    properties: {
                        source: 'Azure',
                        customerId: 'abc1b44e-3e57-4410-b027-6cc0ae6dee67',
                    },
                },
            ],
        };
        var annotationResults;
        beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ctx.ds.azureLogAnalyticsDatasource.getResource = jest.fn().mockImplementation(function (path) {
                            if (path.indexOf('Microsoft.OperationalInsights/workspaces') > -1) {
                                return Promise.resolve(workspaceResponse);
                            }
                            else {
                                return Promise.resolve(tableResponse);
                            }
                        });
                        return [4 /*yield*/, ctx.ds.annotationQuery({
                                annotation: {
                                    rawQuery: 'Heartbeat | where $__timeFilter()| project TimeGenerated, Text=Computer, tags="test"',
                                    workspace: 'abc1b44e-3e57-4410-b027-6cc0ae6dee67',
                                },
                                range: {
                                    from: toUtc('2017-08-22T20:00:00Z'),
                                    to: toUtc('2017-08-22T23:59:00Z'),
                                },
                                rangeRaw: {
                                    from: 'now-4h',
                                    to: 'now',
                                },
                            })];
                    case 1:
                        annotationResults = _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should return a list of categories in the correct format', function () {
            expect(annotationResults.length).toBe(2);
            expect(annotationResults[0].time).toBe(1527970800000);
            expect(annotationResults[0].text).toBe('Computer1');
            expect(annotationResults[0].tags[0]).toBe('tag1');
            expect(annotationResults[0].tags[1]).toBe('tag2');
            expect(annotationResults[1].time).toBe(1527971280000);
            expect(annotationResults[1].text).toBe('Computer2');
            expect(annotationResults[1].tags[0]).toBe('tag2');
        });
    });
    describe('When performing getWorkspaces', function () {
        beforeEach(function () {
            ctx.ds.azureLogAnalyticsDatasource.getWorkspaceList = jest
                .fn()
                .mockResolvedValue({ value: [{ name: 'foobar', id: 'foo', properties: { customerId: 'bar' } }] });
        });
        it('should return the workspace id', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workspaces;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, ctx.ds.azureLogAnalyticsDatasource.getWorkspaces('sub')];
                    case 1:
                        workspaces = _a.sent();
                        expect(workspaces).toEqual([{ text: 'foobar', value: 'foo' }]);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When performing getFirstWorkspace', function () {
        beforeEach(function () {
            ctx.ds.azureLogAnalyticsDatasource.getDefaultOrFirstSubscription = jest.fn().mockResolvedValue('foo');
            ctx.ds.azureLogAnalyticsDatasource.getWorkspaces = jest
                .fn()
                .mockResolvedValue([{ text: 'foobar', value: 'foo' }]);
            ctx.ds.azureLogAnalyticsDatasource.firstWorkspace = undefined;
        });
        it('should return the stored workspace', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workspace;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ctx.ds.azureLogAnalyticsDatasource.firstWorkspace = 'bar';
                        return [4 /*yield*/, ctx.ds.azureLogAnalyticsDatasource.getFirstWorkspace()];
                    case 1:
                        workspace = _a.sent();
                        expect(workspace).toEqual('bar');
                        expect(ctx.ds.azureLogAnalyticsDatasource.getDefaultOrFirstSubscription).not.toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should return the first workspace', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workspace;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, ctx.ds.azureLogAnalyticsDatasource.getFirstWorkspace()];
                    case 1:
                        workspace = _a.sent();
                        expect(workspace).toEqual('foo');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('When performing filterQuery', function () {
        var ctx = {};
        var laDatasource;
        beforeEach(function () {
            ctx.instanceSettings = {
                jsonData: { subscriptionId: 'xxx' },
                url: 'http://azureloganalyticsapi',
            };
            laDatasource = new AzureLogAnalyticsDatasource(ctx.instanceSettings);
        });
        it('should run complete queries', function () {
            var query = {
                refId: 'A',
                azureLogAnalytics: {
                    resource: '/sub/124/rg/cloud/vm/server',
                    query: 'perf | take 100',
                },
            };
            expect(laDatasource.filterQuery(query)).toBeTruthy();
        });
        it('should not run empty queries', function () {
            var query = {
                refId: 'A',
            };
            expect(laDatasource.filterQuery(query)).toBeFalsy();
        });
        it('should not run hidden queries', function () {
            var query = {
                refId: 'A',
                hide: true,
                azureLogAnalytics: {
                    resource: '/sub/124/rg/cloud/vm/server',
                    query: 'perf | take 100',
                },
            };
            expect(laDatasource.filterQuery(query)).toBeFalsy();
        });
        it('should not run queries missing a kusto query', function () {
            var query = {
                refId: 'A',
                azureLogAnalytics: {
                    resource: '/sub/124/rg/cloud/vm/server',
                },
            };
            expect(laDatasource.filterQuery(query)).toBeFalsy();
        });
        it('should not run queries missing a resource', function () {
            var query = {
                refId: 'A',
                azureLogAnalytics: {
                    query: 'perf | take 100',
                },
            };
            expect(laDatasource.filterQuery(query)).toBeFalsy();
        });
    });
});
//# sourceMappingURL=azure_log_analytics_datasource.test.js.map