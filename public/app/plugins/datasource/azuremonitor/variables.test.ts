import { from, lastValueFrom } from 'rxjs';

import { type DataQueryRequest, dateTime, toDataFrame } from '@grafana/data';

import { AzureQueryType } from './dataquery.gen';
import createMockDatasource from './mocks/datasource';
import { invalidSubscriptionError } from './mocks/errors';
import { type AzureMonitorQuery } from './types/query';
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
      expect(result.data[0].fields[0].values).toEqual(fakeSubscriptions);
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
      expect(result.data[0].fields[0].values).toEqual(expectedResults);
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
      expect(result.data[0].fields[0].values).toEqual(expectedResults);
    });

    it('can fetch resourceNames with a subscriptionId', async () => {
      const expectedResults = [{ name: 'test' }];
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
      expect(result.data[0].fields[0].values).toEqual([expectedResults[0].name]);
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
      expect(result.data[0].fields[0].values).toEqual(expectedResults);
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
      expect(result.data[0].fields[0].values).toEqual(expectedResults);
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
      expect(result.data[0].fields[0].values).toEqual(expectedResults);
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
      expect(result.data[0].fields[0].values).toEqual(expectedResults);
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
      expect(result.data[0].fields[0].values).toEqual(expectedResults);
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
    expect(result.data[0].fields[0].values).toEqual(expectedResults);
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
      expect(result.data[0].fields[0].values).toEqual(fakeSubscriptions);
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
      expect(result.data[0].fields[0].values).toEqual(expectedResults);
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
      expect(result.data[0].fields[0].values).toEqual(expectedResults);
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
      const expectedResults = [{ name: 'test' }];
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
      expect(result.data[0].fields[0].values).toEqual([expectedResults[0].name]);
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
      expect(result.data[0].fields[0].values).toEqual(expectedResults);
    });

    it('can fetch dimensions for a selected metric', async () => {
      const datasource = createMockDatasource();
      datasource.azureMonitorDatasource.getMetricMetadata = jest.fn().mockResolvedValue({
        primaryAggType: 'Count',
        supportedAggTypes: ['Count'],
        supportedTimeGrains: [],
        dimensions: [
          { label: 'Cloud role name', value: 'cloud/roleName' },
          { label: 'Result code', value: 'request/resultCode' },
        ],
      });
      const variableSupport = new VariableSupport(datasource);
      const mockRequest = {
        targets: [
          {
            refId: 'A',
            queryType: AzureQueryType.DimensionsQuery,
            subscription: 'sub',
            resourceGroup: 'rg',
            namespace: 'ns',
            resource: 'resource',
            customNamespace: 'custom/ns',
            metricName: 'Requests',
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;

      const result = await lastValueFrom(variableSupport.query(mockRequest));

      expect(datasource.azureMonitorDatasource.getMetricMetadata).toHaveBeenCalledWith({
        subscription: 'sub',
        resourceGroup: 'rg',
        metricNamespace: 'ns',
        resourceName: 'resource',
        metricName: 'Requests',
        customNamespace: 'custom/ns',
      });
      expect(result.data[0].fields[0].values).toEqual(['Cloud role name', 'Result code']);
      expect(result.data[0].fields[1].values).toEqual(['cloud/roleName', 'request/resultCode']);
    });

    it('returns an empty frame when the selected metric has no dimensions', async () => {
      const datasource = createMockDatasource();
      datasource.azureMonitorDatasource.getMetricMetadata = jest.fn().mockResolvedValue({
        primaryAggType: 'Count',
        supportedAggTypes: ['Count'],
        supportedTimeGrains: [],
        dimensions: [],
      });
      const variableSupport = new VariableSupport(datasource);
      const mockRequest = {
        targets: [
          {
            refId: 'A',
            queryType: AzureQueryType.DimensionsQuery,
            subscription: 'sub',
            resourceGroup: 'rg',
            namespace: 'ns',
            resource: 'resource',
            metricName: 'Requests',
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;

      const result = await lastValueFrom(variableSupport.query(mockRequest));

      expect(result.data).toHaveLength(1);
      expect(result.data[0].length).toBe(0);
    });

    it('clears dimension names when a parent variable interpolates empty', async () => {
      const datasource = createMockDatasource();
      datasource.azureMonitorDatasource.getMetricMetadata = jest.fn();
      const variableSupport = new VariableSupport(datasource, {
        replace: (value: string) => (value === '$metric' ? '' : value),
      } as never);
      const mockRequest = {
        targets: [
          {
            refId: 'A',
            queryType: AzureQueryType.DimensionsQuery,
            subscription: 'sub',
            resourceGroup: 'rg',
            namespace: 'ns',
            resource: 'resource',
            metricName: '$metric',
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;

      const result = await lastValueFrom(variableSupport.query(mockRequest));

      expect(datasource.azureMonitorDatasource.getMetricMetadata).not.toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].length).toBe(0);
    });

    it('does not clear dimension names when the query is still missing a field', async () => {
      const datasource = createMockDatasource();
      datasource.azureMonitorDatasource.getMetricMetadata = jest.fn();
      const variableSupport = new VariableSupport(datasource);
      const mockRequest = {
        targets: [
          {
            refId: 'A',
            queryType: AzureQueryType.DimensionsQuery,
            subscription: 'sub',
            resourceGroup: 'rg',
            namespace: 'ns',
            resource: 'resource',
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;

      const result = await lastValueFrom(variableSupport.query(mockRequest));

      expect(datasource.azureMonitorDatasource.getMetricMetadata).not.toHaveBeenCalled();
      expect(result.data).toEqual([]);
    });

    it('fetches dimension values using the dashboard time range', async () => {
      const getDimensionValues = jest.fn().mockResolvedValue([{ text: 'api', value: 'api' }]);
      const variableSupport = new VariableSupport(createMockDatasource({ getDimensionValues }));
      const range = {
        from: dateTime('2026-08-27T12:00:00.000Z'),
        to: dateTime('2026-08-27T13:00:00.000Z'),
        raw: { from: 'now-1h', to: 'now' },
      };
      const mockRequest = {
        range,
        targets: [
          {
            refId: 'A',
            queryType: AzureQueryType.DimensionValuesQuery,
            subscription: 'sub',
            resourceGroup: 'rg',
            namespace: 'ns',
            resource: 'resource',
            customNamespace: 'custom/ns',
            metricName: 'Requests',
            dimension: 'CloudRole',
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;

      const result = await lastValueFrom(variableSupport.query(mockRequest));

      expect(getDimensionValues).toHaveBeenCalledWith(
        'sub',
        'rg',
        'ns',
        'resource',
        'Requests',
        'CloudRole',
        range,
        'custom/ns'
      );
      expect(result.data[0].fields[0].values).toEqual(['api']);
    });

    it('returns an empty frame when a complete dimension values query has no values', async () => {
      const variableSupport = new VariableSupport(
        createMockDatasource({ getDimensionValues: jest.fn().mockResolvedValue([]) })
      );
      const mockRequest = {
        range: {
          from: dateTime('2026-08-27T12:00:00.000Z'),
          to: dateTime('2026-08-27T13:00:00.000Z'),
          raw: { from: 'now-1h', to: 'now' },
        },
        targets: [
          {
            refId: 'A',
            queryType: AzureQueryType.DimensionValuesQuery,
            subscription: 'sub',
            resourceGroup: 'rg',
            namespace: 'ns',
            resource: 'resource',
            metricName: 'Requests',
            dimension: 'CloudRole',
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;

      const result = await lastValueFrom(variableSupport.query(mockRequest));

      expect(result.data).toHaveLength(1);
      expect(result.data[0].length).toBe(0);
    });

    it('does not call Azure when a required dimension values field resolves empty', async () => {
      const getDimensionValues = jest.fn();
      const variableSupport = new VariableSupport(createMockDatasource({ getDimensionValues }), {
        replace: (value: string) => (value === '$dimension' ? '' : value),
      } as never);
      const mockRequest = {
        range: {
          from: dateTime('2026-08-27T12:00:00.000Z'),
          to: dateTime('2026-08-27T13:00:00.000Z'),
          raw: { from: 'now-1h', to: 'now' },
        },
        targets: [
          {
            refId: 'A',
            queryType: AzureQueryType.DimensionValuesQuery,
            subscription: 'sub',
            resourceGroup: 'rg',
            namespace: 'ns',
            resource: 'resource',
            metricName: 'Requests',
            dimension: '$dimension',
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;

      const result = await lastValueFrom(variableSupport.query(mockRequest));

      expect(getDimensionValues).not.toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].length).toBe(0);
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
      expect(result.data[0].fields[0].values).toEqual(expectedResults);
    });
  });

  it('can fetch custom namespaces', async () => {
    const expectedResults = ['test-custom/namespace'];
    const variableSupport = new VariableSupport(
      createMockDatasource({
        getMetricNamespaces: jest.fn().mockResolvedValueOnce(expectedResults),
      })
    );
    const mockRequest = {
      targets: [
        {
          refId: 'A',
          queryType: AzureQueryType.CustomNamespacesQuery,
          subscription: 'sub',
          resourceGroup: 'rg',
          namespace: 'ns',
          resource: 'rn',
        } as AzureMonitorQuery,
      ],
    } as DataQueryRequest<AzureMonitorQuery>;
    const result = await lastValueFrom(variableSupport.query(mockRequest));
    expect(result.data[0].fields[0].values).toEqual(expectedResults);
  });

  it('returns no data if calling custom namespaces but the subscription is a template variable with no value', async () => {
    const variableSupport = new VariableSupport(createMockDatasource());
    const mockRequest = {
      targets: [
        {
          refId: 'A',
          queryType: AzureQueryType.CustomNamespacesQuery,
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

  it('can fetch custom metric names', async () => {
    const expectedResults = ['test-custom-metric'];
    const variableSupport = new VariableSupport(
      createMockDatasource({
        getMetricNames: jest.fn().mockResolvedValueOnce(expectedResults),
      })
    );
    const mockRequest = {
      targets: [
        {
          refId: 'A',
          queryType: AzureQueryType.CustomMetricNamesQuery,
          subscription: 'sub',
          resourceGroup: 'rg',
          namespace: 'ns',
          resource: 'rn',
          customNamespace: 'test-custom/namespace',
        } as AzureMonitorQuery,
      ],
    } as DataQueryRequest<AzureMonitorQuery>;
    const result = await lastValueFrom(variableSupport.query(mockRequest));
    expect(result.data[0].fields[0].values).toEqual(expectedResults);
  });

  it('returns no data if calling custom metric names but the subscription is a template variable with no value', async () => {
    const variableSupport = new VariableSupport(createMockDatasource());
    const mockRequest = {
      targets: [
        {
          refId: 'A',
          queryType: AzureQueryType.CustomMetricNamesQuery,
          subscription: '$sub',
          resourceGroup: 'rg',
          namespace: 'ns',
          resource: 'rn',
          customNamespace: 'test-custom/namespace',
        } as AzureMonitorQuery,
      ],
    } as DataQueryRequest<AzureMonitorQuery>;
    const result = await lastValueFrom(variableSupport.query(mockRequest));
    expect(result.data).toEqual([]);
  });
});
