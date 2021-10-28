import { AzureMonitorQuery, AzureQueryType } from './types';
import DataSource from './datasource';

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
    metricDefinitions: query.match(/^Namespaces\(([^\)]+?)(,\s?([^,]+?))?\)/i),
    metricDefinitionsWithSub: query.match(/^Namespaces\(([^,]+?),\s?([^,]+?)\)/i),
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

export const migrateStringQueriesToObjectQueries = (
  rawQuery: string | AzureMonitorQuery,
  options: { datasource: DataSource }
): AzureMonitorQuery => {
  // no need to migrate already migrated queries
  if (typeof rawQuery !== 'string') {
    return rawQuery;
  }

  if (isGrafanaTemplateVariableFnQuery(rawQuery)) {
    return {
      queryType: AzureQueryType.GrafanaTemplateVariableFn,
      grafanaTemplateVariableFn: {
        query: rawQuery,
      },
      azureLogAnalytics: {
        query: undefined,
      },
    };
  } else {
    const createDefaultResourceAndWorkspace = () => {
      const defaultWorkspaceId = options.datasource.azureLogAnalyticsDatasource.getDeprecatedDefaultWorkSpace();
      if (defaultWorkspaceId) {
        return { resource: '', workspace: defaultWorkspaceId };
      }
      return { resource: '', workspace: '' };
    };

    return {
      queryType: AzureQueryType.LogAnalytics,
      azureLogAnalytics: {
        query: rawQuery,
        ...createDefaultResourceAndWorkspace(),
      },
      grafanaTemplateVariableFn: {
        query: undefined,
      },
      subscription: options.datasource.azureMonitorDatasource.defaultSubscriptionId,
    };
  }
};
