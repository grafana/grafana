import { filter, find, includes, startsWith } from 'lodash';

import { ScopedVars } from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv, TemplateSrv } from '@grafana/runtime';

import { resourceTypes } from '../azureMetadata/resourceTypes';
import { ARGScope } from '../dataquery.gen';
import { AzureMonitorQuery, AzureQueryType } from '../types/query';
import {
  AzureGetResourceNamesQuery,
  AzureGraphResponse,
  AzureMonitorDataSourceInstanceSettings,
  AzureMonitorDataSourceJsonData,
  AzureResourceGraphOptions,
  RawAzureResourceGroupItem,
  RawAzureResourceItem,
  RawAzureSubscriptionItem,
} from '../types/types';
import { interpolateVariable, replaceTemplateVariables, routeNames } from '../utils/common';

export default class AzureResourceGraphDatasource extends DataSourceWithBackend<
  AzureMonitorQuery,
  AzureMonitorDataSourceJsonData
> {
  resourcePath: string;
  resourceGraphURL = '/providers/Microsoft.ResourceGraph/resources?api-version=2021-03-01';
  constructor(
    instanceSettings: AzureMonitorDataSourceInstanceSettings,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
    this.resourcePath = routeNames.resourceGraph;
  }

  filterQuery(item: AzureMonitorQuery): boolean {
    return (
      !!item.azureResourceGraph?.query &&
      (item.azureResourceGraph.scope === ARGScope.Directory || (!!item.subscriptions && item.subscriptions.length > 0))
    );
  }

  applyTemplateVariables(target: AzureMonitorQuery, scopedVars: ScopedVars): AzureMonitorQuery {
    const ts = getTemplateSrv();
    const item = target.azureResourceGraph;
    if (!item) {
      return target;
    }
    const variableNames = ts.getVariables().map((v) => `$${v.name}`);
    const subscriptionVar = find(target.subscriptions, (sub) => includes(variableNames, sub));
    const interpolatedSubscriptions = ts
      .replace(subscriptionVar, scopedVars, (v: string[] | string) => v)
      .split(',')
      .filter((v) => v.length > 0);
    const subscriptions = [
      ...interpolatedSubscriptions,
      ...filter(target.subscriptions, (sub) => !includes(variableNames, sub)),
    ];
    const query = ts.replace(item.query, scopedVars, interpolateVariable);

    return {
      ...target,
      queryType: AzureQueryType.AzureResourceGraph,
      subscriptions,
      azureResourceGraph: {
        resultFormat: 'table',
        query,
        scope: item.scope,
      },
    };
  }

  async pagedResourceGraphRequest<T>(query: string, maxRetries = 1): Promise<T[]> {
    try {
      let allFetched = false;
      let $skipToken = undefined;
      let response: T[] = [];
      while (!allFetched) {
        // The response may include several pages
        let options: Partial<AzureResourceGraphOptions> = {};
        if ($skipToken) {
          options = {
            $skipToken,
          };
        }
        const queryResponse = await this.postResource<AzureGraphResponse<T[]>>(
          this.resourcePath + this.resourceGraphURL,
          {
            query: query,
            options: {
              resultFormat: 'objectArray',
              ...options,
            },
          }
        );
        response = response.concat(queryResponse.data);
        $skipToken = queryResponse.$skipToken;
        allFetched = !$skipToken;
      }

      return response;
    } catch (error) {
      if (maxRetries > 0) {
        return this.pagedResourceGraphRequest(query, maxRetries - 1);
      }

      throw error;
    }
  }

  async getSubscriptions() {
    const query = `
        resources
        | join kind=inner (
                  ResourceContainers
                    | where type == 'microsoft.resources/subscriptions'
                    | project subscriptionName=name, subscriptionURI=id, subscriptionId
                  ) on subscriptionId
        | summarize count=count() by subscriptionName, subscriptionURI, subscriptionId
        | order by subscriptionName desc
      `;

    const subscriptions = await this.pagedResourceGraphRequest<RawAzureSubscriptionItem>(query, 1);

    return subscriptions;
  }

  async getResourceGroups(subscriptionId: string, metricNamespacesFilter?: string) {
    // We can use subscription ID for the filtering here as they're unique
    // The logic of this query is:
    // Retrieve _all_ resources a user/app registration/identity has access to
    // Filter by the namespaces that support metrics (if this request is from the resource picker)
    // Filter to resources contained within the subscription
    // Conduct a left-outer join on the resourcecontainers table to allow us to get the case-sensitive resource group name
    // Return the count of resources in a group, the URI, and name of the group in ascending order
    const query = `resources 
    ${metricNamespacesFilter || ''}
    | where subscriptionId == '${subscriptionId}'
    | extend resourceGroupURI = strcat("/subscriptions/", subscriptionId, "/resourcegroups/", resourceGroup) 
    | join kind=leftouter (resourcecontainers  
        | where type =~ 'microsoft.resources/subscriptions/resourcegroups'  
        | project resourceGroupName=name, resourceGroupURI=tolower(id)) on resourceGroupURI 
    | project resourceGroupName=iff(resourceGroupName != "", resourceGroupName, resourceGroup), resourceGroupURI
    | summarize count=count() by resourceGroupName, resourceGroupURI
    | order by tolower(resourceGroupName) asc `;

    const resourceGroups = await this.pagedResourceGraphRequest<RawAzureResourceGroupItem>(query);

    return resourceGroups;
  }

  async getResourceNames(query: AzureGetResourceNamesQuery, metricNamespacesFilter?: string) {
    const promises = replaceTemplateVariables(this.templateSrv, query).map(
      async ({ metricNamespace, subscriptionId, resourceGroup, region, uri }) => {
        const validMetricNamespace = startsWith(metricNamespace?.toLowerCase(), 'microsoft.storage/storageaccounts/')
          ? 'microsoft.storage/storageaccounts'
          : metricNamespace;

        // URI takes precedence over subscription ID and resource group
        let prefix = uri;
        if (!prefix) {
          if (subscriptionId) {
            prefix = `/subscriptions/${subscriptionId}`;
          }
          if (resourceGroup) {
            prefix += `/resourceGroups/${resourceGroup}`;
          }
        }

        const filters: string[] = [];
        if (validMetricNamespace) {
          // Ensure the namespace is always lowercase as that's how it's stored in Resource Graph
          filters.push(`type == '${validMetricNamespace.toLowerCase()}'`);
        }
        if (region) {
          filters.push(`location == '${region}'`);
        }

        // We use URIs for the filtering here because resource group names are not unique across subscriptions
        // We also add a slash at the end of the URI to ensure we do not pull resources from a resource group
        // that has a similar naming prefix e.g. resourceGroup1 and resourceGroup10
        const query = `resources${metricNamespacesFilter ? '\n' + metricNamespacesFilter : ''}
        | where id hasprefix "${prefix}/"
        ${filters.length > 0 ? `| where ${filters.join(' and ')}` : ''}
        | order by tolower(name) asc`;

        const resources = await this.pagedResourceGraphRequest<RawAzureResourceItem>(query);

        return resources;
      }
    );
    return (await Promise.all(promises)).flat();
  }

  // Retrieve metric namespaces relevant to a subscription/resource group/resource
  async getMetricNamespaces(resourceUri: string) {
    const promises = replaceTemplateVariables(this.templateSrv, { resourceUri }).map(async ({ resourceUri }) => {
      const namespacesFilter = resourceTypes.map((type) => `"${type}"`).join(',');
      const query = `
        resources
        | where id hasprefix "${resourceUri}"
        | where type in (${namespacesFilter})
        | project type
        | distinct type
        | order by tolower(type) asc`;

      const namespaces = await this.pagedResourceGraphRequest<RawAzureResourceItem>(query);

      return namespaces.map((r) => {
        return {
          text: r.type,
          value: r.type,
        };
      });
    });
    return (await Promise.all(promises)).flat();
  }
}
