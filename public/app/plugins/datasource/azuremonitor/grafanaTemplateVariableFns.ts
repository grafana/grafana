import { isGUIDish } from './components/ResourcePicker/utils';
import DataSource from './datasource';
import { AzureMonitorQuery, AzureQueryType } from './types';
import {
  AppInsightsGroupByQuery,
  AppInsightsMetricNameQuery,
  GrafanaTemplateVariableQuery,
  MetricNamespaceQuery,
  MetricNamesQuery,
  ResourceGroupsQuery,
  ResourceNamesQuery,
  SubscriptionsQuery,
  WorkspacesQuery,
} from './types/templateVariables';

/* 
  Grafana Template Variable Functions
  ex: Subscriptions()

  These are helper functions we have created and exposed to users to make the writing of template variables easier. 
  Due to legacy reasons, we still need to parse strings to determine if a query is a Grafana Template Variable Function 
  or if it's a KQL-type query
*/

export const grafanaTemplateVariableFnMatches = (query: string) => {
  return {
    subscriptions: query.match(/^Subscriptions\(\)/i),
    resourceGroups: query.match(/^ResourceGroups\(\)/i),
    resourceGroupsWithSub: query.match(/^ResourceGroups\(([^\)]+?)(,\s?([^,]+?))?\)/i),
    namespaces: query.match(/^Namespaces\(([^\)]+?)(,\s?([^,]+?))?\)/i),
    namespacesWithSub: query.match(/^Namespaces\(([^,]+?),\s?([^,]+?)\)/i),
    resourceNames: query.match(/^ResourceNames\(([^,]+?),\s?([^,]+?)\)/i),
    resourceNamesWithSub: query.match(/^ResourceNames\(([^,]+?),\s?([^,]+?),\s?(.+?)\)/i),
    metricNamespace: query.match(/^MetricNamespace\(([^,]+?),\s?([^,]+?),\s?([^,]+?)\)/i),
    metricNamespaceWithSub: query.match(/^metricnamespace\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?)\)/i),
    metricNames: query.match(/^MetricNames\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?)\)/i),
    metricNamesWithSub: query.match(/^MetricNames\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?(.+?)\)/i),
    appInsightsMetricNameQuery: query.match(/^AppInsightsMetricNames\(\)/i),
    appInsightsGroupByQuery: query.match(/^AppInsightsGroupBys\(([^\)]+?)(,\s?([^,]+?))?\)/i),
    workspacesQuery: query.match(/^workspaces\(\)/i),
    workspacesQueryWithSub: query.match(/^workspaces\(["']?([^\)]+?)["']?\)/i),
  };
};

const isGrafanaTemplateVariableFnQuery = (query: string) => {
  const matches: Record<string, RegExpMatchArray | null> = grafanaTemplateVariableFnMatches(query);
  return Object.keys(matches).some((key) => !!matches[key]);
};

const createGrafanaTemplateVariableQuery = (rawQuery: string, datasource: DataSource): AzureMonitorQuery => {
  const matchesForQuery = grafanaTemplateVariableFnMatches(rawQuery);
  const defaultSubscriptionId = datasource.azureMonitorDatasource.defaultSubscriptionId;
  const createGrafanaTemplateVariableDetails = (): GrafanaTemplateVariableQuery => {
    // deprecated app insights template variables (will most likely remove in grafana 9)
    if (matchesForQuery.appInsightsMetricNameQuery) {
      const queryDetails: AppInsightsMetricNameQuery = { rawQuery, kind: 'AppInsightsMetricNameQuery' };
      return queryDetails;
    }

    if (matchesForQuery.appInsightsGroupByQuery) {
      const queryDetails: AppInsightsGroupByQuery = {
        kind: 'AppInsightsGroupByQuery',
        rawQuery,
        metricName: matchesForQuery.appInsightsGroupByQuery[1],
      };
      return queryDetails;
    }

    if (matchesForQuery.subscriptions) {
      const queryDetails: SubscriptionsQuery = {
        kind: 'SubscriptionsQuery',
        rawQuery,
      };
      return queryDetails;
    }

    if (matchesForQuery.resourceGroupsWithSub) {
      const queryDetails: ResourceGroupsQuery = {
        kind: 'ResourceGroupsQuery',
        rawQuery,
        subscription: matchesForQuery.resourceGroupsWithSub[1],
      };
      return queryDetails;
    }

    if (matchesForQuery.resourceGroups && defaultSubscriptionId) {
      const queryDetails: ResourceGroupsQuery = {
        kind: 'ResourceGroupsQuery',
        rawQuery,
        subscription: defaultSubscriptionId,
      };
      return queryDetails;
    }

    if (matchesForQuery.namespacesWithSub) {
      const queryDetails: MetricNamespaceQuery = {
        kind: 'MetricNamespaceQuery',
        rawQuery,
        subscription: matchesForQuery.namespacesWithSub[1],
        resourceGroup: matchesForQuery.namespacesWithSub[2],
      };
      return queryDetails;
    }

    if (matchesForQuery.namespaces && defaultSubscriptionId) {
      const queryDetails: MetricNamespaceQuery = {
        kind: 'MetricNamespaceQuery',
        rawQuery,
        subscription: defaultSubscriptionId,
        resourceGroup: matchesForQuery.namespaces[1],
      };
      return queryDetails;
    }

    if (matchesForQuery.resourceNamesWithSub) {
      const queryDetails: ResourceNamesQuery = {
        kind: 'ResourceNamesQuery',
        rawQuery,
        subscription: matchesForQuery.resourceNamesWithSub[1],
        resourceGroup: matchesForQuery.resourceNamesWithSub[2],
        metricNamespace: matchesForQuery.resourceNamesWithSub[3],
      };
      return queryDetails;
    }

    if (matchesForQuery.resourceNames && defaultSubscriptionId) {
      const queryDetails: ResourceNamesQuery = {
        kind: 'ResourceNamesQuery',
        rawQuery,
        subscription: defaultSubscriptionId,
        resourceGroup: matchesForQuery.resourceNames[1],
        metricNamespace: matchesForQuery.resourceNames[2],
      };
      return queryDetails;
    }

    if (matchesForQuery.metricNamespaceWithSub) {
      const queryDetails: MetricNamespaceQuery = {
        kind: 'MetricNamespaceQuery',
        rawQuery,
        subscription: matchesForQuery.metricNamespaceWithSub[1],
        resourceGroup: matchesForQuery.metricNamespaceWithSub[2],
        metricNamespace: matchesForQuery.metricNamespaceWithSub[3],
        resourceName: matchesForQuery.metricNamespaceWithSub[4],
      };
      return queryDetails;
    }

    if (matchesForQuery.metricNamespace && defaultSubscriptionId) {
      const queryDetails: MetricNamespaceQuery = {
        kind: 'MetricNamespaceQuery',
        rawQuery,
        subscription: defaultSubscriptionId,
        resourceGroup: matchesForQuery.metricNamespace[1],
        metricNamespace: matchesForQuery.metricNamespace[2],
        resourceName: matchesForQuery.metricNamespace[3],
      };
      return queryDetails;
    }

    if (matchesForQuery.metricNames && defaultSubscriptionId) {
      if (matchesForQuery.metricNames[3].indexOf(',') === -1) {
        const queryDetails: MetricNamesQuery = {
          kind: 'MetricNamesQuery',
          rawQuery,
          subscription: defaultSubscriptionId,
          resourceGroup: matchesForQuery.metricNames[1],
          metricNamespace: matchesForQuery.metricNames[2],
          resourceName: matchesForQuery.metricNames[3],
        };
        return queryDetails;
      }
    }

    if (matchesForQuery.metricNamesWithSub) {
      const queryDetails: MetricNamesQuery = {
        kind: 'MetricNamesQuery',
        rawQuery,
        subscription: matchesForQuery.metricNamesWithSub[1],
        resourceGroup: matchesForQuery.metricNamesWithSub[2],
        metricNamespace: matchesForQuery.metricNamesWithSub[3],
        resourceName: matchesForQuery.metricNamesWithSub[4],
      };
      return queryDetails;
    }

    if (matchesForQuery.workspacesQueryWithSub) {
      const queryDetails: WorkspacesQuery = {
        kind: 'WorkspacesQuery',
        rawQuery,
        subscription: (matchesForQuery.workspacesQueryWithSub[1] || '').trim(),
      };
      return queryDetails;
    }

    if (matchesForQuery.workspacesQuery && defaultSubscriptionId) {
      const queryDetails: WorkspacesQuery = {
        kind: 'WorkspacesQuery',
        rawQuery,
        subscription: defaultSubscriptionId,
      };
      return queryDetails;
    }

    // fallback
    const queryDetails: SubscriptionsQuery = { kind: 'SubscriptionsQuery', rawQuery };
    return queryDetails;
  };

  const query: AzureMonitorQuery = {
    refId: 'A',
    queryType: AzureQueryType.GrafanaTemplateVariableFn,
    grafanaTemplateVariableFn: createGrafanaTemplateVariableDetails(),
    subscription: defaultSubscriptionId,
  };
  return query;
};

const createLogAnalyticsTemplateVariableQuery = async (
  rawQuery: string,
  datasource: DataSource
): Promise<AzureMonitorQuery> => {
  const defaultSubscriptionId = datasource.azureMonitorDatasource.defaultSubscriptionId;
  let resource = '';
  // if there's an existing query, we try to get the resourcesuri from a deprecated default workspace
  // a note this is very similar logic to what is used in useMigrations but moved out of the react-hook land
  if (rawQuery) {
    const defaultWorkspaceId = datasource.azureLogAnalyticsDatasource.getDeprecatedDefaultWorkSpace();
    if (defaultWorkspaceId) {
      const isWorkspaceGUID = isGUIDish(defaultWorkspaceId);
      if (isWorkspaceGUID) {
        resource = await datasource.resourcePickerData.getResourceURIFromWorkspace(defaultWorkspaceId);
      } else {
        resource = defaultWorkspaceId;
      }
    } else {
      const maybeFirstWorkspace = await datasource.azureLogAnalyticsDatasource.getFirstWorkspace();
      resource = maybeFirstWorkspace || '';
    }
  }

  return {
    refId: 'A',
    queryType: AzureQueryType.LogAnalytics,
    azureLogAnalytics: {
      query: rawQuery,
      resources: resource ? [resource] : [],
    },
    subscription: defaultSubscriptionId,
  };
};

const migrateGrafanaTemplateVariableFn = (query: AzureMonitorQuery) => {
  const { queryType, grafanaTemplateVariableFn } = query;
  if (queryType !== AzureQueryType.GrafanaTemplateVariableFn || !grafanaTemplateVariableFn) {
    return query;
  }

  const migratedQuery: AzureMonitorQuery = {
    ...query,
  };
  if ('subscription' in grafanaTemplateVariableFn) {
    migratedQuery.subscription = grafanaTemplateVariableFn.subscription;
  }
  if ('resourceGroup' in grafanaTemplateVariableFn) {
    migratedQuery.resourceGroup = grafanaTemplateVariableFn.resourceGroup;
  }
  if ('metricNamespace' in grafanaTemplateVariableFn) {
    migratedQuery.namespace = grafanaTemplateVariableFn.metricNamespace;
  }
  if ('resourceName' in grafanaTemplateVariableFn) {
    migratedQuery.resource = grafanaTemplateVariableFn.resourceName;
  }

  switch (grafanaTemplateVariableFn.kind) {
    case 'SubscriptionsQuery':
      migratedQuery.queryType = AzureQueryType.SubscriptionsQuery;
      break;
    case 'ResourceGroupsQuery':
      migratedQuery.queryType = AzureQueryType.ResourceGroupsQuery;
      break;
    case 'ResourceNamesQuery':
      migratedQuery.queryType = AzureQueryType.ResourceNamesQuery;
      break;
    case 'MetricNamespaceQuery':
      migratedQuery.queryType = AzureQueryType.NamespacesQuery;
      break;
    case 'MetricDefinitionsQuery':
      migratedQuery.queryType = AzureQueryType.NamespacesQuery;
      break;
    case 'MetricNamesQuery':
      migratedQuery.queryType = AzureQueryType.MetricNamesQuery;
      break;
    case 'WorkspacesQuery':
      migratedQuery.queryType = AzureQueryType.WorkspacesQuery;
      break;
  }

  return migratedQuery;
};

export const migrateStringQueriesToObjectQueries = async (
  rawQuery: string | AzureMonitorQuery,
  options: { datasource: DataSource }
): Promise<AzureMonitorQuery> => {
  // no need to migrate already migrated queries
  if (typeof rawQuery !== 'string') {
    return rawQuery;
  }

  return isGrafanaTemplateVariableFnQuery(rawQuery)
    ? createGrafanaTemplateVariableQuery(rawQuery, options.datasource)
    : createLogAnalyticsTemplateVariableQuery(rawQuery, options.datasource);
};

export const migrateQuery = async (
  rawQuery: string | AzureMonitorQuery,
  options: { datasource: DataSource }
): Promise<AzureMonitorQuery> => {
  let query = await migrateStringQueriesToObjectQueries(rawQuery, options);

  if (query.queryType === AzureQueryType.GrafanaTemplateVariableFn) {
    query = migrateGrafanaTemplateVariableFn(query);
  }

  return query;
};
