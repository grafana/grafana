import { getBackendSrv } from '@grafana/runtime';
import { EntryType, Row, RowGroup } from '../components/ResourcePicker/types';
import produce from 'immer';

const RESOURCE_GRAPH_URL =
  '/resourcepickerdata/providers/Microsoft.ResourceGraph/resources?api-version=2020-04-01-preview';

export default class ResourcePickerData {
  private _proxyUrl: string;
  private _formattedResourcePickerData: RowGroup;

  constructor(proxyUrl?: string) {
    this._proxyUrl = proxyUrl!;
    this._formattedResourcePickerData = {};
  }

  async getResourcePickerData() {
    // returns whatever is cached in memory, only loads data if it has none
    const hasPreviouslyLoadedResourcePickerData = Object.keys(this._formattedResourcePickerData).length > 0;
    if (hasPreviouslyLoadedResourcePickerData) {
      return this._formattedResourcePickerData;
    }

    // "resourcecontainers" includes subscriptions and resource groups aka directories that contain resources
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
      return this._formattedResourcePickerData;
    }

    // check to see if we've already loaded nested resources for this resource group
    // if we have, return whatever is in memory
    const subscriptionObj = this._formattedResourcePickerData[resourceGroup.subscriptionId];
    const resourceGroupObj = subscriptionObj?.children && subscriptionObj.children[resourceGroup.name.toLowerCase()];
    const hasPreviouslyLoadedResoucesForResourceGroup =
      resourceGroupObj?.children && Object.keys(resourceGroupObj.children).length > 0;
    if (hasPreviouslyLoadedResoucesForResourceGroup) {
      return this._formattedResourcePickerData;
    }

