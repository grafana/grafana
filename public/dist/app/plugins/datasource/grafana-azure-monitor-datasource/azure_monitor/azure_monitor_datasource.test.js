import AzureMonitorDatasource from '../datasource';
import Q from 'q';
import moment from 'moment';
import { TemplateSrv } from 'app/features/templating/template_srv';
describe('AzureMonitorDatasource', function () {
    var ctx = {
        backendSrv: {},
        templateSrv: new TemplateSrv(),
    };
    beforeEach(function () {
        ctx.$q = Q;
        ctx.instanceSettings = {
            url: 'http://azuremonitor.com',
            jsonData: { subscriptionId: '9935389e-9122-4ef9-95f9-1513dd24753f' },
            cloudName: 'azuremonitor',
        };
        ctx.ds = new AzureMonitorDatasource(ctx.instanceSettings, ctx.backendSrv, ctx.templateSrv, ctx.$q);
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
                ctx.instanceSettings.jsonData.tenantId = 'xxx';
                ctx.instanceSettings.jsonData.clientId = 'xxx';
                ctx.backendSrv.datasourceRequest = function (options) {
                    return ctx.$q.reject(error);
                };
            });
            it('should return error status and a detailed error message', function () {
                return ctx.ds.testDatasource().then(function (results) {
                    expect(results.status).toEqual('error');
                    expect(results.message).toEqual('1. Azure Monitor: Bad Request: InvalidApiVersionParameter. An error message. ');
                });
            });
        });
        describe('and a list of resource groups is returned', function () {
            var response = {
                data: {
                    value: [{ name: 'grp1' }, { name: 'grp2' }],
                },
                status: 200,
                statusText: 'OK',
            };
            beforeEach(function () {
                ctx.instanceSettings.jsonData.tenantId = 'xxx';
                ctx.instanceSettings.jsonData.clientId = 'xxx';
                ctx.backendSrv.datasourceRequest = function (options) {
                    return ctx.$q.when({ data: response, status: 200 });
                };
            });
            it('should return success status', function () {
                return ctx.ds.testDatasource().then(function (results) {
                    expect(results.status).toEqual('success');
                });
            });
        });
    });
    describe('When performing query', function () {
        var options = {
            range: {
                from: moment.utc('2017-08-22T20:00:00Z'),
                to: moment.utc('2017-08-22T23:59:00Z'),
            },
            targets: [
                {
                    apiVersion: '2018-01-01',
                    refId: 'A',
                    queryType: 'Azure Monitor',
                    azureMonitor: {
                        resourceGroup: 'testRG',
                        resourceName: 'testRN',
                        metricDefinition: 'Microsoft.Compute/virtualMachines',
                        metricName: 'Percentage CPU',
                        timeGrain: 'PT1H',
                        alias: '',
                    },
                },
            ],
        };
        describe('and data field is average', function () {
            var response = {
                value: [
                    {
                        timeseries: [
                            {
                                data: [
                                    {
                                        timeStamp: '2017-08-22T21:00:00Z',
                                        average: 1.0503333333333331,
                                    },
                                    {
                                        timeStamp: '2017-08-22T22:00:00Z',
                                        average: 1.045083333333333,
                                    },
                                    {
                                        timeStamp: '2017-08-22T23:00:00Z',
                                        average: 1.0457499999999995,
                                    },
                                ],
                            },
                        ],
                        id: '/subscriptions/xxx/resourceGroups/testRG/providers/Microsoft.Compute/virtualMachines' +
                            '/testRN/providers/Microsoft.Insights/metrics/Percentage CPU',
                        name: {
                            value: 'Percentage CPU',
                            localizedValue: 'Percentage CPU',
                        },
                        type: 'Microsoft.Insights/metrics',
                        unit: 'Percent',
                    },
                ],
            };
            beforeEach(function () {
                ctx.backendSrv.datasourceRequest = function (options) {
                    expect(options.url).toContain('/testRG/providers/Microsoft.Compute/virtualMachines/testRN/providers/microsoft.insights/metrics');
                    return ctx.$q.when({ data: response, status: 200 });
                };
            });
            it('should return a list of datapoints', function () {
                return ctx.ds.query(options).then(function (results) {
                    expect(results.data.length).toBe(1);
                    expect(results.data[0].target).toEqual('testRN.Percentage CPU');
                    expect(results.data[0].datapoints[0][1]).toEqual(1503435600000);
                    expect(results.data[0].datapoints[0][0]).toEqual(1.0503333333333331);
                    expect(results.data[0].datapoints[2][1]).toEqual(1503442800000);
                    expect(results.data[0].datapoints[2][0]).toEqual(1.0457499999999995);
                });
            });
        });
        describe('and data field is total', function () {
            var response = {
                value: [
                    {
                        timeseries: [
                            {
                                data: [
                                    {
                                        timeStamp: '2017-08-22T21:00:00Z',
                                        total: 1.0503333333333331,
                                    },
                                    {
                                        timeStamp: '2017-08-22T22:00:00Z',
                                        total: 1.045083333333333,
                                    },
                                    {
                                        timeStamp: '2017-08-22T23:00:00Z',
                                        total: 1.0457499999999995,
                                    },
                                ],
                            },
                        ],
                        id: '/subscriptions/xxx/resourceGroups/testRG/providers/Microsoft.Compute/virtualMachines' +
                            '/testRN/providers/Microsoft.Insights/metrics/Percentage CPU',
                        name: {
                            value: 'Percentage CPU',
                            localizedValue: 'Percentage CPU',
                        },
                        type: 'Microsoft.Insights/metrics',
                        unit: 'Percent',
                    },
                ],
            };
            beforeEach(function () {
                ctx.backendSrv.datasourceRequest = function (options) {
                    expect(options.url).toContain('/testRG/providers/Microsoft.Compute/virtualMachines/testRN/providers/microsoft.insights/metrics');
                    return ctx.$q.when({ data: response, status: 200 });
                };
            });
            it('should return a list of datapoints', function () {
                return ctx.ds.query(options).then(function (results) {
                    expect(results.data.length).toBe(1);
                    expect(results.data[0].target).toEqual('testRN.Percentage CPU');
                    expect(results.data[0].datapoints[0][1]).toEqual(1503435600000);
                    expect(results.data[0].datapoints[0][0]).toEqual(1.0503333333333331);
                    expect(results.data[0].datapoints[2][1]).toEqual(1503442800000);
                    expect(results.data[0].datapoints[2][0]).toEqual(1.0457499999999995);
                });
            });
        });
        describe('and data has a dimension filter', function () {
            var response = {
                value: [
                    {
                        timeseries: [
                            {
                                data: [
                                    {
                                        timeStamp: '2017-08-22T21:00:00Z',
                                        total: 1.0503333333333331,
                                    },
                                    {
                                        timeStamp: '2017-08-22T22:00:00Z',
                                        total: 1.045083333333333,
                                    },
                                    {
                                        timeStamp: '2017-08-22T23:00:00Z',
                                        total: 1.0457499999999995,
                                    },
                                ],
                                metadatavalues: [
                                    {
                                        name: {
                                            value: 'blobtype',
                                            localizedValue: 'blobtype',
                                        },
                                        value: 'BlockBlob',
                                    },
                                ],
                            },
                        ],
                        id: '/subscriptions/xxx/resourceGroups/testRG/providers/Microsoft.Compute/virtualMachines' +
                            '/testRN/providers/Microsoft.Insights/metrics/Percentage CPU',
                        name: {
                            value: 'Percentage CPU',
                            localizedValue: 'Percentage CPU',
                        },
                        type: 'Microsoft.Insights/metrics',
                        unit: 'Percent',
                    },
                ],
            };
            describe('and with no alias specified', function () {
                beforeEach(function () {
                    ctx.backendSrv.datasourceRequest = function (options) {
                        var expected = '/testRG/providers/Microsoft.Compute/virtualMachines/testRN/providers/microsoft.insights/metrics';
                        expect(options.url).toContain(expected);
                        return ctx.$q.when({ data: response, status: 200 });
                    };
                });
                it('should return a list of datapoints', function () {
                    return ctx.ds.query(options).then(function (results) {
                        expect(results.data.length).toBe(1);
                        expect(results.data[0].target).toEqual('testRN{blobtype=BlockBlob}.Percentage CPU');
                        expect(results.data[0].datapoints[0][1]).toEqual(1503435600000);
                        expect(results.data[0].datapoints[0][0]).toEqual(1.0503333333333331);
                        expect(results.data[0].datapoints[2][1]).toEqual(1503442800000);
                        expect(results.data[0].datapoints[2][0]).toEqual(1.0457499999999995);
                    });
                });
            });
            describe('and with an alias specified', function () {
                beforeEach(function () {
                    options.targets[0].azureMonitor.alias =
                        '{{resourcegroup}} + {{namespace}} + {{resourcename}} + ' +
                            '{{metric}} + {{dimensionname}} + {{dimensionvalue}}';
                    ctx.backendSrv.datasourceRequest = function (options) {
                        var expected = '/testRG/providers/Microsoft.Compute/virtualMachines/testRN/providers/microsoft.insights/metrics';
                        expect(options.url).toContain(expected);
                        return ctx.$q.when({ data: response, status: 200 });
                    };
                });
                it('should return a list of datapoints', function () {
                    return ctx.ds.query(options).then(function (results) {
                        expect(results.data.length).toBe(1);
                        var expected = 'testRG + Microsoft.Compute/virtualMachines + testRN + Percentage CPU + blobtype + BlockBlob';
                        expect(results.data[0].target).toEqual(expected);
                        expect(results.data[0].datapoints[0][1]).toEqual(1503435600000);
                        expect(results.data[0].datapoints[0][0]).toEqual(1.0503333333333331);
                        expect(results.data[0].datapoints[2][1]).toEqual(1503442800000);
                        expect(results.data[0].datapoints[2][0]).toEqual(1.0457499999999995);
                    });
                });
            });
        });
    });
    describe('When performing metricFindQuery', function () {
        describe('with a metric names query', function () {
            var response = {
                data: {
                    value: [{ name: 'grp1' }, { name: 'grp2' }],
                },
                status: 200,
                statusText: 'OK',
            };
            beforeEach(function () {
                ctx.backendSrv.datasourceRequest = function (options) {
                    return ctx.$q.when(response);
                };
            });
            it('should return a list of metric names', function () {
                return ctx.ds.metricFindQuery('ResourceGroups()').then(function (results) {
                    expect(results.length).toBe(2);
                    expect(results[0].text).toBe('grp1');
                    expect(results[0].value).toBe('grp1');
                    expect(results[1].text).toBe('grp2');
                    expect(results[1].value).toBe('grp2');
                });
            });
        });
        describe('with metric definitions query', function () {
            var response = {
                data: {
                    value: [
                        {
                            name: 'test',
                            type: 'Microsoft.Network/networkInterfaces',
                        },
                    ],
                },
                status: 200,
                statusText: 'OK',
            };
            beforeEach(function () {
                ctx.backendSrv.datasourceRequest = function (options) {
                    var baseUrl = 'http://azuremonitor.com/azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups';
                    expect(options.url).toBe(baseUrl + '/nodesapp/resources?api-version=2018-01-01');
                    return ctx.$q.when(response);
                };
            });
            it('should return a list of metric definitions', function () {
                return ctx.ds.metricFindQuery('Namespaces(nodesapp)').then(function (results) {
                    expect(results.length).toEqual(1);
                    expect(results[0].text).toEqual('Microsoft.Network/networkInterfaces');
                    expect(results[0].value).toEqual('Microsoft.Network/networkInterfaces');
                });
            });
        });
        describe('with resource names query', function () {
            var response = {
                data: {
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
                },
                status: 200,
                statusText: 'OK',
            };
            beforeEach(function () {
                ctx.backendSrv.datasourceRequest = function (options) {
                    var baseUrl = 'http://azuremonitor.com/azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups';
                    expect(options.url).toBe(baseUrl + '/nodeapp/resources?api-version=2018-01-01');
                    return ctx.$q.when(response);
                };
            });
            it('should return a list of resource names', function () {
                return ctx.ds.metricFindQuery('resourceNames(nodeapp, microsoft.insights/components )').then(function (results) {
                    expect(results.length).toEqual(1);
                    expect(results[0].text).toEqual('nodeapp');
                    expect(results[0].value).toEqual('nodeapp');
                });
            });
        });
        describe('with metric names query', function () {
            var response = {
                data: {
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
                },
                status: 200,
                statusText: 'OK',
            };
            beforeEach(function () {
                ctx.backendSrv.datasourceRequest = function (options) {
                    var baseUrl = 'http://azuremonitor.com/azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups';
                    expect(options.url).toBe(baseUrl +
                        '/nodeapp/providers/microsoft.insights/components/rn/providers/microsoft.insights/' +
                        'metricdefinitions?api-version=2018-01-01');
                    return ctx.$q.when(response);
                };
            });
            it('should return a list of metric names', function () {
                return ctx.ds.metricFindQuery('Metricnames(nodeapp, microsoft.insights/components, rn)').then(function (results) {
                    expect(results.length).toEqual(2);
                    expect(results[0].text).toEqual('Percentage CPU');
                    expect(results[0].value).toEqual('Percentage CPU');
                    expect(results[1].text).toEqual('Used capacity');
                    expect(results[1].value).toEqual('UsedCapacity');
                });
            });
        });
    });
    describe('When performing getResourceGroups', function () {
        var response = {
            data: {
                value: [{ name: 'grp1' }, { name: 'grp2' }],
            },
            status: 200,
            statusText: 'OK',
        };
        beforeEach(function () {
            ctx.backendSrv.datasourceRequest = function (options) {
                return ctx.$q.when(response);
            };
        });
        it('should return list of Resource Groups', function () {
            return ctx.ds.getResourceGroups().then(function (results) {
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
            data: {
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
            },
            status: 200,
            statusText: 'OK',
        };
        beforeEach(function () {
            ctx.backendSrv.datasourceRequest = function (options) {
                var baseUrl = 'http://azuremonitor.com/azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups';
                expect(options.url).toBe(baseUrl + '/nodesapp/resources?api-version=2018-01-01');
                return ctx.$q.when(response);
            };
        });
        it('should return list of Metric Definitions with no duplicates and no unsupported namespaces', function () {
            return ctx.ds.getMetricDefinitions('nodesapp').then(function (results) {
                expect(results.length).toEqual(7);
                expect(results[0].text).toEqual('Microsoft.Network/networkInterfaces');
                expect(results[0].value).toEqual('Microsoft.Network/networkInterfaces');
                expect(results[1].text).toEqual('Microsoft.Compute/virtualMachines');
                expect(results[1].value).toEqual('Microsoft.Compute/virtualMachines');
                expect(results[2].text).toEqual('Microsoft.Storage/storageAccounts');
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
                data: {
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
                },
                status: 200,
                statusText: 'OK',
            };
            beforeEach(function () {
                ctx.backendSrv.datasourceRequest = function (options) {
                    var baseUrl = 'http://azuremonitor.com/azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups';
                    expect(options.url).toBe(baseUrl + '/nodeapp/resources?api-version=2018-01-01');
                    return ctx.$q.when(response);
                };
            });
            it('should return list of Resource Names', function () {
                return ctx.ds.getResourceNames('nodeapp', 'microsoft.insights/components').then(function (results) {
                    expect(results.length).toEqual(1);
                    expect(results[0].text).toEqual('nodeapp');
                    expect(results[0].value).toEqual('nodeapp');
                });
            });
        });
        describe('and the metric definition is blobServices', function () {
            var response = {
                data: {
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
                },
                status: 200,
                statusText: 'OK',
            };
            beforeEach(function () {
                ctx.backendSrv.datasourceRequest = function (options) {
                    var baseUrl = 'http://azuremonitor.com/azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups';
                    expect(options.url).toBe(baseUrl + '/nodeapp/resources?api-version=2018-01-01');
                    return ctx.$q.when(response);
                };
            });
            it('should return list of Resource Names', function () {
                return ctx.ds.getResourceNames('nodeapp', 'Microsoft.Storage/storageAccounts/blobServices').then(function (results) {
                    expect(results.length).toEqual(1);
                    expect(results[0].text).toEqual('storagetest/default');
                    expect(results[0].value).toEqual('storagetest/default');
                });
            });
        });
    });
    describe('When performing getMetricNames', function () {
        var response = {
            data: {
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
            },
            status: 200,
            statusText: 'OK',
        };
        beforeEach(function () {
            ctx.backendSrv.datasourceRequest = function (options) {
                var baseUrl = 'http://azuremonitor.com/azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups/nodeapp';
                var expected = baseUrl +
                    '/providers/microsoft.insights/components/resource1' +
                    '/providers/microsoft.insights/metricdefinitions?api-version=2018-01-01';
                expect(options.url).toBe(expected);
                return ctx.$q.when(response);
            };
        });
        it('should return list of Metric Definitions', function () {
            return ctx.ds.getMetricNames('nodeapp', 'microsoft.insights/components', 'resource1').then(function (results) {
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
            data: {
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
            },
            status: 200,
            statusText: 'OK',
        };
        beforeEach(function () {
            ctx.backendSrv.datasourceRequest = function (options) {
                var baseUrl = 'http://azuremonitor.com/azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups/nodeapp';
                var expected = baseUrl +
                    '/providers/microsoft.insights/components/resource1' +
                    '/providers/microsoft.insights/metricdefinitions?api-version=2018-01-01';
                expect(options.url).toBe(expected);
                return ctx.$q.when(response);
            };
        });
        it('should return Aggregation metadata for a Metric', function () {
            return ctx.ds
                .getMetricMetadata('nodeapp', 'microsoft.insights/components', 'resource1', 'UsedCapacity')
                .then(function (results) {
                expect(results.primaryAggType).toEqual('Total');
                expect(results.supportedAggTypes.length).toEqual(6);
                expect(results.supportedTimeGrains.length).toEqual(4);
            });
        });
    });
    describe('When performing getMetricMetadata on metrics with dimensions', function () {
        var response = {
            data: {
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
            },
            status: 200,
            statusText: 'OK',
        };
        beforeEach(function () {
            ctx.backendSrv.datasourceRequest = function (options) {
                var baseUrl = 'http://azuremonitor.com/azuremonitor/subscriptions/9935389e-9122-4ef9-95f9-1513dd24753f/resourceGroups/nodeapp';
                var expected = baseUrl +
                    '/providers/microsoft.insights/components/resource1' +
                    '/providers/microsoft.insights/metricdefinitions?api-version=2018-01-01';
                expect(options.url).toBe(expected);
                return ctx.$q.when(response);
            };
        });
        it('should return dimensions for a Metric that has dimensions', function () {
            return ctx.ds
                .getMetricMetadata('nodeapp', 'microsoft.insights/components', 'resource1', 'Transactions')
                .then(function (results) {
                expect(results.dimensions.length).toEqual(4);
                expect(results.dimensions[0].text).toEqual('None');
                expect(results.dimensions[0].value).toEqual('None');
                expect(results.dimensions[1].text).toEqual('Response type');
                expect(results.dimensions[1].value).toEqual('ResponseType');
            });
        });
        it('should return an empty array for a Metric that does not have dimensions', function () {
            return ctx.ds
                .getMetricMetadata('nodeapp', 'microsoft.insights/components', 'resource1', 'FreeCapacity')
                .then(function (results) {
                expect(results.dimensions.length).toEqual(0);
            });
        });
    });
});
//# sourceMappingURL=azure_monitor_datasource.test.js.map