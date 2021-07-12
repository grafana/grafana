import { DataSourceWithBackend } from '@grafana/runtime';
import { DataSourceInstanceSettings } from '../../../../../../packages/grafana-data/src';
import {
  locationDisplayNames,
  logsSupportedLocationsKusto,
  logsSupportedResourceTypesKusto,
  resourceTypeDisplayNames,
} from '../azureMetadata';
import { ResourceRowType, ResourceRow, ResourceRowGroup } from '../components/ResourcePicker/types';
import { parseResourceURI } from '../components/ResourcePicker/utils';
import {
  AzureDataSourceJsonData,
  AzureGraphResponse,
  AzureMonitorQuery,
  AzureResourceSummaryItem,
  RawAzureResourceGroupItem,
  RawAzureResourceItem,
} from '../types';
import { routeNames } from '../utils/common';

const RESOURCE_GRAPH_URL = '/providers/Microsoft.ResourceGraph/resources?api-version=2021-03-01';

export default class ResourcePickerData extends DataSourceWithBackend<AzureMonitorQuery, AzureDataSourceJsonData> {
  private resourcePath: string;

  constructor(instanceSettings: DataSourceInstanceSettings<AzureDataSourceJsonData>) {
    super(instanceSettings);
    this.resourcePath = `${routeNames.resourceGraph}`;
  }

  static readonly templateVariableGroupID = '$$grafana-templateVariables$$';

  async getResourcePickerData() {
    const query = `
      resources
        // Put subscription details on each row
        | join kind=leftouter (
          ResourceContainers
            | where type == 'microsoft.resources/subscriptions'
            | project subscriptionName=name, subscriptionURI=id, subscriptionId
          ) on subscriptionId

        // Put resource group details on each row
        | join kind=leftouter (
          ResourceContainers
            | where type == 'microsoft.resources/subscriptions/resourcegroups'
            | project resourceGroupURI=id, resourceGroupName=name, resourceGroup
          ) on resourceGroup

        | where type in (${logsSupportedResourceTypesKusto})

        // Get only unique resource groups and subscriptions. Also acts like a project
        | summarize count() by resourceGroupName, resourceGroupURI, subscriptionName, subscriptionURI
        | order by subscriptionURI asc
    `;

    const response = await this.makeResourceGraphRequest<RawAzureResourceGroupItem[]>(query);

    return formatResourceGroupData(response.data);
  }

  async getResourcesForResourceGroup(resourceGroup: ResourceRow) {
    const { data: response } = await this.makeResourceGraphRequest<RawAzureResourceItem[]>(`
      resources
      | where id hasprefix "${resourceGroup.id}"
      | where type in (${logsSupportedResourceTypesKusto}) and location in (${logsSupportedLocationsKusto})
    `);

    return formatResourceGroupChildren(response);
  }

  async getResourceURIDisplayProperties(resourceURI: string): Promise<AzureResourceSummaryItem> {
    const { subscriptionID, resourceGroup } = parseResourceURI(resourceURI) ?? {};

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

    return response[0];
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

  async makeResourceGraphRequest<T = unknown>(query: string, maxRetries = 1): Promise<AzureGraphResponse<T>> {
    try {
      return await this.postResource(this.resourcePath + RESOURCE_GRAPH_URL, {
        query: query,
        options: {
          resultFormat: 'objectArray',
        },
      });
    } catch (error) {
      if (maxRetries > 0) {
        return this.makeResourceGraphRequest(query, maxRetries - 1);
      }

      throw error;
    }
  }

  transformVariablesToRow(templateVariables: string[]): ResourceRow {
    return {
      id: ResourcePickerData.templateVariableGroupID,
      name: 'Template variables',
      type: ResourceRowType.VariableGroup,
      typeLabel: 'Variables',
      children: templateVariables.map((v) => ({
        id: v,
        name: v,
        type: ResourceRowType.Variable,
        typeLabel: 'Variable',
      })),
    };
  }
}

function formatResourceGroupData(rawData: RawAzureResourceGroupItem[]) {
  // Subscriptions goes into the top level array
  const rows: ResourceRowGroup = [];

  // Array of all the resource groups, with subscription data on each row
  for (const row of rawData) {
    const resourceGroupRow: ResourceRow = {
      name: row.resourceGroupName,
      id: row.resourceGroupURI,
      type: ResourceRowType.ResourceGroup,
      typeLabel: 'Resource Group',
      children: [],
    };

    const subscription = rows.find((v) => v.id === row.subscriptionURI);

    if (subscription) {
      if (!subscription.children) {
        subscription.children = [];
      }

      subscription.children.push(resourceGroupRow);
    } else {
      const newSubscriptionRow = {
        name: row.subscriptionName,
        id: row.subscriptionURI,
        typeLabel: 'Subscription',
        type: ResourceRowType.Subscription,
        children: [resourceGroupRow],
      };

      rows.push(newSubscriptionRow);
    }
  }

  return rows;
}

function formatResourceGroupChildren(rawData: RawAzureResourceItem[]): ResourceRowGroup {
  return rawData.map((item) => ({
    name: item.name,
    id: item.id,
    resourceGroupName: item.resourceGroup,
    type: ResourceRowType.Resource,
    typeLabel: resourceTypeDisplayNames[item.type] || item.type,
    location: locationDisplayNames[item.location] || item.location,
  }));
}
