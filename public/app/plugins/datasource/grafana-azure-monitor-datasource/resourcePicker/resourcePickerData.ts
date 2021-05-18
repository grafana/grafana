import { FetchResponse, getBackendSrv } from '@grafana/runtime';
import { EntryType, Row, RowGroup } from '../components/ResourcePicker/types';
import { SUPPORTED_LOCATIONS, SUPPORTED_RESOURCE_TYPES } from './supportedResources';

const RESOURCE_GRAPH_URL = '/providers/Microsoft.ResourceGraph/resources?api-version=2020-04-01-preview';

const cloudToRoute = (cloud: string) => {
  switch (cloud) {
    case 'govazuremonitor': // Azure US Government
      return '/loganalytics-resourcepickerdata-gov';

    case 'chinaazuremonitor': // Azure China
      return '/loganalytics-resourcepickerdata-china';

    default:
      return '/loganalytics-resourcepickerdata';
  }
};

type RawAzureResourceGroupItem = {
  subscriptionId: string;
  subscriptionName: string;
  resourceGroup: string;
  resourceGroupId: string;
};

type RawAzureResourceItem = {
  id: string;
  name: string;
  subscriptionId: string;
  resourceGroup: string;
  type: string;
  location: string;
};

type AzureResponse = FetchResponse<{ data: RawAzureResourceItem[] | RawAzureResourceGroupItem[] }>;

export default class ResourcePickerData {
  private proxyUrl: string;
  private cloud: string;

  constructor(proxyUrl: string, cloud: string) {
    this.proxyUrl = proxyUrl;
    this.cloud = cloud;
  }

  async getResourcePickerData() {
    const { ok, data: response } = await this.makeResourceGraphRequest(
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

    return this.formatResourceGroupData(response.data as RawAzureResourceGroupItem[]);
  }

  async getResourcesForResourceGroup(resourceGroup: Row) {
    const { ok, data: response } = await this.makeResourceGraphRequest(`
      resources 
      | where resourceGroup == "${resourceGroup.name.toLowerCase()}"
      | where type in (${SUPPORTED_RESOURCE_TYPES}) and location in (${SUPPORTED_LOCATIONS})
    `);

    // TODO: figure out desired error handling strategy
    if (!ok) {
      throw new Error('unable to fetch resource containers');
    }

    return this.formatResourceGroupChildren(response.data as RawAzureResourceItem[]);
  }

  async getResourceURIFromWorkspace(workspace: string) {
    const { ok, data: response } = await this.makeResourceGraphRequest(`
      resources
      | where properties['customerId'] == "${workspace}"
    `);

    // TODO: figure out desired error handling strategy
    if (!ok) {
      throw new Error('unable to fetch resource containers');
    }

    return (response.data[0] as RawAzureResourceItem).id;
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

  async makeResourceGraphRequest(query: string, maxRetries = 1): Promise<AzureResponse> {
    try {
      return getBackendSrv()
        .fetch({
          url: this.proxyUrl + cloudToRoute(this.cloud) + RESOURCE_GRAPH_URL,
          method: 'POST',
          data: {
            query: query,
            options: {
              resultFormat: 'objectArray',
            },
          },
        })
        .toPromise() as Promise<AzureResponse>;
    } catch (error) {
      if (maxRetries > 0) {
        return this.makeResourceGraphRequest(query, maxRetries - 1);
      }

      throw error;
    }
  }
}
