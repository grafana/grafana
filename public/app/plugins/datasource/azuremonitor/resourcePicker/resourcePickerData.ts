import { uniq } from 'lodash';

import { DataSourceInstanceSettings } from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';

import { logsResourceTypes, resourceTypeDisplayNames } from '../azureMetadata';
import AzureMonitorDatasource from '../azure_monitor/azure_monitor_datasource';
import { ResourceRow, ResourceRowGroup, ResourceRowType } from '../components/ResourcePicker/types';
import {
  addResources,
  findRow,
  parseMultipleResourceDetails,
  parseResourceDetails,
  parseResourceURI,
  resourceToString,
} from '../components/ResourcePicker/utils';
import {
  AzureDataSourceJsonData,
  AzureGraphResponse,
  AzureMonitorResource,
  AzureMonitorLocations,
  AzureMonitorQuery,
  AzureResourceGraphOptions,
  AzureResourceSummaryItem,
  RawAzureResourceGroupItem,
  RawAzureResourceItem,
  RawAzureSubscriptionItem,
} from '../types';
import { routeNames } from '../utils/common';

const RESOURCE_GRAPH_URL = '/providers/Microsoft.ResourceGraph/resources?api-version=2021-03-01';

const logsSupportedResourceTypesKusto = logsResourceTypes.map((v) => `"${v}"`).join(',');

export type ResourcePickerQueryType = 'logs' | 'metrics';

export default class ResourcePickerData extends DataSourceWithBackend<AzureMonitorQuery, AzureDataSourceJsonData> {
  private resourcePath: string;
  resultLimit = 200;
  azureMonitorDatasource;
  supportedMetricNamespaces = '';
  locationsMap: Map<string, AzureMonitorLocations> = new Map();
  locations: string[] = [];

  constructor(
    instanceSettings: DataSourceInstanceSettings<AzureDataSourceJsonData>,
    azureMonitorDatasource: AzureMonitorDatasource
  ) {
    super(instanceSettings);
    this.resourcePath = `${routeNames.resourceGraph}`;
    this.azureMonitorDatasource = azureMonitorDatasource;
  }

  async fetchInitialRows(
    type: ResourcePickerQueryType,
    currentSelection?: AzureMonitorResource[]
  ): Promise<ResourceRowGroup> {
    const subscriptions = await this.getSubscriptions();

    if (this.locationsMap.size === 0) {
      this.locationsMap = await this.getLocations(subscriptions);
      this.locations = Array.from(this.locationsMap.values()).map((location) => `"${location.name}"`);
    }

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
  }

  async fetchAndAppendNestedRow(
    rows: ResourceRowGroup,
    parentRow: ResourceRow,
    type: ResourcePickerQueryType
  ): Promise<ResourceRowGroup> {
    const nestedRows =
      parentRow.type === ResourceRowType.Subscription
        ? await this.getResourceGroupsBySubscriptionId(parentRow.id, type)
        : await this.getResourcesForResourceGroup(parentRow.id, type);

    return addResources(rows, parentRow.uri, nestedRows);
  }

