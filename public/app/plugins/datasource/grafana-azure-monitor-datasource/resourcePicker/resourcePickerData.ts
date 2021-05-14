import { getBackendSrv } from '@grafana/runtime';
import produce from 'immer';
import { EntryType, Row, RowGroup } from '../components/ResourcePicker/types';
import { SUPPORTED_LOCATIONS, SUPPORTED_RESOURCE_TYPES } from './supportedResources';

const RESOURCE_GRAPH_URL =
  '/resourcepickerdata/providers/Microsoft.ResourceGraph/resources?api-version=2020-04-01-preview';

type RawAzureResourceGraphDataItem = {
  type: string;
  subscriptionId: string;
  name: string;
  id: string;
  resourceGroup: string;
  location: string;
};

export default class ResourcePickerData {
  private proxyUrl: string;
  private formattedResourcePickerData: RowGroup;

  constructor(proxyUrl?: string) {
    this.proxyUrl = proxyUrl!;
    this.formattedResourcePickerData = {};
  }

  async getResourcePickerData() {
    // returns whatever is cached in memory, only loads data if it has none
    const hasPreviouslyLoadedResourcePickerData = Object.keys(this.formattedResourcePickerData).length > 0;
    if (hasPreviouslyLoadedResourcePickerData) {
      return this.formattedResourcePickerData;
    }

    const { ok, data: response } = await this._makeResourceGraphRequest('resourcecontainers');

    // TODO: figure out desired error handling strategy
    if (!ok) {
      throw new Error('unable to fetch resource containers');
    }

    return this._formatAndCacheResourceData(response.data);
  }

  async getResourcePickerDataWithNestedResourceData(resourceGroup: Row) {
    // subscription data should already be pre-loaded
    if (resourceGroup.typeLabel === 'Subscription') {
      return this.formattedResourcePickerData;
    }

    // check to see if we've already loaded nested resources for this resource group
    // if we have, return whatever is in memory
    const subscriptionObj = this.formattedResourcePickerData[resourceGroup.subscriptionId];
    const resourceGroupObj = subscriptionObj?.children && subscriptionObj.children[resourceGroup.name.toLowerCase()];
    const hasPreviouslyLoadedResoucesForResourceGroup =
      resourceGroupObj?.children && Object.keys(resourceGroupObj.children).length > 0;
    if (hasPreviouslyLoadedResoucesForResourceGroup) {
      return this.formattedResourcePickerData;
    }

    const { ok, data: response } = await this._makeResourceGraphRequest(`
      resources 
      | where resourceGroup == "${resourceGroup.name.toLowerCase()}"
      | where type in (${SUPPORTED_RESOURCE_TYPES}) and location in (${SUPPORTED_LOCATIONS})
    `);

    // TODO: figure out desired error handling strategy
    if (!ok) {
      throw new Error('unable to fetch resource containers');
    }

    return this._formatAndCacheResourceData(response.data);
  }

  _formatAndCacheResourceData(rawData: RawAzureResourceGraphDataItem[]) {
    // "produce" from immer takes in an object, allows you to edit a copy of that object and then returns a new object
    this.formattedResourcePickerData = produce(this.formattedResourcePickerData, (draftState: any) => {
      rawData.forEach((item: RawAzureResourceGraphDataItem) => {
        switch (item.type) {
          case 'microsoft.resources/subscriptions':
            draftState[item.subscriptionId] = {
              // handles potential duplicates (see note on proccessing resource groups before subscriptions)
              ...(draftState[item.subscriptionId] ? draftState[item.subscriptionId] : {}),

              name: item.name,
              id: item.subscriptionId,
              subscriptionId: item.subscriptionId,
              typeLabel: 'Subscription',
              type: EntryType.Collection,
              children: {},
            };

            break;

          case 'microsoft.resources/subscriptions/resourcegroups':
            // handles processing resourcegroup before we encounter it's parent subscription
            if (!draftState[item.subscriptionId]) {
              draftState[item.subscriptionId] = {
                children: {},
              };
            }

            // a note here that we store resource groups by name and not by id because the resources we fetch only have resource group names not ids
            draftState[item.subscriptionId].children[item.name.toLowerCase()] = {
              name: item.name,
              id: item.id,
              subscriptionId: item.subscriptionId,
              type: EntryType.SubCollection,
              typeLabel: 'Resource Group',
              children: {},
            };
            break;

          default:
            // We assume everything else to be a selectable resource
            draftState[item.subscriptionId].children[item.resourceGroup].children[item.id] = {
              name: item.name,
              id: item.id,
              type: EntryType.Resource,
              typeLabel: item.type, // TODO: these types can be quite long, we may wish to format them more
              location: item.location, // TODO: we may wish to format these locations, by default they are written as 'northeurope' rather than a more human readable "North Europe"
            };
        }
      });
    });

    return this.formattedResourcePickerData;
  }

  async _makeResourceGraphRequest(query: string, maxRetries = 1): Promise<any> {
    try {
      return getBackendSrv()
        .fetch({
          url: this.proxyUrl + RESOURCE_GRAPH_URL,
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
        return this._makeResourceGraphRequest(query, maxRetries - 1);
      }

      throw error;
    }
  }
}
