import { DataSourceWithBackend } from '@grafana/runtime';

import { DataSourceInstanceSettings } from '../../../../../../packages/grafana-data/src';
import {
  locationDisplayNames,
  logsSupportedLocationsKusto,
  logsResourceTypes,
  resourceTypeDisplayNames,
  supportedMetricNamespaces,
} from '../azureMetadata';
import { ResourceRow, ResourceRowGroup, ResourceRowType } from '../components/ResourcePicker/types';
import { addResources, parseResourceURI } from '../components/ResourcePicker/utils';
import {
  AzureDataSourceJsonData,
  AzureGraphResponse,
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
const supportedMetricNamespacesKusto = supportedMetricNamespaces.map((v) => `"${v.toLocaleLowerCase()}"`).join(',');

export type ResourcePickerQueryType = 'logs' | 'metrics';

export default class ResourcePickerData extends DataSourceWithBackend<AzureMonitorQuery, AzureDataSourceJsonData> {
  private resourcePath: string;
  resultLimit = 200;

  constructor(instanceSettings: DataSourceInstanceSettings<AzureDataSourceJsonData>) {
    super(instanceSettings);
    this.resourcePath = `${routeNames.resourceGraph}`;
  }

  async fetchInitialRows(type: ResourcePickerQueryType, currentSelection?: string): Promise<ResourceRowGroup> {
    const subscriptions = await this.getSubscriptions();
    if (!currentSelection) {
      return subscriptions;
    }

    let resources = subscriptions;
    const parsedURI = parseResourceURI(currentSelection);
    if (parsedURI) {
      const resourceGroupURI = `/subscriptions/${parsedURI.subscriptionID}/resourceGroups/${parsedURI.resourceGroup}`;

      if (parsedURI.resourceGroup) {
        const resourceGroups = await this.getResourceGroupsBySubscriptionId(parsedURI.subscriptionID, type);
        resources = addResources(resources, `/subscriptions/${parsedURI.subscriptionID}`, resourceGroups);
      }

      if (parsedURI.resource) {
        const resourcesForResourceGroup = await this.getResourcesForResourceGroup(resourceGroupURI, type);
        resources = addResources(resources, resourceGroupURI, resourcesForResourceGroup);
      }
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
        ${this.filterByType(searchType)}
        | order by tolower(name) asc
        | limit ${this.resultLimit}
      `;
    const { data: response } = await this.makeResourceGraphRequest<RawAzureResourceItem[]>(searchQuery);
    return response.map((item) => {
      const parsedUri = parseResourceURI(item.id);
      if (!parsedUri || !(parsedUri.resource || parsedUri.resourceGroup || parsedUri.subscriptionID)) {
        throw new Error('unable to fetch resource details');
      }
      let id = parsedUri.subscriptionID;
      let type = ResourceRowType.Subscription;
      if (parsedUri.resource) {
        id = parsedUri.resource;
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
        location: locationDisplayNames[item.location] || item.location,
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

     ${this.filterByType(type)}
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
    const { data: response } = await this.makeResourceGraphRequest<RawAzureResourceItem[]>(`
      resources
      | where id hasprefix "${resourceGroupId}"
      ${this.filterByType(type)} and location in (${logsSupportedLocationsKusto})
    `);

    return response.map((item) => {
      const parsedUri = parseResourceURI(item.id);
      if (!parsedUri || !parsedUri.resource) {
        throw new Error('unable to fetch resource details');
      }
      return {
        name: item.name,
        id: parsedUri.resource,
        uri: item.id,
        resourceGroupName: item.resourceGroup,
        type: ResourceRowType.Resource,
        typeLabel: resourceTypeDisplayNames[item.type] || item.type,
        location: locationDisplayNames[item.location] || item.location,
      };
    });
  }

  // used to make the select resource button that launches the resource picker show a nicer file path to users
  async getResourceURIDisplayProperties(resourceURI: string): Promise<AzureResourceSummaryItem> {
    const { subscriptionID, resourceGroup, resource } = parseResourceURI(resourceURI) ?? {};

    if (!subscriptionID) {
      throw new Error('Invalid resource URI passed');
    }

    // resourceGroupURI and resourceURI could be invalid values, but that's okay because the join
    // will just silently fail as expected
    const subscriptionURI = `/subscriptions/${subscriptionID}`;
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

    const { subscriptionName, resourceGroupName, resourceName } = response[0];
    // if the name is undefined it could be because the id is undefined or because we are using a template variable.
    // Either way we can use it as a fallback. We don't really want to interpolate these variables because we want
    // to show the user when they are using template variables `$sub/$rg/$resource`
    return {
      subscriptionName: subscriptionName || subscriptionID,
      resourceGroupName: resourceGroupName || resourceGroup,
      resourceName: resourceName || resource,
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

  private filterByType = (t: ResourcePickerQueryType) => {
    return t === 'logs'
      ? `| where type in (${logsSupportedResourceTypesKusto})`
      : `| where type in (${supportedMetricNamespacesKusto})`;
  };
}
