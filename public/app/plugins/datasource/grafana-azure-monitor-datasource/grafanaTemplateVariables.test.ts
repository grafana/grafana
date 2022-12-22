import createMockDatasource from './__mocks__/datasource';
import { migrateQuery, migrateStringQueriesToObjectQueries } from './grafanaTemplateVariableFns';
import { AzureMonitorQuery, AzureQueryType } from './types';

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
          kind: 'MetricNamespaceQuery',
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
          kind: 'MetricNamespaceQuery',
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
          metricNamespace: 'md',
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
          metricNamespace: 'md',
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
          metricNamespace: 'md',
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
          metricNamespace: 'md',
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
          metricNamespace: 'md',
          resourceName: 'rn',
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
          metricNamespace: 'md',
          resourceName: 'rn',
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

describe('migrateStringQueriesToObjectQueries', () => {
  const expectedMigrations: Array<{ input: AzureMonitorQuery; output: AzureMonitorQuery }> = [
    {
      input: {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: { kind: 'SubscriptionsQuery', rawQuery: 'Subscriptions()' },
        subscription: 'defaultSubscriptionId',
      },
      output: {
        refId: 'A',
        queryType: AzureQueryType.SubscriptionsQuery,
      },
    },
    {
      input: {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: {
          kind: 'ResourceGroupsQuery',
          rawQuery: 'ResourceGroups()',
          subscription: 'defaultSubscriptionId',
        },
        subscription: 'defaultSubscriptionId',
      },
      output: {
        refId: 'A',
        queryType: AzureQueryType.ResourceGroupsQuery,
        subscription: 'defaultSubscriptionId',
      },
    },
    {
      input: {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: {
          kind: 'ResourceGroupsQuery',
          rawQuery: 'ResourceGroups(subId)',
          subscription: 'subId',
        },
        subscription: 'defaultSubscriptionId',
      },
      output: {
        refId: 'A',
        queryType: AzureQueryType.ResourceGroupsQuery,
        subscription: 'subId',
      },
    },
    {
      input: {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: {
          kind: 'MetricNamespaceQuery',
          rawQuery: 'Namespaces(rg)',
          subscription: 'defaultSubscriptionId',
          resourceGroup: 'rg',
        },
        subscription: 'defaultSubscriptionId',
      },
      output: {
        refId: 'A',
        queryType: AzureQueryType.NamespacesQuery,
        subscription: 'defaultSubscriptionId',
        resourceGroup: 'rg',
      },
    },
    {
      input: {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: {
          kind: 'MetricNamespaceQuery',
          rawQuery: 'Namespaces(subId, rg)',
          subscription: 'subId',
          resourceGroup: 'rg',
        },
        subscription: 'defaultSubscriptionId',
      },
      output: {
        refId: 'A',
        queryType: AzureQueryType.NamespacesQuery,
        subscription: 'subId',
        resourceGroup: 'rg',
      },
    },
    {
      input: {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: {
          kind: 'ResourceNamesQuery',
          rawQuery: 'ResourceNames(rg, md)',
          subscription: 'defaultSubscriptionId',
          resourceGroup: 'rg',
          metricNamespace: 'md',
        },
        subscription: 'defaultSubscriptionId',
      },
      output: {
        refId: 'A',
        queryType: AzureQueryType.ResourceNamesQuery,
        subscription: 'defaultSubscriptionId',
        resourceGroup: 'rg',
        namespace: 'md',
      },
    },
    {
      input: {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: {
          kind: 'ResourceNamesQuery',
          rawQuery: 'ResourceNames(subId, rg, md)',
          subscription: 'subId',
          resourceGroup: 'rg',
          metricNamespace: 'md',
        },
        subscription: 'defaultSubscriptionId',
      },
      output: {
        refId: 'A',
        queryType: AzureQueryType.ResourceNamesQuery,
        subscription: 'subId',
        resourceGroup: 'rg',
        namespace: 'md',
      },
    },
    {
      input: {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: {
          kind: 'MetricNamespaceQuery',
          rawQuery: 'MetricNamespace(rg, md, rn)',
          subscription: 'defaultSubscriptionId',
          resourceGroup: 'rg',
          metricNamespace: 'md',
          resourceName: 'rn',
        },
        subscription: 'defaultSubscriptionId',
      },
      output: {
        refId: 'A',
        queryType: AzureQueryType.NamespacesQuery,
        subscription: 'defaultSubscriptionId',
        resourceGroup: 'rg',
        namespace: 'md',
        resource: 'rn',
      },
    },
    {
      input: {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: {
          kind: 'MetricNamespaceQuery',
          rawQuery: 'MetricNamespace(subId, rg, md, rn)',
          subscription: 'subId',
          resourceGroup: 'rg',
          metricNamespace: 'md',
          resourceName: 'rn',
        },
        subscription: 'defaultSubscriptionId',
      },
      output: {
        refId: 'A',
        queryType: AzureQueryType.NamespacesQuery,
        subscription: 'subId',
        resourceGroup: 'rg',
        namespace: 'md',
        resource: 'rn',
      },
    },
    {
      input: {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: {
          kind: 'MetricNamesQuery',
          rawQuery: 'MetricNames(rg, md, rn, mn)',
          subscription: 'defaultSubscriptionId',
          resourceGroup: 'rg',
          metricNamespace: 'md',
          resourceName: 'rn',
        },
        subscription: 'defaultSubscriptionId',
      },
      output: {
        refId: 'A',
        queryType: AzureQueryType.MetricNamesQuery,
        subscription: 'defaultSubscriptionId',
        resourceGroup: 'rg',
        namespace: 'md',
        resource: 'rn',
      },
    },
    {
      input: {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: {
          kind: 'MetricNamesQuery',
          rawQuery: 'MetricNames(subId, rg, md, rn, mn)',
          subscription: 'subId',
          resourceGroup: 'rg',
          metricNamespace: 'md',
          resourceName: 'rn',
        },
        subscription: 'defaultSubscriptionId',
      },
      output: {
        refId: 'A',
        queryType: AzureQueryType.MetricNamesQuery,
        subscription: 'subId',
        resourceGroup: 'rg',
        namespace: 'md',
        resource: 'rn',
      },
    },
    {
      input: {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: {
          kind: 'WorkspacesQuery',
          rawQuery: 'workspaces()',
          subscription: 'defaultSubscriptionId',
        },
        subscription: 'defaultSubscriptionId',
      },
      output: {
        refId: 'A',
        queryType: AzureQueryType.WorkspacesQuery,
        subscription: 'defaultSubscriptionId',
      },
    },
    {
      input: {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: {
          kind: 'WorkspacesQuery',
          rawQuery: 'workspaces(subId)',
          subscription: 'subId',
        },
        subscription: 'defaultSubscriptionId',
      },
      output: {
        refId: 'A',
        queryType: AzureQueryType.WorkspacesQuery,
        subscription: 'subId',
      },
    },
  ];
  it('successfully converts all old variable functions into formatted predefined queries', async () => {
    return expectedMigrations.map(async ({ input, output }) => {
      const datasource = createMockDatasource({
        azureMonitorDatasource: {
          defaultSubscriptionId: 'defaultSubscriptionId',
        },
      });
      const actual = await migrateQuery(input, { datasource });
      expect(actual).toMatchObject(output);
    });
  });
});
