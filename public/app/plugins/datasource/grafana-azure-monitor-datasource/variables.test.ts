import { DataQueryRequest, DataQueryResponseData, toDataFrame } from '@grafana/data';
import { from } from 'rxjs';
import { AzureMonitorQuery, AzureQueryType } from './types';
import { VariableSupport } from './variables';
import createMockDatasource from './__mocks__/datasource';
import { invalidSubscriptionError } from './__mocks__/errors';

jest.mock('@grafana/runtime', () => ({
  ...((jest.requireActual('@grafana/runtime') as unknown) as object),
  getTemplateSrv: () => ({
    replace: (val: string) => {
      return val;
    },
  }),
}));
describe('VariableSupport', () => {
  describe('querying for grafana template variable fns', () => {
    it('can fetch deprecated log analytics metric names', (done) => {
      const expectedResults = ['test'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          insightsAnalyticsDatasource: {
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
              kind: 'AppInsightsMetricNameQuery',
              rawQuery: 'AppInsightsMetricNames()',
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

    it('can fetch deprecated log analytics groupBys', (done) => {
      const expectedResults = ['test'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          insightsAnalyticsDatasource: {
            getGroupBys: jest.fn().mockResolvedValueOnce(expectedResults),
          },
        })
      );
      const mockRequest = {
        targets: [
          {
            refId: 'A',
            queryType: AzureQueryType.GrafanaTemplateVariableFn,
            grafanaTemplateVariableFn: {
              kind: 'AppInsightsGroupByQuery',
              rawQuery: 'AppInsightsGroupBys(metricname)',
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

    it('can fetch metricDefinitions with a default subscriptionId', (done) => {
      const expectedResults = ['test'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          azureLogAnalyticsDatasource: {
            defaultSubscriptionId: 'defaultSubscriptionId',
          },
          getMetricDefinitions: jest.fn().mockResolvedValueOnce(expectedResults),
        })
      );
      const mockRequest = {
        targets: [
          {
            refId: 'A',
            queryType: AzureQueryType.GrafanaTemplateVariableFn,
            grafanaTemplateVariableFn: {
              kind: 'MetricDefinitionsQuery',
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

    it('can fetch metricDefinitions with a subscriptionId', (done) => {
      const expectedResults = ['test'];
      const variableSupport = new VariableSupport(
        createMockDatasource({
          getMetricDefinitions: jest.fn().mockResolvedValueOnce(expectedResults),
        })
      );
      const mockRequest = {
        targets: [
          {
            refId: 'A',
            queryType: AzureQueryType.GrafanaTemplateVariableFn,
            grafanaTemplateVariableFn: {
              kind: 'MetricDefinitionsQuery',
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
              rawQuery: 'ResourceNames(resourceGroup, metricDefinition)',
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
              rawQuery: 'ResourceNames(subscriptionId, resourceGroup, metricDefinition)',
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
              rawQuery: 'metricNamespace(resourceGroup, metricDefinition, resourceName)',
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
              rawQuery: 'metricNamespace(subscriptionId, resourceGroup, metricDefinition, resourceName)',
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
              rawQuery: 'metricNames(resourceGroup, metricDefinition, resourceName, metricNamespace)',
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
              rawQuery: 'metricNames(subscription, resourceGroup, metricDefinition, resourceName, metricNamespace)',
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
          getMetricDefinitions: jest.fn((sub: string, rg: string) => {
            if (sub === 'subscriptionId' && rg === 'resourceGroup') {
              return Promise.resolve(expectedResults);
            }
            return Promise.resolve([`getMetricDefinitions unexpected input: ${sub}, ${rg}`]);
          }),
        })
      );
      const mockRequest = {
        targets: [('Namespaces(subscriptionId, resourceGroup)' as unknown) as AzureMonitorQuery],
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
});