    const { ok, data: response } = await this._makeResourceGraphRequest(
      // this query would ideally just be resources | where resourceGroup == resourceName
      // however if we do that we return back a lot of resources that do not have logs or metrics for us to graph
      // this where clause filters out only the resources we believe we can represent
      // TODO: verify that this is a good list (it's based off of what is found in the azure portal)
      `resources 
  | where resourceGroup == "${resourceGroup.name.toLowerCase()}"
  | where type in ("microsoft.analysisservices/servers","microsoft.apimanagement/service","microsoft.network/applicationgateways","microsoft.insights/components","microsoft.web/hostingenvironments","microsoft.web/serverfarms","microsoft.web/sites","microsoft.automation/automationaccounts","microsoft.botservice/botservices","microsoft.appplatform/spring","microsoft.network/bastionhosts","microsoft.batch/batchaccounts","microsoft.cdn/cdnwebapplicationfirewallpolicies","microsoft.classiccompute/domainnames","microsoft.classiccompute/virtualmachines","microsoft.vmwarecloudsimple/virtualmachines","microsoft.cognitiveservices/accounts","microsoft.appconfiguration/configurationstores","microsoft.network/connections","microsoft.containerinstance/containergroups","microsoft.containerregistry/registries","microsoft.containerservice/managedclusters","microsoft.documentdb/databaseaccounts","microsoft.databoxedge/databoxedgedevices","microsoft.datafactory/datafactories","microsoft.datafactory/factories","microsoft.datalakeanalytics/accounts","microsoft.datalakestore/accounts","microsoft.datashare/accounts","microsoft.dbformysql/servers","microsoft.devices/provisioningservices","microsoft.compute/disks","microsoft.network/dnszones","microsoft.eventgrid/domains","microsoft.eventgrid/topics","microsoft.eventgrid/systemtopics","microsoft.eventhub/namespaces","microsoft.eventhub/clusters","microsoft.network/expressroutecircuits","microsoft.network/expressrouteports","microsoft.network/azurefirewalls","microsoft.network/frontdoors","microsoft.hdinsight/clusters","microsoft.iotcentral/iotapps","microsoft.devices/iothubs","microsoft.keyvault/vaults","microsoft.kubernetes/connectedclusters","microsoft.kusto/clusters","microsoft.network/loadbalancers","microsoft.operationalinsights/workspaces","microsoft.logic/workflows","microsoft.logic/integrationserviceenvironments","microsoft.machinelearningservices/workspaces","microsoft.dbformariadb/servers","microsoft.media/mediaservices","microsoft.media/mediaservices/streamingendpoints","microsoft.network/natgateways","microsoft.netapp/netappaccounts/capacitypools","microsoft.netapp/netappaccounts/capacitypools/volumes","microsoft.network/networkinterfaces","microsoft.notificationhubs/namespaces/notificationhubs","microsoft.peering/peeringservices","microsoft.dbforpostgresql/servers","microsoft.dbforpostgresql/serversv2","microsoft.powerbidedicated/capacities","microsoft.network/privateendpoints","microsoft.network/privatelinkservices","microsoft.network/publicipaddresses","microsoft.cache/redis","microsoft.cache/redisenterprise","microsoft.relay/namespaces","microsoft.search/searchservices","microsoft.dbforpostgresql/servergroupsv2","microsoft.servicebus/namespaces","microsoft.signalrservice/signalr","microsoft.operationsmanagement/solutions","microsoft.sql/managedinstances","microsoft.sql/servers/databases","microsoft.sql/servers/elasticpools","microsoft.storage/storageaccounts","microsoft.storagecache/caches","microsoft.classicstorage/storageaccounts","microsoft.storagesync/storagesyncservices","microsoft.streamanalytics/streamingjobs","microsoft.synapse/workspaces","microsoft.synapse/workspaces/bigdatapools","microsoft.synapse/workspaces/scopepools","microsoft.synapse/workspaces/sqlpools","microsoft.timeseriesinsights/environments","microsoft.network/trafficmanagerprofiles","microsoft.compute/virtualmachines","microsoft.compute/virtualmachinescalesets","microsoft.network/virtualnetworkgateways","microsoft.web/sites/slots","microsoft.resources/subscriptions","microsoft.insights/autoscalesettings","microsoft.aadiam/azureadmetrics","microsoft.azurestackresourcemonitor/storageaccountmonitor","microsoft.network/networkwatchers/connectionmonitors","microsoft.customerinsights/hubs","microsoft.insights/qos","microsoft.network/expressroutegateways","microsoft.fabric.admin/fabriclocations","microsoft.network/networkvirtualappliances","microsoft.media/mediaservices/liveevents","microsoft.network/networkwatchers","microsoft.network/p2svpngateways","microsoft.dbforpostgresql/flexibleservers","microsoft.network/vpngateways","microsoft.web/hostingenvironments/workerpools") and location in ("eastus","eastus2","southcentralus","westus2","westus3","australiaeast","southeastasia","northeurope","uksouth","westeurope","centralus","northcentralus","westus","southafricanorth","centralindia","eastasia","japaneast","jioindiawest","koreacentral","canadacentral","francecentral","germanywestcentral","norwayeast","switzerlandnorth","uaenorth","brazilsouth","centralusstage","eastusstage","eastus2stage","northcentralusstage","southcentralusstage","westusstage","westus2stage","asia","asiapacific","australia","brazil","canada","europe","global","india","japan","uk","unitedstates","eastasiastage","southeastasiastage","westcentralus","southafricawest","australiacentral","australiacentral2","australiasoutheast","japanwest","koreasouth","southindia","westindia","canadaeast","francesouth","germanynorth","norwaywest","switzerlandwest","ukwest","uaecentral","brazilsoutheast") `
    );

    // TODO: figure out desired error handling strategy
    if (!ok) {
      throw new Error('unable to fetch resource containers');
    }

    return this._formatAndCacheResourceData(response.data);
  }

  /*
    takes data formated like this:
    [{Subscription},{Resource Group}] or like this:[{Resource}]
    and transforms to data that looks like this:
    { 
      subscriptionId: {
        ...subscription data

        children: {
          resourceGroupName: {
            ...resource group data

            children: {
              resourceId: {
                ...resource data
              }
            }
          }
        }
      }
    }
  */
  _formatAndCacheResourceData(rawData: any[]) {
    // "produce" from immer takes in an object, allows you to edit a copy of that object and then returns a new object
    this._formattedResourcePickerData = produce(this._formattedResourcePickerData, (draftState: any) => {
      rawData.forEach((item: any) => {
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

    return this._formattedResourcePickerData;
  }

  async _makeResourceGraphRequest(query: string, maxRetries = 1): Promise<any> {
    try {
      return getBackendSrv()
        .fetch({
          url: this._proxyUrl + RESOURCE_GRAPH_URL,
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
