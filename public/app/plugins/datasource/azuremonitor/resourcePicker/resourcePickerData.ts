import { DataSourceWithBackend, reportInteraction } from '@grafana/runtime';

import { logsResourceTypes } from '../azureMetadata/logsResourceTypes';
import { resourceTypeDisplayNames, resourceTypes } from '../azureMetadata/resourceTypes';
import AzureMonitorDatasource from '../azure_monitor/azure_monitor_datasource';
import AzureResourceGraphDatasource from '../azure_resource_graph/azure_resource_graph_datasource';
import { ResourceRow, ResourceRowGroup, ResourceRowType } from '../components/ResourcePicker/types';
import {
  addResources,
  findRow,
  parseMultipleResourceDetails,
  parseResourceDetails,
  parseResourceURI,
  resourceToString,
} from '../components/ResourcePicker/utils';
import { AzureMonitorQuery, AzureMonitorResource } from '../types/query';
import {
  AzureMonitorDataSourceInstanceSettings,
  AzureMonitorDataSourceJsonData,
  AzureResourceSummaryItem,
  RawAzureResourceItem,
  ResourceGraphFilters,
} from '../types/types';

const logsSupportedResourceTypesKusto = logsResourceTypes.map((v) => `"${v}"`).join(',');

export type ResourcePickerQueryType = 'logs' | 'metrics' | 'traces';

export default class ResourcePickerData extends DataSourceWithBackend<
  AzureMonitorQuery,
  AzureMonitorDataSourceJsonData
