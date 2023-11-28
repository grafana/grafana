import { __awaiter } from "tslib";
import { isGUIDish } from './components/ResourcePicker/utils';
import { AzureQueryType } from './types';
/*
  Grafana Template Variable Functions
  ex: Subscriptions()

  These are helper functions we have created and exposed to users to make the writing of template variables easier.
  Due to legacy reasons, we still need to parse strings to determine if a query is a Grafana Template Variable Function
  or if it's a KQL-type query
*/
export const grafanaTemplateVariableFnMatches = (query) => {
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
const isGrafanaTemplateVariableFnQuery = (query) => {
    const matches = grafanaTemplateVariableFnMatches(query);
    return Object.keys(matches).some((key) => !!matches[key]);
};
const createGrafanaTemplateVariableQuery = (rawQuery, datasource) => {
    const matchesForQuery = grafanaTemplateVariableFnMatches(rawQuery);
    const defaultSubscriptionId = datasource.azureMonitorDatasource.defaultSubscriptionId;
    const createGrafanaTemplateVariableDetails = () => {
        // deprecated app insights template variables (will most likely remove in grafana 9)
        if (matchesForQuery.appInsightsMetricNameQuery) {
            const queryDetails = { rawQuery, kind: 'AppInsightsMetricNameQuery' };
            return queryDetails;
        }
        if (matchesForQuery.appInsightsGroupByQuery) {
            const queryDetails = {
                kind: 'AppInsightsGroupByQuery',
                rawQuery,
                metricName: matchesForQuery.appInsightsGroupByQuery[1],
            };
            return queryDetails;
        }
        if (matchesForQuery.subscriptions) {
            const queryDetails = {
                kind: 'SubscriptionsQuery',
                rawQuery,
            };
            return queryDetails;
        }
        if (matchesForQuery.resourceGroupsWithSub) {
            const queryDetails = {
                kind: 'ResourceGroupsQuery',
                rawQuery,
                subscription: matchesForQuery.resourceGroupsWithSub[1],
            };
            return queryDetails;
        }
        if (matchesForQuery.resourceGroups && defaultSubscriptionId) {
            const queryDetails = {
                kind: 'ResourceGroupsQuery',
                rawQuery,
                subscription: defaultSubscriptionId,
            };
            return queryDetails;
        }
        if (matchesForQuery.namespacesWithSub) {
            const queryDetails = {
                kind: 'MetricNamespaceQuery',
                rawQuery,
                subscription: matchesForQuery.namespacesWithSub[1],
                resourceGroup: matchesForQuery.namespacesWithSub[2],
            };
            return queryDetails;
        }
        if (matchesForQuery.namespaces && defaultSubscriptionId) {
            const queryDetails = {
                kind: 'MetricNamespaceQuery',
                rawQuery,
                subscription: defaultSubscriptionId,
                resourceGroup: matchesForQuery.namespaces[1],
            };
            return queryDetails;
        }
        if (matchesForQuery.resourceNamesWithSub) {
            const queryDetails = {
                kind: 'ResourceNamesQuery',
                rawQuery,
                subscription: matchesForQuery.resourceNamesWithSub[1],
                resourceGroup: matchesForQuery.resourceNamesWithSub[2],
                metricNamespace: matchesForQuery.resourceNamesWithSub[3],
            };
            return queryDetails;
        }
        if (matchesForQuery.resourceNames && defaultSubscriptionId) {
            const queryDetails = {
                kind: 'ResourceNamesQuery',
                rawQuery,
                subscription: defaultSubscriptionId,
                resourceGroup: matchesForQuery.resourceNames[1],
                metricNamespace: matchesForQuery.resourceNames[2],
            };
            return queryDetails;
        }
        if (matchesForQuery.metricNamespaceWithSub) {
            const queryDetails = {
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
            const queryDetails = {
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
                const queryDetails = {
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
            const queryDetails = {
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
            const queryDetails = {
                kind: 'WorkspacesQuery',
                rawQuery,
                subscription: (matchesForQuery.workspacesQueryWithSub[1] || '').trim(),
            };
            return queryDetails;
        }
        if (matchesForQuery.workspacesQuery && defaultSubscriptionId) {
            const queryDetails = {
                kind: 'WorkspacesQuery',
                rawQuery,
                subscription: defaultSubscriptionId,
            };
            return queryDetails;
        }
        // fallback
        const queryDetails = { kind: 'SubscriptionsQuery', rawQuery };
        return queryDetails;
    };
    const query = {
        refId: 'A',
        queryType: AzureQueryType.GrafanaTemplateVariableFn,
        grafanaTemplateVariableFn: createGrafanaTemplateVariableDetails(),
        subscription: defaultSubscriptionId,
    };
    return query;
};
const createLogAnalyticsTemplateVariableQuery = (rawQuery, datasource) => __awaiter(void 0, void 0, void 0, function* () {
    const defaultSubscriptionId = datasource.azureMonitorDatasource.defaultSubscriptionId;
    let resource = '';
    // if there's an existing query, we try to get the resourcesuri from a deprecated default workspace
    // a note this is very similar logic to what is used in useMigrations but moved out of the react-hook land
    if (rawQuery) {
        const defaultWorkspaceId = datasource.azureLogAnalyticsDatasource.getDeprecatedDefaultWorkSpace();
        if (defaultWorkspaceId) {
            const isWorkspaceGUID = isGUIDish(defaultWorkspaceId);
            if (isWorkspaceGUID) {
                resource = yield datasource.resourcePickerData.getResourceURIFromWorkspace(defaultWorkspaceId);
            }
            else {
                resource = defaultWorkspaceId;
            }
        }
        else {
            const maybeFirstWorkspace = yield datasource.azureLogAnalyticsDatasource.getFirstWorkspace();
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
});
const migrateGrafanaTemplateVariableFn = (query) => {
    const { queryType, grafanaTemplateVariableFn } = query;
    if (queryType !== AzureQueryType.GrafanaTemplateVariableFn || !grafanaTemplateVariableFn) {
        return query;
    }
    const migratedQuery = Object.assign({}, query);
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
export const migrateStringQueriesToObjectQueries = (rawQuery, options) => __awaiter(void 0, void 0, void 0, function* () {
    // no need to migrate already migrated queries
    if (typeof rawQuery !== 'string') {
        return rawQuery;
    }
    return isGrafanaTemplateVariableFnQuery(rawQuery)
        ? createGrafanaTemplateVariableQuery(rawQuery, options.datasource)
        : createLogAnalyticsTemplateVariableQuery(rawQuery, options.datasource);
});
export const migrateQuery = (rawQuery, options) => __awaiter(void 0, void 0, void 0, function* () {
    let query = yield migrateStringQueriesToObjectQueries(rawQuery, options);
    if (query.queryType === AzureQueryType.GrafanaTemplateVariableFn) {
        query = migrateGrafanaTemplateVariableFn(query);
    }
    return query;
});
//# sourceMappingURL=grafanaTemplateVariableFns.js.map