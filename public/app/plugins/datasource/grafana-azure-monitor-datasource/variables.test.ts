import { from } from 'rxjs';

import { DataQueryRequest, DataQueryResponseData, toDataFrame } from '@grafana/data';

import createMockDatasource from './__mocks__/datasource';
import { invalidSubscriptionError } from './__mocks__/errors';
import { AzureMonitorQuery, AzureQueryType } from './types';
import { VariableSupport } from './variables';

jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as unknown as object),
  getTemplateSrv: () => ({
    replace: (val: string) => {
      return val;
    },
  }),
}));
describe('VariableSupport', () => {
  describe('querying for grafana template variable fns', () => {
    it('can fetch subscriptions', (done) => {
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
      const observables = variableSupport.query(mockRequest);
      observables.subscribe((result: DataQueryResponseData) => {
        expect(result.data[0].source).toEqual(fakeSubscriptions);
        done();
      });
    });

    it('can fetch resourceGroups with a default subscriptionId', (done) => {
      const expectedResults = ['test'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          azureLogAnalyticsDatasource: {
            defaultSubscriptionId: 'defaultSubscriptionId',
          },
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
              rawQuery: 'ResourceGroups()',
            },
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const observables = variableSupport.query(mockRequest);
      observables.subscribe((result: DataQueryResponseData) => {
        expect(result.data[0].source).toEqual(expectedResults);
        done();
      });
    });

    it('can fetch resourceGroups with a subscriptionId arg', (done) => {
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
            },
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const observables = variableSupport.query(mockRequest);
      observables.subscribe((result: DataQueryResponseData) => {
        expect(result.data[0].source).toEqual(expectedResults);
        done();
      });
    });

    it('can fetch metricNamespaces with a default subscriptionId', (done) => {
      const expectedResults = ['test'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          azureLogAnalyticsDatasource: {
            defaultSubscriptionId: 'defaultSubscriptionId',
          },
          azureMonitorDatasource: {
            getMetricNamespaces: jest.fn().mockResolvedValue(expectedResults),
          },
        })
      );
      const mockRequest = {
        targets: [
          {
            refId: 'A',
            queryType: AzureQueryType.GrafanaTemplateVariableFn,
            grafanaTemplateVariableFn: {
              kind: 'MetricNamespaceQuery',
              rawQuery: 'Namespaces(resourceGroup)',
            },
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const observables = variableSupport.query(mockRequest);
      observables.subscribe((result: DataQueryResponseData) => {
        expect(result.data[0].source).toEqual(expectedResults);
        done();
      });
    });

    it('can fetch metricNamespaces with a subscriptionId', (done) => {
      const expectedResults = ['test'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          azureMonitorDatasource: {
            getMetricNamespaces: jest.fn().mockResolvedValue(expectedResults),
          },
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
            },
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const observables = variableSupport.query(mockRequest);
      observables.subscribe((result: DataQueryResponseData) => {
        expect(result.data[0].source).toEqual(expectedResults);
        done();
      });
    });

    it('can fetch resourceNames with a default subscriptionId', (done) => {
      const expectedResults = ['test'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          azureLogAnalyticsDatasource: {
            defaultSubscriptionId: 'defaultSubscriptionId',
          },
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
              rawQuery: 'ResourceNames(resourceGroup, metricNamespace)',
            },
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const observables = variableSupport.query(mockRequest);
      observables.subscribe((result: DataQueryResponseData) => {
        expect(result.data[0].source).toEqual(expectedResults);
        done();
      });
    });

    it('can fetch resourceNames with a subscriptionId', (done) => {
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
            },
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const observables = variableSupport.query(mockRequest);
      observables.subscribe((result: DataQueryResponseData) => {
        expect(result.data[0].source).toEqual(expectedResults);
        done();
      });
    });

    it('can fetch a metricNamespace with a default subscriptionId', (done) => {
      const expectedResults = ['test'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          azureLogAnalyticsDatasource: {
            defaultSubscriptionId: 'defaultSubscriptionId',
          },
          azureMonitorDatasource: {
            getMetricNamespaces: jest.fn().mockResolvedValueOnce(expectedResults),
          },
        })
      );
      const mockRequest = {
        targets: [
          {
            refId: 'A',
            queryType: AzureQueryType.GrafanaTemplateVariableFn,
            grafanaTemplateVariableFn: {
              kind: 'MetricNamespaceQuery',
              rawQuery: 'metricNamespace(resourceGroup, metricNamespace, resourceName)',
            },
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const observables = variableSupport.query(mockRequest);
      observables.subscribe((result: DataQueryResponseData) => {
        expect(result.data[0].source).toEqual(expectedResults);
        done();
      });
    });

    it('can fetch a metricNamespace with a subscriptionId', (done) => {
      const expectedResults = ['test'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          azureMonitorDatasource: {
            getMetricNamespaces: jest.fn().mockResolvedValueOnce(expectedResults),
          },
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
            },
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const observables = variableSupport.query(mockRequest);
      observables.subscribe((result: DataQueryResponseData) => {
        expect(result.data[0].source).toEqual(expectedResults);
        done();
      });
    });

    it('can fetch metricNames with a default subscriptionId', (done) => {
      const expectedResults = ['test'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          azureLogAnalyticsDatasource: {
            defaultSubscriptionId: 'defaultSubscriptionId',
          },
          azureMonitorDatasource: {
            getMetricNames: jest.fn().mockResolvedValueOnce(expectedResults),
          },
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
            },
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const observables = variableSupport.query(mockRequest);
      observables.subscribe((result: DataQueryResponseData) => {
        expect(result.data[0].source).toEqual(expectedResults);
        done();
      });
    });

    it('can fetch metricNames with a subscriptionId', (done) => {
      const expectedResults = ['test'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          azureMonitorDatasource: {
            getMetricNames: jest.fn().mockResolvedValueOnce(expectedResults),
          },
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
            },
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const observables = variableSupport.query(mockRequest);
      observables.subscribe((result: DataQueryResponseData) => {
        expect(result.data[0].source).toEqual(expectedResults);
        done();
      });
    });

    it('can fetch workspaces with a default subscriptionId', (done) => {
      const expectedResults = ['test'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          azureLogAnalyticsDatasource: {
            defaultSubscriptionId: 'defaultSubscriptionId',
            getWorkspaces: jest.fn().mockResolvedValueOnce(expectedResults),
          },
        })
      );
      const mockRequest = {
        targets: [
          {
            refId: 'A',
            queryType: AzureQueryType.GrafanaTemplateVariableFn,
            grafanaTemplateVariableFn: {
              kind: 'WorkspacesQuery',
              rawQuery: 'workspaces()',
            },
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const observables = variableSupport.query(mockRequest);
      observables.subscribe((result: DataQueryResponseData) => {
        expect(result.data[0].source).toEqual(expectedResults);
        done();
      });
    });
    it('can fetch workspaces with a subscriptionId', (done) => {
      const expectedResults = ['test'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          azureLogAnalyticsDatasource: {
            getWorkspaces: jest.fn().mockResolvedValueOnce(expectedResults),
          },
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
            },
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const observables = variableSupport.query(mockRequest);
      observables.subscribe((result: DataQueryResponseData) => {
        expect(result.data[0].source).toEqual(expectedResults);
        done();
      });
    });

    it('can handle legacy string queries', (done) => {
      const expectedResults = ['test'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          azureMonitorDatasource: {
            defaultSubscriptionId: 'defaultSubscriptionId',
          },
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
      const observables = variableSupport.query(mockRequest);
      observables.subscribe((result: DataQueryResponseData) => {
        expect(result.data[0].source).toEqual(expectedResults);
        done();
      });
    });
    it('returns an empty array for unknown queries', (done) => {
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
      const observables = variableSupport.query(mockRequest);
      observables.subscribe((result: DataQueryResponseData) => {
        expect(result.data).toEqual([]);
        done();
      });
    });

    it('should return None when there is no data', (done) => {
      const variableSupport = new VariableSupport(
        createMockDatasource({
          azureLogAnalyticsDatasource: {
            defaultSubscriptionId: 'defaultSubscriptionId',
          },
          azureMonitorDatasource: {
            getMetricNames: jest.fn().mockResolvedValueOnce([]),
          },
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
            },
          } as AzureMonitorQuery,
        ],
      } as DataQueryRequest<AzureMonitorQuery>;
      const observables = variableSupport.query(mockRequest);
      observables.subscribe((result: DataQueryResponseData) => {
        expect(result.data.length).toBe(0);
        done();
      });
    });
  });

  it('passes on the query to the main datasource for all non-grafana template variable fns', (done) => {
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
    const observables = variableSupport.query(mockRequest);
    observables.subscribe((result: DataQueryResponseData) => {
      expect(result.data[0].source).toEqual(expectedResults);
      done();
    });
  });

  it('passes on the query error for a log query', (done) => {
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
    const observables = variableSupport.query(mockRequest);
    observables.subscribe((result: DataQueryResponseData) => {
      expect(result.data).toEqual([]);
      expect(result.error.message).toEqual('boom');
      done();
    });
  });

  it('should handle http error', (done) => {
    const error = invalidSubscriptionError();
    const variableSupport = new VariableSupport(
      createMockDatasource({
        azureLogAnalyticsDatasource: {
          defaultSubscriptionId: 'defaultSubscriptionId',
        },
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
          },
        } as AzureMonitorQuery,
      ],
    } as DataQueryRequest<AzureMonitorQuery>;
    const observables = variableSupport.query(mockRequest);
    observables.subscribe((result: DataQueryResponseData) => {
      expect(result.error?.message).toBe(error.data.error.message);
      done();
    });
  });

  describe('predefined functions', () => {
    it('can fetch subscriptions', (done) => {
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
      const observables = variableSupport.query(mockRequest);
      observables.subscribe((result: DataQueryResponseData) => {
        expect(result.data[0].source).toEqual(fakeSubscriptions);
        done();
      });
    });

    it('can fetch resourceGroups', (done) => {
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
      const observables = variableSupport.query(mockRequest);
      observables.subscribe((result: DataQueryResponseData) => {
        expect(result.data[0].source).toEqual(expectedResults);
        done();
      });
    });

    it('can fetch namespaces', (done) => {
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
      const observables = variableSupport.query(mockRequest);
      observables.subscribe((result: DataQueryResponseData) => {
        expect(result.data[0].source).toEqual(expectedResults);
        done();
      });
    });

    it('can fetch resource names', (done) => {
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
      const observables = variableSupport.query(mockRequest);
      observables.subscribe((result: DataQueryResponseData) => {
        expect(result.data[0].source).toEqual(expectedResults);
        done();
      });
    });

    it('can fetch metric names', (done) => {
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
      const observables = variableSupport.query(mockRequest);
      observables.subscribe((result: DataQueryResponseData) => {
        expect(result.data[0].source).toEqual(expectedResults);
        done();
      });
    });

    it('can fetch workspaces', (done) => {
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
      const observables = variableSupport.query(mockRequest);
      observables.subscribe((result: DataQueryResponseData) => {
        expect(result.data[0].source).toEqual(expectedResults);
        done();
      });
    });
  });
});
