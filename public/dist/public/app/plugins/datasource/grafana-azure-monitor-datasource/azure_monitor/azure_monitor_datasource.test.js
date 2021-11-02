import { __assign, __awaiter, __generator } from "tslib";
import AzureMonitorDatasource from '../datasource';
import { TemplateSrv } from 'app/features/templating/template_srv';
var templateSrv = new TemplateSrv();
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getTemplateSrv: function () { return templateSrv; } })); });
describe('AzureMonitorDatasource', function () {
    var ctx = {};
    beforeEach(function () {
        jest.clearAllMocks();
        ctx.instanceSettings = {
            name: 'test',
            url: 'http://azuremonitor.com',
            jsonData: { subscriptionId: '9935389e-9122-4ef9-95f9-1513dd24753f', cloudName: 'azuremonitor' },
        };
        ctx.ds = new AzureMonitorDatasource(ctx.instanceSettings);
    });
    describe('When performing testDatasource', function () {
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
                ctx.instanceSettings.jsonData.azureAuthType = 'msi';
                ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockRejectedValue(error);
            });
            it('should return error status and a detailed error message', function () {
                return ctx.ds.azureMonitorDatasource.testDatasource().then(function (result) {
                    expect(result.status).toEqual('error');
                    expect(result.message).toEqual('Azure Monitor: Bad Request: InvalidApiVersionParameter. An error message.');
                });
            });
        });
        describe('and a list of resource groups is returned', function () {
            var response = {
                value: [{ name: 'grp1' }, { name: 'grp2' }],
            };
            beforeEach(function () {
                ctx.instanceSettings.jsonData.tenantId = 'xxx';
                ctx.instanceSettings.jsonData.clientId = 'xxx';
                ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockResolvedValue({ data: response, status: 200 });
            });
            it('should return success status', function () {
                return ctx.ds.azureMonitorDatasource.testDatasource().then(function (result) {
                    expect(result.status).toEqual('success');
                });
            });
        });
    });
    describe('When performing metricFindQuery', function () {
        describe('with a subscriptions query', function () {
            var response = {
                value: [
                    { displayName: 'Primary', subscriptionId: 'sub1' },
                    { displayName: 'Secondary', subscriptionId: 'sub2' },
                ],
            };
            beforeEach(function () {
                ctx.instanceSettings.jsonData.azureAuthType = 'msi';
                ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockResolvedValue(response);
            });
            it('should return a list of subscriptions', function () { return __awaiter(void 0, void 0, void 0, function () {
                var results;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ds.metricFindQuery('subscriptions()')];
                        case 1:
                            results = _a.sent();
                            expect(results.length).toBe(2);
                            expect(results[0].text).toBe('Primary');
                            expect(results[0].value).toBe('sub1');
                            expect(results[1].text).toBe('Secondary');
                            expect(results[1].value).toBe('sub2');
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('with a resource groups query', function () {
            var response = {
                value: [{ name: 'grp1' }, { name: 'grp2' }],
            };
            beforeEach(function () {
                ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockResolvedValue(response);
            });
            it('should return a list of resource groups', function () { return __awaiter(void 0, void 0, void 0, function () {
                var results;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ds.metricFindQuery('ResourceGroups()')];
                        case 1:
                            results = _a.sent();
                            expect(results.length).toBe(2);
                            expect(results[0].text).toBe('grp1');
                            expect(results[0].value).toBe('grp1');
                            expect(results[1].text).toBe('grp2');
                            expect(results[1].value).toBe('grp2');
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('with a resource groups query that specifies a subscription id', function () {
            var response = {
                value: [{ name: 'grp1' }, { name: 'grp2' }],
            };
            beforeEach(function () {
                ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation(function (path) {
                    expect(path).toContain('11112222-eeee-4949-9b2d-9106972f9123');
                    return Promise.resolve(response);
                });
            });
            it('should return a list of resource groups', function () { return __awaiter(void 0, void 0, void 0, function () {
                var results;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ds.metricFindQuery('ResourceGroups(11112222-eeee-4949-9b2d-9106972f9123)')];
                        case 1:
                            results = _a.sent();
                            expect(results.length).toBe(2);
                            expect(results[0].text).toBe('grp1');
                            expect(results[0].value).toBe('grp1');
                            expect(results[1].text).toBe('grp2');
                            expect(results[1].value).toBe('grp2');
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('with namespaces query', function () {
            var response = {
                value: [
                    {
                        name: 'test',
                        type: 'Microsoft.Network/networkInterfaces',
                    },
                ],
            };
            beforeEach(function () {
                ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation(function (path) {
                    var basePath = 'azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups';
                    expect(path).toBe(basePath + '/nodesapp/resources?api-version=2018-01-01');
                    return Promise.resolve(response);
                });
            });
            it('should return a list of namespaces', function () { return __awaiter(void 0, void 0, void 0, function () {
                var results;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ds.metricFindQuery('Namespaces(nodesapp)')];
                        case 1:
                            results = _a.sent();
                            expect(results.length).toEqual(1);
                            expect(results[0].text).toEqual('Network interface');
                            expect(results[0].value).toEqual('Microsoft.Network/networkInterfaces');
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('with namespaces query that specifies a subscription id', function () {
            var response = {
                value: [
                    {
                        name: 'test',
                        type: 'Microsoft.Network/networkInterfaces',
                    },
                ],
            };
            beforeEach(function () {
                ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation(function (path) {
                    var basePath = 'azuremonitor/subscriptions/11112222-eeee-4949-9b2d-9106972f9123/resourceGroups';
                    expect(path).toBe(basePath + '/nodesapp/resources?api-version=2018-01-01');
                    return Promise.resolve(response);
                });
            });
            it('should return a list of namespaces', function () { return __awaiter(void 0, void 0, void 0, function () {
                var results;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ds.metricFindQuery('namespaces(11112222-eeee-4949-9b2d-9106972f9123, nodesapp)')];
                        case 1:
                            results = _a.sent();
                            expect(results.length).toEqual(1);
                            expect(results[0].text).toEqual('Network interface');
                            expect(results[0].value).toEqual('Microsoft.Network/networkInterfaces');
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('with resource names query', function () {
            var response = {
                value: [
                    {
                        name: 'Failure Anomalies - nodeapp',
                        type: 'microsoft.insights/alertrules',
                    },
                    {
                        name: 'nodeapp',
                        type: 'microsoft.insights/components',
                    },
                ],
            };
            beforeEach(function () {
                ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation(function (path) {
                    var basePath = 'azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups';
                    expect(path).toBe(basePath + '/nodeapp/resources?api-version=2018-01-01');
                    return Promise.resolve(response);
                });
            });
            it('should return a list of resource names', function () { return __awaiter(void 0, void 0, void 0, function () {
                var results;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ds.metricFindQuery('resourceNames(nodeapp, microsoft.insights/components )')];
                        case 1:
                            results = _a.sent();
                            expect(results.length).toEqual(1);
                            expect(results[0].text).toEqual('nodeapp');
                            expect(results[0].value).toEqual('nodeapp');
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('with resource names query and that specifies a subscription id', function () {
            var response = {
                value: [
                    {
                        name: 'Failure Anomalies - nodeapp',
                        type: 'microsoft.insights/alertrules',
                    },
                    {
                        name: 'nodeapp',
                        type: 'microsoft.insights/components',
                    },
                ],
            };
            beforeEach(function () {
                ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation(function (path) {
                    var basePath = 'azuremonitor/subscriptions/11112222-eeee-4949-9b2d-9106972f9123/resourceGroups';
                    expect(path).toBe(basePath + '/nodeapp/resources?api-version=2018-01-01');
                    return Promise.resolve(response);
                });
            });
            it('should return a list of resource names', function () {
                return ctx.ds
                    .metricFindQuery('resourceNames(11112222-eeee-4949-9b2d-9106972f9123, nodeapp, microsoft.insights/components )')
                    .then(function (results) {
                    expect(results.length).toEqual(1);
                    expect(results[0].text).toEqual('nodeapp');
                    expect(results[0].value).toEqual('nodeapp');
                });
            });
        });
        describe('with metric names query', function () {
            var response = {
                value: [
                    {
                        name: {
                            value: 'Percentage CPU',
                            localizedValue: 'Percentage CPU',
                        },
                    },
                    {
                        name: {
                            value: 'UsedCapacity',
                            localizedValue: 'Used capacity',
                        },
                    },
                ],
            };
            beforeEach(function () {
                ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation(function (path) {
                    var basePath = 'azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups';
                    expect(path).toBe(basePath +
                        '/nodeapp/providers/microsoft.insights/components/rn/providers/microsoft.insights/' +
                        'metricdefinitions?api-version=2018-01-01&metricnamespace=default');
                    return Promise.resolve(response);
                });
            });
            it('should return a list of metric names', function () { return __awaiter(void 0, void 0, void 0, function () {
                var results;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ds.metricFindQuery('Metricnames(nodeapp, microsoft.insights/components, rn, default)')];
                        case 1:
                            results = _a.sent();
                            expect(results.length).toEqual(2);
                            expect(results[0].text).toEqual('Percentage CPU');
                            expect(results[0].value).toEqual('Percentage CPU');
                            expect(results[1].text).toEqual('Used capacity');
                            expect(results[1].value).toEqual('UsedCapacity');
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('with metric names query and specifies a subscription id', function () {
            var response = {
                value: [
                    {
                        name: {
                            value: 'Percentage CPU',
                            localizedValue: 'Percentage CPU',
                        },
                    },
                    {
                        name: {
                            value: 'UsedCapacity',
                            localizedValue: 'Used capacity',
                        },
                    },
                ],
            };
            beforeEach(function () {
                ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation(function (path) {
                    var basePath = 'azuremonitor/subscriptions/11112222-eeee-4949-9b2d-9106972f9123/resourceGroups';
                    expect(path).toBe(basePath +
                        '/nodeapp/providers/microsoft.insights/components/rn/providers/microsoft.insights/' +
                        'metricdefinitions?api-version=2018-01-01&metricnamespace=default');
                    return Promise.resolve(response);
                });
            });
            it('should return a list of metric names', function () { return __awaiter(void 0, void 0, void 0, function () {
                var results;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ds.metricFindQuery('Metricnames(11112222-eeee-4949-9b2d-9106972f9123, nodeapp, microsoft.insights/components, rn, default)')];
                        case 1:
                            results = _a.sent();
                            expect(results.length).toEqual(2);
                            expect(results[0].text).toEqual('Percentage CPU');
                            expect(results[0].value).toEqual('Percentage CPU');
                            expect(results[1].text).toEqual('Used capacity');
                            expect(results[1].value).toEqual('UsedCapacity');
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('with metric namespace query', function () {
            var response = {
                value: [
                    {
                        name: 'Microsoft.Compute-virtualMachines',
                        properties: {
                            metricNamespaceName: 'Microsoft.Compute/virtualMachines',
                        },
                    },
                    {
                        name: 'Telegraf-mem',
                        properties: {
                            metricNamespaceName: 'Telegraf/mem',
                        },
                    },
                ],
            };
            beforeEach(function () {
                ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation(function (path) {
                    var basePath = 'azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups';
                    expect(path).toBe(basePath +
                        '/nodeapp/providers/Microsoft.Compute/virtualMachines/rn/providers/microsoft.insights/metricNamespaces?api-version=2017-12-01-preview');
                    return Promise.resolve(response);
                });
            });
            it('should return a list of metric names', function () { return __awaiter(void 0, void 0, void 0, function () {
                var results;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ds.metricFindQuery('Metricnamespace(nodeapp, Microsoft.Compute/virtualMachines, rn)')];
                        case 1:
                            results = _a.sent();
                            expect(results.length).toEqual(2);
                            expect(results[0].text).toEqual('Microsoft.Compute-virtualMachines');
                            expect(results[0].value).toEqual('Microsoft.Compute/virtualMachines');
                            expect(results[1].text).toEqual('Telegraf-mem');
                            expect(results[1].value).toEqual('Telegraf/mem');
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('with metric namespace query and specifies a subscription id', function () {
            var response = {
                value: [
                    {
                        name: 'Microsoft.Compute-virtualMachines',
                        properties: {
                            metricNamespaceName: 'Microsoft.Compute/virtualMachines',
                        },
                    },
                    {
                        name: 'Telegraf-mem',
                        properties: {
                            metricNamespaceName: 'Telegraf/mem',
                        },
                    },
                ],
            };
            beforeEach(function () {
                ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation(function (path) {
                    var basePath = 'azuremonitor/subscriptions/11112222-eeee-4949-9b2d-9106972f9123/resourceGroups';
                    expect(path).toBe(basePath +
                        '/nodeapp/providers/Microsoft.Compute/virtualMachines/rn/providers/microsoft.insights/metricNamespaces?api-version=2017-12-01-preview');
                    return Promise.resolve(response);
                });
            });
            it('should return a list of metric namespaces', function () { return __awaiter(void 0, void 0, void 0, function () {
                var results;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ds.metricFindQuery('Metricnamespace(11112222-eeee-4949-9b2d-9106972f9123, nodeapp, Microsoft.Compute/virtualMachines, rn)')];
                        case 1:
                            results = _a.sent();
                            expect(results.length).toEqual(2);
                            expect(results[0].text).toEqual('Microsoft.Compute-virtualMachines');
                            expect(results[0].value).toEqual('Microsoft.Compute/virtualMachines');
                            expect(results[1].text).toEqual('Telegraf-mem');
                            expect(results[1].value).toEqual('Telegraf/mem');
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
    describe('When performing getSubscriptions', function () {
        var response = {
            value: [
                {
                    id: '/subscriptions/99999999-cccc-bbbb-aaaa-9106972f9572',
                    subscriptionId: '99999999-cccc-bbbb-aaaa-9106972f9572',
                    tenantId: '99999999-aaaa-bbbb-cccc-51c4f982ec48',
                    displayName: 'Primary Subscription',
                    state: 'Enabled',
                    subscriptionPolicies: {
                        locationPlacementId: 'Public_2014-09-01',
                        quotaId: 'PayAsYouGo_2014-09-01',
                        spendingLimit: 'Off',
                    },
                    authorizationSource: 'RoleBased',
                },
            ],
            count: {
                type: 'Total',
                value: 1,
            },
        };
        beforeEach(function () {
            ctx.instanceSettings.jsonData.azureAuthType = 'msi';
            ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockResolvedValue(response);
        });
        it('should return list of subscriptions', function () {
            return ctx.ds.getSubscriptions().then(function (results) {
                expect(results.length).toEqual(1);
                expect(results[0].text).toEqual('Primary Subscription');
                expect(results[0].value).toEqual('99999999-cccc-bbbb-aaaa-9106972f9572');
            });
        });
    });
    describe('When performing getResourceGroups', function () {
        var response = {
            value: [{ name: 'grp1' }, { name: 'grp2' }],
        };
        beforeEach(function () {
            ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockResolvedValue(response);
        });
        it('should return list of Resource Groups', function () {
            return ctx.ds.getResourceGroups('subscriptionId').then(function (results) {
                expect(results.length).toEqual(2);
                expect(results[0].text).toEqual('grp1');
                expect(results[0].value).toEqual('grp1');
                expect(results[1].text).toEqual('grp2');
                expect(results[1].value).toEqual('grp2');
            });
        });
    });
    describe('When performing getMetricDefinitions', function () {
        var response = {
            value: [
                {
                    name: 'test',
                    type: 'Microsoft.Network/networkInterfaces',
                },
                {
                    location: 'northeurope',
                    name: 'northeur',
                    type: 'Microsoft.Compute/virtualMachines',
                },
                {
                    location: 'westcentralus',
                    name: 'us',
                    type: 'Microsoft.Compute/virtualMachines',
                },
                {
                    name: 'IHaveNoMetrics',
                    type: 'IShouldBeFilteredOut',
                },
                {
                    name: 'storageTest',
                    type: 'Microsoft.Storage/storageAccounts',
                },
            ],
        };
        beforeEach(function () {
            ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation(function (path) {
                var basePath = 'azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups';
                expect(path).toBe(basePath + '/nodesapp/resources?api-version=2018-01-01');
                return Promise.resolve(response);
            });
        });
        it('should return list of Metric Definitions with no duplicates and no unsupported namespaces', function () {
            return ctx.ds
                .getMetricDefinitions('9935389e-9122-4ef9-95f9-1513dd24753f', 'nodesapp')
                .then(function (results) {
                expect(results.length).toEqual(7);
                expect(results[0].text).toEqual('Network interface');
                expect(results[0].value).toEqual('Microsoft.Network/networkInterfaces');
                expect(results[1].text).toEqual('Virtual machine');
                expect(results[1].value).toEqual('Microsoft.Compute/virtualMachines');
                expect(results[2].text).toEqual('Storage account');
                expect(results[2].value).toEqual('Microsoft.Storage/storageAccounts');
                expect(results[3].text).toEqual('Microsoft.Storage/storageAccounts/blobServices');
                expect(results[3].value).toEqual('Microsoft.Storage/storageAccounts/blobServices');
                expect(results[4].text).toEqual('Microsoft.Storage/storageAccounts/fileServices');
                expect(results[4].value).toEqual('Microsoft.Storage/storageAccounts/fileServices');
                expect(results[5].text).toEqual('Microsoft.Storage/storageAccounts/tableServices');
                expect(results[5].value).toEqual('Microsoft.Storage/storageAccounts/tableServices');
                expect(results[6].text).toEqual('Microsoft.Storage/storageAccounts/queueServices');
                expect(results[6].value).toEqual('Microsoft.Storage/storageAccounts/queueServices');
            });
        });
    });
    describe('When performing getResourceNames', function () {
        describe('and there are no special cases', function () {
            var response = {
                value: [
                    {
                        name: 'Failure Anomalies - nodeapp',
                        type: 'microsoft.insights/alertrules',
                    },
                    {
                        name: 'nodeapp',
                        type: 'microsoft.insights/components',
                    },
                ],
            };
            beforeEach(function () {
                ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation(function (path) {
                    var basePath = 'azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups';
                    expect(path).toBe(basePath + '/nodeapp/resources?api-version=2018-01-01');
                    return Promise.resolve(response);
                });
            });
            it('should return list of Resource Names', function () {
                return ctx.ds
                    .getResourceNames('9935389e-9122-4ef9-95f9-1513dd24753f', 'nodeapp', 'microsoft.insights/components')
                    .then(function (results) {
                    expect(results.length).toEqual(1);
                    expect(results[0].text).toEqual('nodeapp');
                    expect(results[0].value).toEqual('nodeapp');
                });
            });
            it('should return ignore letter case', function () {
                return ctx.ds
                    .getResourceNames('9935389e-9122-4ef9-95f9-1513dd24753f', 'nodeapp', 'microsoft.insights/Components')
                    .then(function (results) {
                    expect(results.length).toEqual(1);
                    expect(results[0].text).toEqual('nodeapp');
                    expect(results[0].value).toEqual('nodeapp');
                });
            });
        });
        describe('and the metric definition is blobServices', function () {
            var response = {
                value: [
                    {
                        name: 'Failure Anomalies - nodeapp',
                        type: 'microsoft.insights/alertrules',
                    },
                    {
                        name: 'storagetest',
                        type: 'Microsoft.Storage/storageAccounts',
                    },
                ],
            };
            beforeEach(function () {
                ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation(function (path) {
                    var basePath = 'azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups';
                    expect(path).toBe(basePath + '/nodeapp/resources?api-version=2018-01-01');
                    return Promise.resolve(response);
                });
            });
            it('should return list of Resource Names', function () {
                return ctx.ds
                    .getResourceNames('9935389e-9122-4ef9-95f9-1513dd24753f', 'nodeapp', 'Microsoft.Storage/storageAccounts/blobServices')
                    .then(function (results) {
                    expect(results.length).toEqual(1);
                    expect(results[0].text).toEqual('storagetest/default');
                    expect(results[0].value).toEqual('storagetest/default');
                });
            });
        });
    });
    describe('When performing getMetricNames', function () {
        var response = {
            value: [
                {
                    name: {
                        value: 'UsedCapacity',
                        localizedValue: 'Used capacity',
                    },
                    unit: 'CountPerSecond',
                    primaryAggregationType: 'Total',
                    supportedAggregationTypes: ['None', 'Average', 'Minimum', 'Maximum', 'Total', 'Count'],
                    metricAvailabilities: [
                        { timeGrain: 'PT1H', retention: 'P93D' },
                        { timeGrain: 'PT6H', retention: 'P93D' },
                        { timeGrain: 'PT12H', retention: 'P93D' },
                        { timeGrain: 'P1D', retention: 'P93D' },
                    ],
                },
                {
                    name: {
                        value: 'FreeCapacity',
                        localizedValue: 'Free capacity',
                    },
                    unit: 'CountPerSecond',
                    primaryAggregationType: 'Average',
                    supportedAggregationTypes: ['None', 'Average'],
                    metricAvailabilities: [
                        { timeGrain: 'PT1H', retention: 'P93D' },
                        { timeGrain: 'PT6H', retention: 'P93D' },
                        { timeGrain: 'PT12H', retention: 'P93D' },
                        { timeGrain: 'P1D', retention: 'P93D' },
                    ],
                },
            ],
        };
        beforeEach(function () {
            ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation(function (path) {
                var basePath = 'azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups/nodeapp';
                var expected = basePath +
                    '/providers/microsoft.insights/components/resource1' +
                    '/providers/microsoft.insights/metricdefinitions?api-version=2018-01-01&metricnamespace=default';
                expect(path).toBe(expected);
                return Promise.resolve(response);
            });
        });
        it('should return list of Metric Definitions', function () {
            return ctx.ds
                .getMetricNames('9935389e-9122-4ef9-95f9-1513dd24753f', 'nodeapp', 'microsoft.insights/components', 'resource1', 'default')
                .then(function (results) {
                expect(results.length).toEqual(2);
                expect(results[0].text).toEqual('Used capacity');
                expect(results[0].value).toEqual('UsedCapacity');
                expect(results[1].text).toEqual('Free capacity');
                expect(results[1].value).toEqual('FreeCapacity');
            });
        });
    });
    describe('When performing getMetricMetadata', function () {
        var response = {
            value: [
                {
                    name: {
                        value: 'UsedCapacity',
                        localizedValue: 'Used capacity',
                    },
                    unit: 'CountPerSecond',
                    primaryAggregationType: 'Total',
                    supportedAggregationTypes: ['None', 'Average', 'Minimum', 'Maximum', 'Total', 'Count'],
                    metricAvailabilities: [
                        { timeGrain: 'PT1H', retention: 'P93D' },
                        { timeGrain: 'PT6H', retention: 'P93D' },
                        { timeGrain: 'PT12H', retention: 'P93D' },
                        { timeGrain: 'P1D', retention: 'P93D' },
                    ],
                },
                {
                    name: {
                        value: 'FreeCapacity',
                        localizedValue: 'Free capacity',
                    },
                    unit: 'CountPerSecond',
                    primaryAggregationType: 'Average',
                    supportedAggregationTypes: ['None', 'Average'],
                    metricAvailabilities: [
                        { timeGrain: 'PT1H', retention: 'P93D' },
                        { timeGrain: 'PT6H', retention: 'P93D' },
                        { timeGrain: 'PT12H', retention: 'P93D' },
                        { timeGrain: 'P1D', retention: 'P93D' },
                    ],
                },
            ],
        };
        beforeEach(function () {
            ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation(function (path) {
                var basePath = 'azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups/nodeapp';
                var expected = basePath +
                    '/providers/microsoft.insights/components/resource1' +
                    '/providers/microsoft.insights/metricdefinitions?api-version=2018-01-01&metricnamespace=default';
                expect(path).toBe(expected);
                return Promise.resolve(response);
            });
        });
        it('should return Aggregation metadata for a Metric', function () {
            return ctx.ds
                .getMetricMetadata('9935389e-9122-4ef9-95f9-1513dd24753f', 'nodeapp', 'microsoft.insights/components', 'resource1', 'default', 'UsedCapacity')
                .then(function (results) {
                expect(results.primaryAggType).toEqual('Total');
                expect(results.supportedAggTypes.length).toEqual(6);
                expect(results.supportedTimeGrains.length).toEqual(5); // 4 time grains from the API + auto
            });
        });
    });
    describe('When performing getMetricMetadata on metrics with dimensions', function () {
        var response = {
            value: [
                {
                    name: {
                        value: 'Transactions',
                        localizedValue: 'Transactions',
                    },
                    unit: 'Count',
                    primaryAggregationType: 'Total',
                    supportedAggregationTypes: ['None', 'Average', 'Minimum', 'Maximum', 'Total', 'Count'],
                    isDimensionRequired: false,
                    dimensions: [
                        {
                            value: 'ResponseType',
                            localizedValue: 'Response type',
                        },
                        {
                            value: 'GeoType',
                            localizedValue: 'Geo type',
                        },
                        {
                            value: 'ApiName',
                            localizedValue: 'API name',
                        },
                    ],
                },
                {
                    name: {
                        value: 'FreeCapacity',
                        localizedValue: 'Free capacity',
                    },
                    unit: 'CountPerSecond',
                    primaryAggregationType: 'Average',
                    supportedAggregationTypes: ['None', 'Average'],
                },
            ],
        };
        beforeEach(function () {
            ctx.ds.azureMonitorDatasource.getResource = jest.fn().mockImplementation(function (path) {
                var basePath = 'azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups/nodeapp';
                var expected = basePath +
                    '/providers/microsoft.insights/components/resource1' +
                    '/providers/microsoft.insights/metricdefinitions?api-version=2018-01-01&metricnamespace=default';
                expect(path).toBe(expected);
                return Promise.resolve(response);
            });
        });
        it('should return dimensions for a Metric that has dimensions', function () {
            return ctx.ds
                .getMetricMetadata('9935389e-9122-4ef9-95f9-1513dd24753f', 'nodeapp', 'microsoft.insights/components', 'resource1', 'default', 'Transactions')
                .then(function (results) {
                expect(results.dimensions).toMatchInlineSnapshot("\n            Array [\n              Object {\n                \"label\": \"Response type\",\n                \"value\": \"ResponseType\",\n              },\n              Object {\n                \"label\": \"Geo type\",\n                \"value\": \"GeoType\",\n              },\n              Object {\n                \"label\": \"API name\",\n                \"value\": \"ApiName\",\n              },\n            ]\n          ");
            });
        });
        it('should return an empty array for a Metric that does not have dimensions', function () {
            return ctx.ds
                .getMetricMetadata('9935389e-9122-4ef9-95f9-1513dd24753f', 'nodeapp', 'microsoft.insights/components', 'resource1', 'default', 'FreeCapacity')
                .then(function (results) {
                expect(results.dimensions.length).toEqual(0);
            });
        });
    });
});
//# sourceMappingURL=azure_monitor_datasource.test.js.map