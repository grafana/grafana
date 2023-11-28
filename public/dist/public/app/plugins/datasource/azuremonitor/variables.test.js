import { __awaiter } from "tslib";
import { from, lastValueFrom } from 'rxjs';
import { toDataFrame } from '@grafana/data';
import createMockDatasource from './__mocks__/datasource';
import { invalidSubscriptionError } from './__mocks__/errors';
import { AzureQueryType } from './types';
import { VariableSupport } from './variables';
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getTemplateSrv: () => ({
        replace: (val) => {
            return val;
        },
    }) })));
describe('VariableSupport', () => {
    describe('querying for grafana template variable fns', () => {
        it('can fetch subscriptions', () => __awaiter(void 0, void 0, void 0, function* () {
            const fakeSubscriptions = ['subscriptionId'];
            const variableSupport = new VariableSupport(createMockDatasource({
                getSubscriptions: jest.fn().mockResolvedValueOnce(fakeSubscriptions),
            }));
            const mockRequest = {
                targets: [
                    {
                        refId: 'A',
                        queryType: AzureQueryType.GrafanaTemplateVariableFn,
                        grafanaTemplateVariableFn: {
                            kind: 'SubscriptionsQuery',
                            rawQuery: 'Subscriptions()',
                        },
                    },
                ],
            };
            const result = yield lastValueFrom(variableSupport.query(mockRequest));
            expect(result.data[0].fields[0].values).toEqual(fakeSubscriptions);
        }));
        it('can fetch resourceGroups with a subscriptionId arg', () => __awaiter(void 0, void 0, void 0, function* () {
            const expectedResults = ['test'];
            const variableSupport = new VariableSupport(createMockDatasource({
                getResourceGroups: jest.fn().mockResolvedValueOnce(expectedResults),
            }));
            const mockRequest = {
                targets: [
                    {
                        refId: 'A',
                        queryType: AzureQueryType.GrafanaTemplateVariableFn,
                        grafanaTemplateVariableFn: {
                            kind: 'ResourceGroupsQuery',
                            rawQuery: 'ResourceGroups(sub)',
                            subscription: 'sub',
                        },
                    },
                ],
            };
            const result = yield lastValueFrom(variableSupport.query(mockRequest));
            expect(result.data[0].fields[0].values).toEqual(expectedResults);
        }));
        it('can fetch metricNamespaces with a subscriptionId', () => __awaiter(void 0, void 0, void 0, function* () {
            const expectedResults = ['test'];
            const variableSupport = new VariableSupport(createMockDatasource({
                getMetricNamespaces: jest.fn().mockResolvedValue(expectedResults),
            }));
            const mockRequest = {
                targets: [
                    {
                        refId: 'A',
                        queryType: AzureQueryType.GrafanaTemplateVariableFn,
                        grafanaTemplateVariableFn: {
                            kind: 'MetricNamespaceQuery',
                            rawQuery: 'Namespaces(resourceGroup, subscriptionId)',
                            subscription: 'subscriptionId',
                            resourceGroup: 'resourceGroup',
                        },
                    },
                ],
            };
            const result = yield lastValueFrom(variableSupport.query(mockRequest));
            expect(result.data[0].fields[0].values).toEqual(expectedResults);
        }));
        it('can fetch resourceNames with a subscriptionId', () => __awaiter(void 0, void 0, void 0, function* () {
            const expectedResults = ['test'];
            const variableSupport = new VariableSupport(createMockDatasource({
                getResourceNames: jest.fn().mockResolvedValueOnce(expectedResults),
            }));
            const mockRequest = {
                targets: [
                    {
                        refId: 'A',
                        queryType: AzureQueryType.GrafanaTemplateVariableFn,
                        grafanaTemplateVariableFn: {
                            kind: 'ResourceNamesQuery',
                            rawQuery: 'ResourceNames(subscriptionId, resourceGroup, metricNamespace)',
                            subscription: 'subscriptionId',
                            resourceGroup: 'resourceGroup',
                            metricNamespace: 'metricNamespace',
                        },
                    },
                ],
            };
            const result = yield lastValueFrom(variableSupport.query(mockRequest));
            expect(result.data[0].fields[0].values).toEqual(expectedResults);
        }));
        it('can fetch a metricNamespace with a subscriptionId', () => __awaiter(void 0, void 0, void 0, function* () {
            const expectedResults = ['test'];
            const variableSupport = new VariableSupport(createMockDatasource({
                getMetricNamespaces: jest.fn().mockResolvedValueOnce(expectedResults),
            }));
            const mockRequest = {
                targets: [
                    {
                        refId: 'A',
                        queryType: AzureQueryType.GrafanaTemplateVariableFn,
                        grafanaTemplateVariableFn: {
                            kind: 'MetricNamespaceQuery',
                            rawQuery: 'metricNamespace(subscriptionId, resourceGroup, metricNamespace, resourceName)',
                            subscription: 'subscriptionId',
                            resourceGroup: 'resourceGroup',
                            metricNamespace: 'metricNamespace',
                            resourceName: 'resourceName',
                        },
                    },
                ],
            };
            const result = yield lastValueFrom(variableSupport.query(mockRequest));
            expect(result.data[0].fields[0].values).toEqual(expectedResults);
        }));
        it('can fetch metricNames with a subscriptionId', () => __awaiter(void 0, void 0, void 0, function* () {
            const expectedResults = ['test'];
            const variableSupport = new VariableSupport(createMockDatasource({
                getMetricNames: jest.fn().mockResolvedValueOnce(expectedResults),
            }));
            const mockRequest = {
                targets: [
                    {
                        refId: 'A',
                        queryType: AzureQueryType.GrafanaTemplateVariableFn,
                        grafanaTemplateVariableFn: {
                            kind: 'MetricNamesQuery',
                            rawQuery: 'metricNames(subscription, resourceGroup, metricNamespace, resourceName, metricNamespace)',
                            subscription: 'subscriptionId',
                            resourceGroup: 'resourceGroup',
                            metricNamespace: 'metricNamespace',
                            resourceName: 'resourceName',
                        },
                    },
                ],
            };
            const result = yield lastValueFrom(variableSupport.query(mockRequest));
            expect(result.data[0].fields[0].values).toEqual(expectedResults);
        }));
        it('can fetch workspaces with a subscriptionId', () => __awaiter(void 0, void 0, void 0, function* () {
            const expectedResults = ['test'];
            const variableSupport = new VariableSupport(createMockDatasource({
                getAzureLogAnalyticsWorkspaces: jest.fn().mockResolvedValueOnce(expectedResults),
            }));
            const mockRequest = {
                targets: [
                    {
                        refId: 'A',
                        queryType: AzureQueryType.GrafanaTemplateVariableFn,
                        grafanaTemplateVariableFn: {
                            kind: 'WorkspacesQuery',
                            rawQuery: 'workspaces(subscriptionId)',
                            subscription: 'subscriptionId',
                        },
                    },
                ],
            };
            const result = yield lastValueFrom(variableSupport.query(mockRequest));
            expect(result.data[0].fields[0].values).toEqual(expectedResults);
        }));
        it('can handle legacy string queries with a default subscription', () => __awaiter(void 0, void 0, void 0, function* () {
            const expectedResults = ['test'];
            const variableSupport = new VariableSupport(createMockDatasource({
                azureMonitorDatasource: {
                    defaultSubscriptionId: 'defaultSubscriptionId',
                },
                getMetricNamespaces: jest.fn((sub, rg) => {
                    if (sub === 'defaultSubscriptionId' && rg === 'resourceGroup') {
                        return Promise.resolve(expectedResults);
                    }
                    return Promise.resolve([`getmetricNamespaces unexpected input: ${sub}, ${rg}`]);
                }),
            }));
            const mockRequest = {
                targets: ['Namespaces(resourceGroup)'],
            };
            const result = yield lastValueFrom(variableSupport.query(mockRequest));
            expect(result.data[0].fields[0].values).toEqual(expectedResults);
        }));
        it('can handle legacy string queries', () => __awaiter(void 0, void 0, void 0, function* () {
            const expectedResults = ['test'];
            const variableSupport = new VariableSupport(createMockDatasource({
                getMetricNamespaces: jest.fn((sub, rg) => {
                    if (sub === 'subscriptionId' && rg === 'resourceGroup') {
                        return Promise.resolve(expectedResults);
                    }
                    return Promise.resolve([`getmetricNamespaces unexpected input: ${sub}, ${rg}`]);
                }),
            }));
            const mockRequest = {
                targets: ['Namespaces(subscriptionId, resourceGroup)'],
            };
            const result = yield lastValueFrom(variableSupport.query(mockRequest));
            expect(result.data[0].fields[0].values).toEqual(expectedResults);
        }));
        it('returns an empty array for unknown queries', () => __awaiter(void 0, void 0, void 0, function* () {
            const variableSupport = new VariableSupport(createMockDatasource());
            const mockRequest = {
                targets: [
                    {
                        queryType: AzureQueryType.GrafanaTemplateVariableFn,
                        grafanaTemplateVariableFn: {
                            rawQuery: 'nonsense',
                        },
                    },
                ],
            };
            const result = yield lastValueFrom(variableSupport.query(mockRequest));
            expect(result.data).toEqual([]);
        }));
        it('should return None when there is no data', () => __awaiter(void 0, void 0, void 0, function* () {
            const variableSupport = new VariableSupport(createMockDatasource({
                getMetricNames: jest.fn().mockResolvedValueOnce([]),
            }));
            const mockRequest = {
                targets: [
                    {
                        refId: 'A',
                        queryType: AzureQueryType.GrafanaTemplateVariableFn,
                        grafanaTemplateVariableFn: {
                            kind: 'MetricNamesQuery',
                            rawQuery: 'metricNames(resourceGroup, metricNamespace, resourceName, metricNamespace)',
                            subscription: 'subscriptionId',
                            resourceGroup: 'resourceGroup',
                            metricNamespace: 'metricNamespace',
                            resourceName: 'resourceName',
                        },
                    },
                ],
            };
            const result = yield lastValueFrom(variableSupport.query(mockRequest));
            expect(result.data).toEqual([]);
        }));
    });
    it('passes on the query to the main datasource for all non-grafana template variable fns', () => __awaiter(void 0, void 0, void 0, function* () {
        const expectedResults = ['test'];
        const variableSupport = new VariableSupport(createMockDatasource({
            query: () => from(Promise.resolve({
                data: [toDataFrame(expectedResults)],
            })),
        }));
        const mockRequest = {
            targets: [
                {
                    queryType: AzureQueryType.LogAnalytics,
                    azureLogAnalytics: {
                        query: 'some log thing',
                    },
                },
            ],
        };
        const result = yield lastValueFrom(variableSupport.query(mockRequest));
        expect(result.data[0].fields[0].values).toEqual(expectedResults);
    }));
    it('passes on the query error for a log query', () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const variableSupport = new VariableSupport(createMockDatasource({
            query: () => from(Promise.resolve({
                data: [],
                error: {
                    message: 'boom',
                },
            })),
        }));
        const mockRequest = {
            targets: [
                {
                    queryType: AzureQueryType.LogAnalytics,
                    azureLogAnalytics: {
                        query: 'some log thing',
                    },
                },
            ],
        };
        const result = yield lastValueFrom(variableSupport.query(mockRequest));
        expect(result.data).toEqual([]);
        expect((_a = result.error) === null || _a === void 0 ? void 0 : _a.message).toEqual('boom');
    }));
    it('should handle http error', () => __awaiter(void 0, void 0, void 0, function* () {
        var _b;
        const error = invalidSubscriptionError();
        const variableSupport = new VariableSupport(createMockDatasource({
            getResourceGroups: jest.fn().mockRejectedValue(error),
        }));
        const mockRequest = {
            targets: [
                {
                    refId: 'A',
                    queryType: AzureQueryType.GrafanaTemplateVariableFn,
                    grafanaTemplateVariableFn: {
                        kind: 'ResourceGroupsQuery',
                        rawQuery: 'ResourceGroups()',
                        subscription: 'subscriptionId',
                    },
                },
            ],
        };
        const result = yield lastValueFrom(variableSupport.query(mockRequest));
        expect((_b = result.error) === null || _b === void 0 ? void 0 : _b.message).toBe(error.data.error.message);
    }));
    describe('predefined functions', () => {
        it('can fetch subscriptions', () => __awaiter(void 0, void 0, void 0, function* () {
            const fakeSubscriptions = ['subscriptionId'];
            const variableSupport = new VariableSupport(createMockDatasource({
                getSubscriptions: jest.fn().mockResolvedValueOnce(fakeSubscriptions),
            }));
            const mockRequest = {
                targets: [
                    {
                        refId: 'A',
                        queryType: AzureQueryType.SubscriptionsQuery,
                    },
                ],
            };
            const result = yield lastValueFrom(variableSupport.query(mockRequest));
            expect(result.data[0].fields[0].values).toEqual(fakeSubscriptions);
        }));
        it('can fetch resourceGroups', () => __awaiter(void 0, void 0, void 0, function* () {
            const expectedResults = ['test'];
            const variableSupport = new VariableSupport(createMockDatasource({
                getResourceGroups: jest.fn().mockResolvedValueOnce(expectedResults),
            }));
            const mockRequest = {
                targets: [
                    {
                        refId: 'A',
                        queryType: AzureQueryType.ResourceGroupsQuery,
                        subscription: 'sub',
                    },
                ],
            };
            const result = yield lastValueFrom(variableSupport.query(mockRequest));
            expect(result.data[0].fields[0].values).toEqual(expectedResults);
        }));
        it('returns no data if calling resourceGroups but the subscription is a template variable with no value', () => __awaiter(void 0, void 0, void 0, function* () {
            const variableSupport = new VariableSupport(createMockDatasource());
            const mockRequest = {
                targets: [
                    {
                        refId: 'A',
                        queryType: AzureQueryType.ResourceGroupsQuery,
                        subscription: '$sub',
                    },
                ],
            };
            const result = yield lastValueFrom(variableSupport.query(mockRequest));
            expect(result.data).toEqual([]);
        }));
        it('can fetch namespaces', () => __awaiter(void 0, void 0, void 0, function* () {
            const expectedResults = ['test'];
            const variableSupport = new VariableSupport(createMockDatasource({
                getMetricNamespaces: jest.fn().mockResolvedValueOnce(expectedResults),
            }));
            const mockRequest = {
                targets: [
                    {
                        refId: 'A',
                        queryType: AzureQueryType.NamespacesQuery,
                        subscription: 'sub',
                    },
                ],
            };
            const result = yield lastValueFrom(variableSupport.query(mockRequest));
            expect(result.data[0].fields[0].values).toEqual(expectedResults);
        }));
        it('returns no data if calling namespaces but the subscription is a template variable with no value', () => __awaiter(void 0, void 0, void 0, function* () {
            const variableSupport = new VariableSupport(createMockDatasource());
            const mockRequest = {
                targets: [
                    {
                        refId: 'A',
                        queryType: AzureQueryType.NamespacesQuery,
                        subscription: '$sub',
                    },
                ],
            };
            const result = yield lastValueFrom(variableSupport.query(mockRequest));
            expect(result.data).toEqual([]);
        }));
        it('can fetch resource names', () => __awaiter(void 0, void 0, void 0, function* () {
            const expectedResults = ['test'];
            const variableSupport = new VariableSupport(createMockDatasource({
                getResourceNames: jest.fn().mockResolvedValueOnce(expectedResults),
            }));
            const mockRequest = {
                targets: [
                    {
                        refId: 'A',
                        queryType: AzureQueryType.ResourceNamesQuery,
                        subscription: 'sub',
                    },
                ],
            };
            const result = yield lastValueFrom(variableSupport.query(mockRequest));
            expect(result.data[0].fields[0].values).toEqual(expectedResults);
        }));
        it('returns no data if calling resourceNames but the subscription is a template variable with no value', () => __awaiter(void 0, void 0, void 0, function* () {
            const variableSupport = new VariableSupport(createMockDatasource());
            const mockRequest = {
                targets: [
                    {
                        refId: 'A',
                        queryType: AzureQueryType.ResourceNamesQuery,
                        subscription: '$sub',
                    },
                ],
            };
            const result = yield lastValueFrom(variableSupport.query(mockRequest));
            expect(result.data).toEqual([]);
        }));
        it('can fetch metric names', () => __awaiter(void 0, void 0, void 0, function* () {
            const expectedResults = ['test'];
            const variableSupport = new VariableSupport(createMockDatasource({
                getMetricNames: jest.fn().mockResolvedValueOnce(expectedResults),
            }));
            const mockRequest = {
                targets: [
                    {
                        refId: 'A',
                        queryType: AzureQueryType.MetricNamesQuery,
                        subscription: 'sub',
                        resourceGroup: 'rg',
                        namespace: 'ns',
                        resource: 'rn',
                    },
                ],
            };
            const result = yield lastValueFrom(variableSupport.query(mockRequest));
            expect(result.data[0].fields[0].values).toEqual(expectedResults);
        }));
        it('returns no data if calling metric names but the subscription is a template variable with no value', () => __awaiter(void 0, void 0, void 0, function* () {
            const variableSupport = new VariableSupport(createMockDatasource());
            const mockRequest = {
                targets: [
                    {
                        refId: 'A',
                        queryType: AzureQueryType.ResourceNamesQuery,
                        subscription: '$sub',
                        resourceGroup: 'rg',
                        namespace: 'ns',
                        resource: 'rn',
                    },
                ],
            };
            const result = yield lastValueFrom(variableSupport.query(mockRequest));
            expect(result.data).toEqual([]);
        }));
        it('can fetch workspaces', () => __awaiter(void 0, void 0, void 0, function* () {
            const expectedResults = ['test'];
            const variableSupport = new VariableSupport(createMockDatasource({
                getAzureLogAnalyticsWorkspaces: jest.fn().mockResolvedValueOnce(expectedResults),
            }));
            const mockRequest = {
                targets: [
                    {
                        refId: 'A',
                        queryType: AzureQueryType.WorkspacesQuery,
                        subscription: 'sub',
                    },
                ],
            };
            const result = yield lastValueFrom(variableSupport.query(mockRequest));
            expect(result.data[0].fields[0].values).toEqual(expectedResults);
        }));
    });
});
//# sourceMappingURL=variables.test.js.map