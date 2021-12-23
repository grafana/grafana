import { migrateStringQueriesToObjectQueries } from './grafanaTemplateVariableFns';
import { AzureMonitorQuery, AzureQueryType } from './types';
import createMockDatasource from './__mocks__/datasource';

describe('migrateStringQueriesToObjectQueries', () => {
  const expectedMigrations: Array<{ input: string; output: AzureMonitorQuery }> = [
    {
      input: 'Subscriptions()',
      output: {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: { kind: 'SubscriptionsQuery', rawQuery: 'Subscriptions()' },
        subscription: 'defaultSubscriptionId',
      },
    },
    {
      input: 'ResourceGroups()',
      output: {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: {
          kind: 'ResourceGroupsQuery',
          rawQuery: 'ResourceGroups()',
          subscription: 'defaultSubscriptionId',
        },
        subscription: 'defaultSubscriptionId',
      },
    },
    {
      input: 'ResourceGroups(subId)',
      output: {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: {
          kind: 'ResourceGroupsQuery',
          rawQuery: 'ResourceGroups(subId)',
          subscription: 'subId',
        },
        subscription: 'defaultSubscriptionId',
      },
    },
    {
      input: 'Namespaces(rg)',
      output: {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: {
          kind: 'MetricDefinitionsQuery',
          rawQuery: 'Namespaces(rg)',
          subscription: 'defaultSubscriptionId',
          resourceGroup: 'rg',
        },
        subscription: 'defaultSubscriptionId',
      },
    },
    {
      input: 'Namespaces(subId, rg)',
      output: {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: {
          kind: 'MetricDefinitionsQuery',
          rawQuery: 'Namespaces(subId, rg)',
          subscription: 'subId',
          resourceGroup: 'rg',
        },
        subscription: 'defaultSubscriptionId',
      },
    },
    {
      input: 'ResourceNames(rg, md)',
      output: {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: {
          kind: 'ResourceNamesQuery',
          rawQuery: 'ResourceNames(rg, md)',
          subscription: 'defaultSubscriptionId',
          resourceGroup: 'rg',
          metricDefinition: 'md',
        },
        subscription: 'defaultSubscriptionId',
      },
    },
    {
      input: 'ResourceNames(subId, rg, md)',
      output: {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: {
          kind: 'ResourceNamesQuery',
          rawQuery: 'ResourceNames(subId, rg, md)',
          subscription: 'subId',
          resourceGroup: 'rg',
          metricDefinition: 'md',
        },
        subscription: 'defaultSubscriptionId',
      },
    },
    {
      input: 'MetricNamespace(rg, md, rn)',
      output: {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: {
          kind: 'MetricNamespaceQuery',
          rawQuery: 'MetricNamespace(rg, md, rn)',
          subscription: 'defaultSubscriptionId',
          resourceGroup: 'rg',
          metricDefinition: 'md',
          resourceName: 'rn',
        },
        subscription: 'defaultSubscriptionId',
      },
    },
    {
      input: 'MetricNamespace(subId, rg, md, rn)',
      output: {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: {
          kind: 'MetricNamespaceQuery',
          rawQuery: 'MetricNamespace(subId, rg, md, rn)',
          subscription: 'subId',
          resourceGroup: 'rg',
          metricDefinition: 'md',
          resourceName: 'rn',
        },
        subscription: 'defaultSubscriptionId',
      },
    },
    {
      input: 'MetricNames(rg, md, rn, mn)',
      output: {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: {
          kind: 'MetricNamesQuery',
          rawQuery: 'MetricNames(rg, md, rn, mn)',
          subscription: 'defaultSubscriptionId',
          resourceGroup: 'rg',
          metricDefinition: 'md',
          resourceName: 'rn',
          metricNamespace: 'mn',
        },
        subscription: 'defaultSubscriptionId',
      },
    },
    {
      input: 'MetricNames(subId, rg, md, rn, mn)',
      output: {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: {
          kind: 'MetricNamesQuery',
          rawQuery: 'MetricNames(subId, rg, md, rn, mn)',
          subscription: 'subId',
          resourceGroup: 'rg',
          metricDefinition: 'md',
          resourceName: 'rn',
          metricNamespace: 'mn',
        },
        subscription: 'defaultSubscriptionId',
      },
    },
    {
      input: 'AppInsightsMetricNames()',
      output: {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: {
          kind: 'AppInsightsMetricNameQuery',
          rawQuery: 'AppInsightsMetricNames()',
        },
        subscription: 'defaultSubscriptionId',
      },
    },
    {
      input: 'AppInsightsGroupBys(mn)',
      output: {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: {
          kind: 'AppInsightsGroupByQuery',
          rawQuery: 'AppInsightsGroupBys(mn)',
          metricName: 'mn',
        },
        subscription: 'defaultSubscriptionId',
      },
    },
    {
      input: 'workspaces()',
      output: {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: {
          kind: 'WorkspacesQuery',
          rawQuery: 'workspaces()',
          subscription: 'defaultSubscriptionId',
        },
        subscription: 'defaultSubscriptionId',
      },
    },
    {
      input: 'workspaces(subId)',
      output: {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: {
          kind: 'WorkspacesQuery',
          rawQuery: 'workspaces(subId)',
          subscription: 'subId',
        },
        subscription: 'defaultSubscriptionId',
      },
    },
    {
      input: 'some kind of kql query',
      output: {
        refId: 'A',
        queryType: AzureQueryType.LogAnalytics,
        azureLogAnalytics: {
          query: 'some kind of kql query',
          resource: '',
        },
        subscription: 'defaultSubscriptionId',
      },
    },
  ];
  it('successfully converts all old string queries into formatted query objects', async () => {
    return expectedMigrations.map(async ({ input, output }) => {
      const datasource = createMockDatasource({
        azureMonitorDatasource: {
          defaultSubscriptionId: 'defaultSubscriptionId',
        },
      });
      const actual = await migrateStringQueriesToObjectQueries(input, { datasource });
      expect(actual).toEqual(output);
    });
  });
});
