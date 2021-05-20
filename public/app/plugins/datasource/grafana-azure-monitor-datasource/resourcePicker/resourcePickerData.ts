import { FetchResponse, getBackendSrv } from '@grafana/runtime';
import { getLogAnalyticsResourcePickerApiRoute } from '../api/routes';
import { EntryType, Row, RowGroup } from '../components/ResourcePicker/types';
import { getAzureCloud } from '../credentials';
import { AzureDataSourceInstanceSettings, AzureResourceSummaryItem } from '../types';
import { SUPPORTED_LOCATIONS, SUPPORTED_RESOURCE_TYPES } from './supportedResources';

const RESOURCE_GRAPH_URL = '/providers/Microsoft.ResourceGraph/resources?api-version=2020-04-01-preview';

interface RawAzureResourceGroupItem {
  subscriptionId: string;
  subscriptionName: string;
  resourceGroup: string;
  resourceGroupId: string;
}

interface RawAzureResourceItem {
  id: string;
  name: string;
  subscriptionId: string;
  resourceGroup: string;
  type: string;
  location: string;
}

interface AzureGraphResponse<T = unknown> {
  data: T;
}

export default class ResourcePickerData {
  private proxyUrl: string;
  private cloud: string;

  constructor(instanceSettings: AzureDataSourceInstanceSettings) {
    this.proxyUrl = instanceSettings.url!;
    this.cloud = getAzureCloud(instanceSettings);
  }

  async getResourcePickerData() {
    const { ok, data: response } = await this.makeResourceGraphRequest<RawAzureResourceGroupItem[]>(
      `resources
      | join kind=leftouter (ResourceContainers | where type=='microsoft.resources/subscriptions' | project subscriptionName=name, subscriptionId, resourceGroupId=id) on subscriptionId
      | where type in (${SUPPORTED_RESOURCE_TYPES})
      | summarize count() by resourceGroup, subscriptionName, resourceGroupId, subscriptionId
      | order by resourceGroup asc
      `
    );

    // TODO: figure out desired error handling strategy
    if (!ok) {
      throw new Error('unable to fetch resource containers');
    }

    return this.formatResourceGroupData(response.data);
  }

  async getResourcesForResourceGroup(resourceGroup: Row) {
    const { ok, data: response } = await this.makeResourceGraphRequest<RawAzureResourceItem[]>(`
      resources
      | where resourceGroup == "${resourceGroup.name.toLowerCase()}"
      | where type in (${SUPPORTED_RESOURCE_TYPES}) and location in (${SUPPORTED_LOCATIONS})
    `);

    // TODO: figure out desired error handling strategy
    if (!ok) {
      throw new Error('unable to fetch resource containers');
    }

    return this.formatResourceGroupChildren(response.data);
  }

  async getResource(resourceURI: string) {
    const query = `
      resources
        | join (
            resourcecontainers
              | where type == "microsoft.resources/subscriptions"
              | project subscriptionName=name, subscriptionId
          ) on subscriptionId
        | join (
            resourcecontainers
              | where type == "microsoft.resources/subscriptions/resourcegroups"
              | project resourceGroupName=name, resourceGroup
          ) on resourceGroup
        | where id == "${resourceURI}"
        | project id, name, subscriptionName, resourceGroupName
    `;

    const { ok, data: response } = await this.makeResourceGraphRequest<AzureResourceSummaryItem[]>(query);

    if (!ok || !response.data[0]) {
      throw new Error('unable to fetch resource details');
    }

    return response.data[0];
  }

  async getResourceURIFromWorkspace(workspace: string) {
    const { ok, data: response } = await this.makeResourceGraphRequest<RawAzureResourceItem[]>(`
      resources
      | where properties['customerId'] == "${workspace}"
      | project id
    `);

    // TODO: figure out desired error handling strategy
    if (!ok) {
      throw new Error('unable to fetch resource containers');
    }

    if (!response.data.length) {
      throw new Error('unable to find resource for workspace ' + workspace);
    }

    return response.data[0].id;
  }

  formatResourceGroupData(rawData: RawAzureResourceGroupItem[]) {
    const formatedSubscriptionsAndResourceGroups: RowGroup = {};

    rawData.forEach((resourceGroup) => {
      // if the subscription doesn't exist yet, create it
      if (!formatedSubscriptionsAndResourceGroups[resourceGroup.subscriptionId]) {
        formatedSubscriptionsAndResourceGroups[resourceGroup.subscriptionId] = {
          name: resourceGroup.subscriptionName,
          id: resourceGroup.subscriptionId,
          subscriptionId: resourceGroup.subscriptionId,
          typeLabel: 'Subscription',
          type: EntryType.Collection,
          children: {},
        };
      }

      // add the resource group to the subscription
      // store by resourcegroupname not id to match resource uri
      (formatedSubscriptionsAndResourceGroups[resourceGroup.subscriptionId].children as RowGroup)[
        resourceGroup.resourceGroup
      ] = {
        name: resourceGroup.resourceGroup,
        id: resourceGroup.resourceGroupId,
        subscriptionId: resourceGroup.subscriptionId,
        type: EntryType.SubCollection,
        typeLabel: 'Resource Group',
        children: {},
      };
    });

    return formatedSubscriptionsAndResourceGroups;
  }

  formatResourceGroupChildren(rawData: RawAzureResourceItem[]) {
    const children: RowGroup = {};

    rawData.forEach((item: RawAzureResourceItem) => {
      children[item.id] = {
        name: item.name,
        id: item.id,
        subscriptionId: item.id,
        resourceGroupName: item.resourceGroup,
        type: EntryType.Resource,
        typeLabel: item.type, // TODO: these types can be quite long, we may wish to format them more
        location: item.location, // TODO: we may wish to format these locations, by default they are written as 'northeurope' rather than a more human readable "North Europe"
      };
    });

    return children;
  }

  async makeResourceGraphRequest<T = unknown>(
    query: string,
    maxRetries = 1
  ): Promise<FetchResponse<AzureGraphResponse<T>>> {
    try {
      return await getBackendSrv()
        .fetch<AzureGraphResponse<T>>({
          url: this.proxyUrl + '/' + getLogAnalyticsResourcePickerApiRoute(this.cloud) + RESOURCE_GRAPH_URL,
          method: 'POST',
          data: {
            query: query,
            options: {
              resultFormat: 'objectArray',
            },
          },
        })
        .toPromise();
    } catch (error) {
      if (maxRetries > 0) {
        return this.makeResourceGraphRequest(query, maxRetries - 1);
      }

      throw error;
    }
  }
}
