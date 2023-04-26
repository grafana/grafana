import { from, lastValueFrom } from 'rxjs';

import { DataQueryRequest, toDataFrame } from '@grafana/data';

import createMockDatasource from './__mocks__/datasource';
import { invalidSubscriptionError } from './__mocks__/errors';
import { AzureMonitorQuery, AzureQueryType } from './types';
import { VariableSupport } from './variables';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({
    replace: (val: string) => {
      return val;
    },
  }),
}));

describe('VariableSupport', () => {
  describe('querying for grafana template variable fns', () => {
    it('can fetch subscriptions', async () => {
      const fakeSubscriptions = ['subscriptionId'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          getSubscriptions: jest.fn().mockResolvedValueOnce(fakeSubscriptions),
        })
      );
      const mockRequest = {
        targets: [
          {
            refId: 'A',
            queryType: AzureQueryType.GrafanaTemplateVariableFn,
            grafanaTemplateVariableFn: {
              kind: 'SubscriptionsQuery',
              rawQuery: 'Subscriptions()',
            },
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const result = await lastValueFrom(variableSupport.query(mockRequest));
      expect(result.data[0].source).toEqual(fakeSubscriptions);
    });

    it('can fetch resourceGroups with a subscriptionId arg', async () => {
      const expectedResults = ['test'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          getResourceGroups: jest.fn().mockResolvedValueOnce(expectedResults),
        })
      );
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
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const result = await lastValueFrom(variableSupport.query(mockRequest));
      expect(result.data[0].source).toEqual(expectedResults);
    });

    it('can fetch metricNamespaces with a subscriptionId', async () => {
      const expectedResults = ['test'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          getMetricNamespaces: jest.fn().mockResolvedValue(expectedResults),
        })
      );
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
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const result = await lastValueFrom(variableSupport.query(mockRequest));
      expect(result.data[0].source).toEqual(expectedResults);
    });

    it('can fetch resourceNames with a subscriptionId', async () => {
      const expectedResults = ['test'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          getResourceNames: jest.fn().mockResolvedValueOnce(expectedResults),
        })
      );
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
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const result = await lastValueFrom(variableSupport.query(mockRequest));
      expect(result.data[0].source).toEqual(expectedResults);
    });

    it('can fetch a metricNamespace with a subscriptionId', async () => {
      const expectedResults = ['test'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          getMetricNamespaces: jest.fn().mockResolvedValueOnce(expectedResults),
        })
      );
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
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const result = await lastValueFrom(variableSupport.query(mockRequest));
      expect(result.data[0].source).toEqual(expectedResults);
    });

    it('can fetch metricNames with a subscriptionId', async () => {
      const expectedResults = ['test'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          getMetricNames: jest.fn().mockResolvedValueOnce(expectedResults),
        })
      );
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
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const result = await lastValueFrom(variableSupport.query(mockRequest));
      expect(result.data[0].source).toEqual(expectedResults);
    });

    it('can fetch workspaces with a subscriptionId', async () => {
      const expectedResults = ['test'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          getAzureLogAnalyticsWorkspaces: jest.fn().mockResolvedValueOnce(expectedResults),
        })
      );
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
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const result = await lastValueFrom(variableSupport.query(mockRequest));
      expect(result.data[0].source).toEqual(expectedResults);
    });

    it('can handle legacy string queries with a default subscription', async () => {
      const expectedResults = ['test'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          azureMonitorDatasource: {
            defaultSubscriptionId: 'defaultSubscriptionId',
          },
          getMetricNamespaces: jest.fn((sub: string, rg: string) => {
            if (sub === 'defaultSubscriptionId' && rg === 'resourceGroup') {
              return Promise.resolve(expectedResults);
            }
            return Promise.resolve([`getmetricNamespaces unexpected input: ${sub}, ${rg}`]);
          }),
        })
      );
      const mockRequest = {
        targets: ['Namespaces(resourceGroup)' as unknown as AzureMonitorQuery],
      } as DataQueryRequest<AzureMonitorQuery>;
      const result = await lastValueFrom(variableSupport.query(mockRequest));
      expect(result.data[0].source).toEqual(expectedResults);
    });

    it('can handle legacy string queries', async () => {
      const expectedResults = ['test'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          getMetricNamespaces: jest.fn((sub: string, rg: string) => {
            if (sub === 'subscriptionId' && rg === 'resourceGroup') {
              return Promise.resolve(expectedResults);
            }
            return Promise.resolve([`getmetricNamespaces unexpected input: ${sub}, ${rg}`]);
          }),
        })
      );
      const mockRequest = {
        targets: ['Namespaces(subscriptionId, resourceGroup)' as unknown as AzureMonitorQuery],
      } as DataQueryRequest<AzureMonitorQuery>;
      const result = await lastValueFrom(variableSupport.query(mockRequest));
      expect(result.data[0].source).toEqual(expectedResults);
    });

    it('returns an empty array for unknown queries', async () => {
      const variableSupport = new VariableSupport(createMockDatasource());
      const mockRequest = {
        targets: [
          {
            queryType: AzureQueryType.GrafanaTemplateVariableFn,
            grafanaTemplateVariableFn: {
              rawQuery: 'nonsense',
            },
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const result = await lastValueFrom(variableSupport.query(mockRequest));
      expect(result.data).toEqual([]);
    });

    it('should return None when there is no data', async () => {
      const variableSupport = new VariableSupport(
        createMockDatasource({
          getMetricNames: jest.fn().mockResolvedValueOnce([]),
        })
      );
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
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const result = await lastValueFrom(variableSupport.query(mockRequest));
      expect(result.data).toEqual([]);
    });
  });

  it('passes on the query to the main datasource for all non-grafana template variable fns', async () => {
    const expectedResults = ['test'];
    const variableSupport = new VariableSupport(
      createMockDatasource({
        query: () =>
          from(
            Promise.resolve({
              data: [toDataFrame(expectedResults)],
            })
          ),
      })
    );
    const mockRequest = {
      targets: [
        {
          queryType: AzureQueryType.LogAnalytics,
          azureLogAnalytics: {
            query: 'some log thing',
          },
        } as AzureMonitorQuery,
      ],
    } as DataQueryRequest<AzureMonitorQuery>;
    const result = await lastValueFrom(variableSupport.query(mockRequest));
    expect(result.data[0].source).toEqual(expectedResults);
  });

  it('passes on the query error for a log query', async () => {
    const variableSupport = new VariableSupport(
      createMockDatasource({
        query: () =>
          from(
            Promise.resolve({
              data: [],
              error: {
                message: 'boom',
              },
            })
          ),
      })
    );
    const mockRequest = {
      targets: [
        {
          queryType: AzureQueryType.LogAnalytics,
          azureLogAnalytics: {
            query: 'some log thing',
          },
        } as AzureMonitorQuery,
      ],
    } as DataQueryRequest<AzureMonitorQuery>;
    const result = await lastValueFrom(variableSupport.query(mockRequest));
    expect(result.data).toEqual([]);
    expect(result.error?.message).toEqual('boom');
  });

  it('should handle http error', async () => {
    const error = invalidSubscriptionError();
    const variableSupport = new VariableSupport(
      createMockDatasource({
        getResourceGroups: jest.fn().mockRejectedValue(error),
      })
    );
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
        } as AzureMonitorQuery,
      ],
    } as DataQueryRequest<AzureMonitorQuery>;
    const result = await lastValueFrom(variableSupport.query(mockRequest));
    expect(result.error?.message).toBe(error.data.error.message);
  });

  describe('predefined functions', () => {
    it('can fetch subscriptions', async () => {
      const fakeSubscriptions = ['subscriptionId'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          getSubscriptions: jest.fn().mockResolvedValueOnce(fakeSubscriptions),
        })
      );
      const mockRequest = {
        targets: [
          {
            refId: 'A',
            queryType: AzureQueryType.SubscriptionsQuery,
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const result = await lastValueFrom(variableSupport.query(mockRequest));
      expect(result.data[0].source).toEqual(fakeSubscriptions);
    });

    it('can fetch resourceGroups', async () => {
      const expectedResults = ['test'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          getResourceGroups: jest.fn().mockResolvedValueOnce(expectedResults),
        })
      );
      const mockRequest = {
        targets: [
          {
            refId: 'A',
            queryType: AzureQueryType.ResourceGroupsQuery,
            subscription: 'sub',
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const result = await lastValueFrom(variableSupport.query(mockRequest));
      expect(result.data[0].source).toEqual(expectedResults);
    });

    it('returns no data if calling resourceGroups but the subscription is a template variable with no value', async () => {
      const variableSupport = new VariableSupport(createMockDatasource());
      const mockRequest = {
        targets: [
          {
            refId: 'A',
            queryType: AzureQueryType.ResourceGroupsQuery,
            subscription: '$sub',
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const result = await lastValueFrom(variableSupport.query(mockRequest));
      expect(result.data).toEqual([]);
    });

    it('can fetch namespaces', async () => {
      const expectedResults = ['test'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          getMetricNamespaces: jest.fn().mockResolvedValueOnce(expectedResults),
        })
      );
      const mockRequest = {
        targets: [
          {
            refId: 'A',
            queryType: AzureQueryType.NamespacesQuery,
            subscription: 'sub',
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const result = await lastValueFrom(variableSupport.query(mockRequest));
      expect(result.data[0].source).toEqual(expectedResults);
    });

    it('returns no data if calling namespaces but the subscription is a template variable with no value', async () => {
      const variableSupport = new VariableSupport(createMockDatasource());
      const mockRequest = {
        targets: [
          {
            refId: 'A',
            queryType: AzureQueryType.NamespacesQuery,
            subscription: '$sub',
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const result = await lastValueFrom(variableSupport.query(mockRequest));
      expect(result.data).toEqual([]);
    });

    it('can fetch resource names', async () => {
      const expectedResults = ['test'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          getResourceNames: jest.fn().mockResolvedValueOnce(expectedResults),
        })
      );
      const mockRequest = {
        targets: [
          {
            refId: 'A',
            queryType: AzureQueryType.ResourceNamesQuery,
            subscription: 'sub',
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const result = await lastValueFrom(variableSupport.query(mockRequest));
      expect(result.data[0].source).toEqual(expectedResults);
    });

    it('returns no data if calling resourceNames but the subscription is a template variable with no value', async () => {
      const variableSupport = new VariableSupport(createMockDatasource());
      const mockRequest = {
        targets: [
          {
            refId: 'A',
            queryType: AzureQueryType.ResourceNamesQuery,
            subscription: '$sub',
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const result = await lastValueFrom(variableSupport.query(mockRequest));
      expect(result.data).toEqual([]);
    });

    it('can fetch metric names', async () => {
      const expectedResults = ['test'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          getMetricNames: jest.fn().mockResolvedValueOnce(expectedResults),
        })
      );
      const mockRequest = {
        targets: [
          {
            refId: 'A',
            queryType: AzureQueryType.MetricNamesQuery,
            subscription: 'sub',
            resourceGroup: 'rg',
            namespace: 'ns',
            resource: 'rn',
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const result = await lastValueFrom(variableSupport.query(mockRequest));
      expect(result.data[0].source).toEqual(expectedResults);
    });

    it('returns no data if calling metric names but the subscription is a template variable with no value', async () => {
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
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const result = await lastValueFrom(variableSupport.query(mockRequest));
      expect(result.data).toEqual([]);
    });

    it('can fetch workspaces', async () => {
      const expectedResults = ['test'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          getAzureLogAnalyticsWorkspaces: jest.fn().mockResolvedValueOnce(expectedResults),
        })
      );
      const mockRequest = {
        targets: [
          {
            refId: 'A',
            queryType: AzureQueryType.WorkspacesQuery,
            subscription: 'sub',
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const result = await lastValueFrom(variableSupport.query(mockRequest));
      expect(result.data[0].source).toEqual(expectedResults);
    });
  });
});