> {
  resultLimit = 200;
  azureMonitorDatasource;
  azureResourceGraphDatasource;
  supportedMetricNamespaces = '';

  constructor(
    instanceSettings: AzureMonitorDataSourceInstanceSettings,
    azureMonitorDatasource: AzureMonitorDatasource,
    azureResourceGraphDatasource: AzureResourceGraphDatasource
  ) {
    super(instanceSettings);
    this.azureMonitorDatasource = azureMonitorDatasource;
    this.azureResourceGraphDatasource = azureResourceGraphDatasource;
  }

  async fetchInitialRows(
    type: ResourcePickerQueryType,
    currentSelection?: AzureMonitorResource[],
    filters?: ResourceGraphFilters
  ): Promise<ResourceRowGroup> {
    try {
      const subscriptions = await this.getSubscriptions(filters);

      if (!currentSelection) {
        return subscriptions;
      }

      let resources = subscriptions;
      const promises = currentSelection.map((selection) => async () => {
        if (selection.subscription) {
          const resourceGroupURI = `/subscriptions/${selection.subscription}/resourceGroups/${selection.resourceGroup}`;

          if (selection.resourceGroup && !findRow(resources, resourceGroupURI)) {
            const resourceGroups = await this.getResourceGroupsBySubscriptionId(selection.subscription, type);
            resources = addResources(resources, `/subscriptions/${selection.subscription}`, resourceGroups);
          }

          const resourceURI = resourceToString(selection);
          if (selection.resourceName && !findRow(resources, resourceURI)) {
            const resourcesForResourceGroup = await this.getResourcesForResourceGroup(resourceGroupURI, type);
            resources = addResources(resources, resourceGroupURI, resourcesForResourceGroup);
          }
        }
      });

      for (const promise of promises) {
        // Fetch resources one by one, avoiding re-fetching the same resource
        // and race conditions updating the resources array
        await promise();
      }

      return resources;
    } catch (err) {
      if (err instanceof Error) {
        if (err.message !== 'No subscriptions were found') {
          throw err;
        }
        if (filters) {
          return [];
        }
      }
      throw err;
    }
  }

  async fetchAndAppendNestedRow(
    rows: ResourceRowGroup,
    parentRow: ResourceRow,
    type: ResourcePickerQueryType,
    filters?: ResourceGraphFilters
  ): Promise<ResourceRowGroup> {
    const nestedRows =
      parentRow.type === ResourceRowType.Subscription
        ? await this.getResourceGroupsBySubscriptionId(parentRow.id, type, filters)
        : await this.getResourcesForResourceGroup(parentRow.uri, type, filters);

    return addResources(rows, parentRow.uri, nestedRows);
  }

  search = async (
    searchPhrase: string,
    searchType: ResourcePickerQueryType,
    filters: ResourceGraphFilters
  ): Promise<ResourceRowGroup> => {
    let searchQuery = 'resources';
    if (searchType === 'logs') {
      searchQuery += `
      | union resourcecontainers`;
    }

    const filtersQuery = createFilter(filters);
    searchQuery += `
        | where id contains "${searchPhrase}"
        ${await this.filterByType(searchType)}
        ${filtersQuery}
        | order by tolower(name) asc
        | limit ${this.resultLimit}
      `;
    const response =
      await this.azureResourceGraphDatasource.pagedResourceGraphRequest<RawAzureResourceItem>(searchQuery);
    return response.map((item) => {
      const parsedUri = parseResourceURI(item.id);
      if (!parsedUri || !(parsedUri.resourceName || parsedUri.resourceGroup || parsedUri.subscription)) {
        throw new Error('unable to fetch resource details');
      }
      let id = parsedUri.subscription ?? '';
      let type = ResourceRowType.Subscription;
      if (parsedUri.resourceName) {
        id = parsedUri.resourceName;
        type = ResourceRowType.Resource;
      } else if (parsedUri.resourceGroup) {
        id = parsedUri.resourceGroup;
        type = ResourceRowType.ResourceGroup;
      }
      return {
        name: item.name,
        id,
        uri: item.id,
        resourceGroupName: item.resourceGroup,
        type,
        typeLabel: resourceTypeDisplayNames[item.type] || item.type,
        location: item.location,
      };
    });
  };

  async getSubscriptions(filters?: ResourceGraphFilters): Promise<ResourceRowGroup> {
    const subscriptions = await this.azureResourceGraphDatasource.getSubscriptions(filters);

    if (!subscriptions.length) {
      throw new Error('No subscriptions were found');
    }

    return subscriptions.map((subscription) => ({
      name: subscription.subscriptionName,
      id: subscription.subscriptionId,
      uri: `/subscriptions/${subscription.subscriptionId}`,
      typeLabel: 'Subscription',
      type: ResourceRowType.Subscription,
      children: [],
    }));
  }

  async getResourceGroupsBySubscriptionId(
    subscriptionId: string,
    type: ResourcePickerQueryType,
    filters?: ResourceGraphFilters
  ): Promise<ResourceRowGroup> {
    const filter = await this.filterByType(type);

    const resourceGroups = await this.azureResourceGraphDatasource.getResourceGroups(subscriptionId, filter, filters);

    return resourceGroups.map((r) => {
      const parsedUri = parseResourceURI(r.resourceGroupURI);
      if (!parsedUri || !parsedUri.resourceGroup) {
        throw new Error('unable to fetch resource groups');
      }
      return {
        name: r.resourceGroupName,
        uri: r.resourceGroupURI,
        id: parsedUri.resourceGroup,
        type: ResourceRowType.ResourceGroup,
        typeLabel: 'Resource Group',
        children: [],
      };
    });
  }

  // Refactor this one out at a later date
  async getResourcesForResourceGroup(
    uri: string,
    type: ResourcePickerQueryType,
    filters?: ResourceGraphFilters
  ): Promise<ResourceRowGroup> {
    const resources = await this.azureResourceGraphDatasource.getResourceNames(
      { uri },
      await this.filterByType(type),
      filters
    );

    return resources.map((resource) => {
      return {
        name: resource.name,
        id: resource.name,
        uri: resource.id,
        resourceGroupName: resource.resourceGroup,
        type: ResourceRowType.Resource,
        typeLabel: resourceTypeDisplayNames[resource.type] || resource.type,
        locationDisplayName: resource.location,
        location: resource.location,
      };
    });
  }

  // used to make the select resource button that launches the resource picker show a nicer file path to users
  async getResourceURIDisplayProperties(resourceURI: string): Promise<AzureMonitorResource> {
    const { subscription, resourceGroup, resourceName } = parseResourceDetails(resourceURI) ?? {};

    if (!subscription) {
      throw new Error('Invalid resource URI passed');
    }

    // resourceGroupURI and resourceURI could be invalid values, but that's okay because the join
    // will just silently fail as expected
    const subscriptionURI = `/subscriptions/${subscription}`;
    const resourceGroupURI = `${subscriptionURI}/resourceGroups/${resourceGroup}`;

    const query = `
    resourcecontainers
    | where type == "microsoft.resources/subscriptions"
    | where id =~ "${subscriptionURI}"
    | project subscriptionName=name, subscriptionId

    | join kind=leftouter (
      resourcecontainers            
            | where type == "microsoft.resources/subscriptions/resourcegroups"
            | where id =~ "${resourceGroupURI}"
            | project resourceGroupName=name, resourceGroup, subscriptionId
        ) on subscriptionId

        | join kind=leftouter (
          resources
            | where id =~ "${resourceURI}"
            | project resourceName=name, subscriptionId
        ) on subscriptionId

        | project subscriptionName, resourceGroupName, resourceName
    `;

    const response = await this.azureResourceGraphDatasource.pagedResourceGraphRequest<AzureResourceSummaryItem>(query);

    if (!response.length) {
      throw new Error('unable to fetch resource details');
    }

    const { subscriptionName, resourceGroupName, resourceName: responseResourceName } = response[0];
    // if the name is undefined it could be because the id is undefined or because we are using a template variable.
    // Either way we can use it as a fallback. We don't really want to interpolate these variables because we want
    // to show the user when they are using template variables `$sub/$rg/$resource`
    return {
      subscription: subscriptionName || subscription,
      resourceGroup: resourceGroupName || resourceGroup,
      resourceName: responseResourceName || resourceName,
    };
  }

  async getResourceURIFromWorkspace(workspace: string) {
    const response = await this.azureResourceGraphDatasource.pagedResourceGraphRequest<RawAzureResourceItem>(`
      resources
      | where properties['customerId'] == "${workspace}"
      | project id
    `);

    if (!response.length) {
      throw new Error('unable to find resource for workspace ' + workspace);
    }

    return response[0].id;
  }

  private filterByType = async (t: ResourcePickerQueryType) => {
    if (this.supportedMetricNamespaces === '' && t !== 'logs') {
      await this.fetchAllNamespaces();
    }
    return t === 'logs'
      ? `| where type in (${logsSupportedResourceTypesKusto})`
      : `| where type in (${this.supportedMetricNamespaces})`;
  };

  private async fetchAllNamespaces() {
    const subscriptions = await this.getSubscriptions();
    reportInteraction('grafana_ds_azuremonitor_subscriptions_loaded', { subscriptions: subscriptions.length });

    let supportedMetricNamespaces: Set<string> = new Set();
    // Include a predefined set of metric namespaces as a fallback in the case the user cannot query subscriptions
    resourceTypes.forEach((namespace) => {
      supportedMetricNamespaces.add(`"${namespace}"`);
    });

    // We make use of these three regions as they *should* contain every possible namespace
    const regions = ['westeurope', 'eastus', 'japaneast'];
    const getNamespacesForRegion = async (region: string) => {
      const namespaces = await this.azureMonitorDatasource.getMetricNamespaces(
        {
          // We only need to run this request against the first available subscription
          resourceUri: `/subscriptions/${subscriptions[0].id}`,
        },
        false,
        region
      );
      if (namespaces) {
        for (const namespace of namespaces) {
          supportedMetricNamespaces.add(`"${namespace.value.toLocaleLowerCase()}"`);
        }
      }
    };

    const promises = regions.map((region) => getNamespacesForRegion(region));
    await Promise.all(promises);

    if (supportedMetricNamespaces.size === 0) {
      throw new Error(
        'Unable to resolve a list of valid metric namespaces. Validate the datasource configuration is correct and required permissions have been granted for all subscriptions. Grafana requires at least the Reader role to be assigned.'
      );
    }

    this.supportedMetricNamespaces = Array.from(supportedMetricNamespaces).join(',');
  }

  parseRows(resources: Array<string | AzureMonitorResource>): ResourceRow[] {
    const resourceObjs = parseMultipleResourceDetails(resources);
    const newSelectedRows: ResourceRow[] = [];
    resourceObjs.forEach((resource, i) => {
      let id = resource.resourceName;
      let name = resource.resourceName;
      let rtype = ResourceRowType.Resource;
      if (!id) {
        id = resource.resourceGroup;
        name = resource.resourceGroup;
        rtype = ResourceRowType.ResourceGroup;
        if (!id) {
          id = resource.subscription;
          name = resource.subscription;
          rtype = ResourceRowType.Subscription;
        }
      }
      newSelectedRows.push({
        id: id ?? '',
        name: name ?? '',
        type: rtype,
        uri: resourceToString(resource),
        typeLabel:
          resourceTypeDisplayNames[resource.metricNamespace?.toLowerCase() ?? ''] ?? resource.metricNamespace ?? '',
        location: resource.region,
      });
    });
    return newSelectedRows;
  }
}
export const createFilter = (filters: ResourceGraphFilters) => {
  let filtersQuery = '';
  if (filters) {
    if (filters.subscriptions && filters.subscriptions.length > 0) {
      filtersQuery += `| where subscriptionId in (${filters.subscriptions.map((s) => `"${s.toLowerCase()}"`).join(',')})\n`;
    }
    if (filters.types && filters.types.length > 0) {
      filtersQuery += `| where type in (${filters.types.map((t) => `"${t.toLowerCase()}"`).join(',')})\n`;
    }
    if (filters.locations && filters.locations.length > 0) {
      filtersQuery += `| where location in (${filters.locations.map((l) => `"${l.toLowerCase()}"`).join(',')})\n`;
    }
  }

  return filtersQuery;
};