  search = async (searchPhrase: string, searchType: ResourcePickerQueryType): Promise<ResourceRowGroup> => {
    let searchQuery = 'resources';
    if (searchType === 'logs') {
      searchQuery += `
      | union resourcecontainers`;
    }
    searchQuery += `
        | where id contains "${searchPhrase}"
        ${await this.filterByType(searchType)}
        | order by tolower(name) asc
        | limit ${this.resultLimit}
      `;
    const { data: response } = await this.makeResourceGraphRequest<RawAzureResourceItem[]>(searchQuery);
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
        location: this.locationsMap.get(item.location)?.displayName || item.location,
      };
    });
  };

  // private
  async getSubscriptions(): Promise<ResourceRowGroup> {
    const query = `
    resources
    | join kind=inner (
              ResourceContainers
                | where type == 'microsoft.resources/subscriptions'
                | project subscriptionName=name, subscriptionURI=id, subscriptionId
              ) on subscriptionId
    | summarize count() by subscriptionName, subscriptionURI, subscriptionId
    | order by subscriptionName desc
  `;

    let resources: RawAzureSubscriptionItem[] = [];

    let allFetched = false;
    let $skipToken = undefined;
    while (!allFetched) {
      // The response may include several pages
      let options: Partial<AzureResourceGraphOptions> = {};
      if ($skipToken) {
        options = {
          $skipToken,
        };
      }
      const resourceResponse = await this.makeResourceGraphRequest<RawAzureSubscriptionItem[]>(query, 1, options);
      if (!resourceResponse.data.length) {
        throw new Error('No subscriptions were found');
      }
      resources = resources.concat(resourceResponse.data);
      $skipToken = resourceResponse.$skipToken;
      allFetched = !$skipToken;
    }

    return resources.map((subscription) => ({
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
    type: ResourcePickerQueryType
  ): Promise<ResourceRowGroup> {
    const query = `
    resources
     | join kind=inner (
       ResourceContainers
       | where type == 'microsoft.resources/subscriptions/resourcegroups'
       | project resourceGroupURI=id, resourceGroupName=name, resourceGroup, subscriptionId
     ) on resourceGroup, subscriptionId

     ${await this.filterByType(type)}
     | where subscriptionId == '${subscriptionId}'
     | summarize count() by resourceGroupName, resourceGroupURI
     | order by resourceGroupURI asc`;

    let resourceGroups: RawAzureResourceGroupItem[] = [];
    let allFetched = false;
    let $skipToken = undefined;
    while (!allFetched) {
      // The response may include several pages
      let options: Partial<AzureResourceGraphOptions> = {};
      if ($skipToken) {
        options = {
          $skipToken,
        };
      }
      const resourceResponse = await this.makeResourceGraphRequest<RawAzureResourceGroupItem[]>(query, 1, options);
      resourceGroups = resourceGroups.concat(resourceResponse.data);
      $skipToken = resourceResponse.$skipToken;
      allFetched = !$skipToken;
    }

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

  async getResourcesForResourceGroup(
    resourceGroupId: string,
    type: ResourcePickerQueryType
  ): Promise<ResourceRowGroup> {
    if (!this.locations) {
      return [];
    }

    const { data: response } = await this.makeResourceGraphRequest<RawAzureResourceItem[]>(`
      resources
      | where id hasprefix "${resourceGroupId}"
      ${await this.filterByType(type)} and location in (${this.locations})
    `);

    return response.map((item) => {
      const parsedUri = parseResourceURI(item.id);
      if (!parsedUri || !parsedUri.resourceName) {
        throw new Error('unable to fetch resource details');
      }
      return {
        name: item.name,
        id: parsedUri.resourceName,
        uri: item.id,
        resourceGroupName: item.resourceGroup,
        type: ResourceRowType.Resource,
        typeLabel: resourceTypeDisplayNames[item.type] || item.type,
        locationDisplayName: this.locationsMap.get(item.location)?.displayName || item.location,
        location: item.location,
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

    const { data: response } = await this.makeResourceGraphRequest<AzureResourceSummaryItem[]>(query);

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
    const { data: response } = await this.makeResourceGraphRequest<RawAzureResourceItem[]>(`
      resources
      | where properties['customerId'] == "${workspace}"
      | project id
    `);

    if (!response.length) {
      throw new Error('unable to find resource for workspace ' + workspace);
    }

    return response[0].id;
  }

  async makeResourceGraphRequest<T = unknown>(
    query: string,
    maxRetries = 1,
    reqOptions?: Partial<AzureResourceGraphOptions>
  ): Promise<AzureGraphResponse<T>> {
    try {
      return await this.postResource(this.resourcePath + RESOURCE_GRAPH_URL, {
        query: query,
        options: {
          resultFormat: 'objectArray',
          ...reqOptions,
        },
      });
    } catch (error) {
      if (maxRetries > 0) {
        return this.makeResourceGraphRequest(query, maxRetries - 1);
      }

      throw error;
    }
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
    let supportedMetricNamespaces: string[] = [];
    for await (const subscription of subscriptions) {
      const namespaces = await this.azureMonitorDatasource.getMetricNamespaces(
        {
          resourceUri: `/subscriptions/${subscription.id}`,
        },
        true
      );
      if (namespaces) {
        const namespaceVals = namespaces.map((namespace) => `"${namespace.value.toLocaleLowerCase()}"`);
        supportedMetricNamespaces = supportedMetricNamespaces.concat(namespaceVals);
      }
    }

    if (supportedMetricNamespaces.length === 0) {
      throw new Error(
        'Unable to resolve a list of valid metric namespaces. Validate the datasource configuration is correct and required permissions have been granted for all subscriptions. Grafana requires at least the Reader role to be assigned.'
      );
    }
    this.supportedMetricNamespaces = uniq(supportedMetricNamespaces).join(',');
  }

  async getLocations(subscriptions: ResourceRowGroup): Promise<Map<string, AzureMonitorLocations>> {
    const subscriptionIds = subscriptions.map((sub) => sub.id);
    const locations = await this.azureMonitorDatasource.getLocations(subscriptionIds);
    return locations;
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
        locationDisplayName: this.locationsMap.get(resource.region ?? '')?.displayName || resource.region,
        location: resource.region,
      });
    });
    return newSelectedRows;
  }
}
