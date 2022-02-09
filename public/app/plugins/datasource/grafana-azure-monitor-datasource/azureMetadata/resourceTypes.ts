// Unfortunately this list is manually maintained as there's no (nice) automated way to get
// data from Azure.

export const resourceTypeMetadata = [
  {
    resourceType: 'microsoft.analysisservices/servers',
    displayName: 'Analysis Services',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.synapse/workspaces/bigdatapools',
    displayName: 'Apache Spark pool',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.apimanagement/service',
    displayName: 'API Management service',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.appconfiguration/configurationstores',
    displayName: 'App Configuration',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.web/sites/slots',
    displayName: 'App Service (Slot)',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.web/hostingenvironments',
    displayName: 'App Service Environment',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.web/serverfarms',
    displayName: 'App Service plan',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.web/sites',
    displayName: 'App Service',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.network/applicationgateways',
    displayName: 'Application gateway',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.insights/components',
    displayName: 'Application Insights',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.automation/automationaccounts',
    displayName: 'Automation Account',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.insights/autoscalesettings',
    displayName: 'Autoscale Settings',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.aadiam/azureadmetrics',
    displayName: 'Azure AD Metrics',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.cache/redis',
    displayName: 'Azure Cache for Redis',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.documentdb/databaseaccounts',
    displayName: 'Azure Cosmos DB account',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.kusto/clusters',
    displayName: 'Azure Data Explorer Cluster',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.dbformariadb/servers',
    displayName: 'Azure Database for MariaDB server',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.dbformysql/servers',
    displayName: 'Azure Database for MySQL server',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.dbforpostgresql/flexibleservers',
    displayName: 'Azure Database for PostgreSQL flexible server',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.dbforpostgresql/servergroupsv2',
    displayName: 'Azure Database for PostgreSQL server group',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.dbforpostgresql/servers',
    displayName: 'Azure Database for PostgreSQL server',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.dbforpostgresql/serversv2',
    displayName: 'Azure Database for PostgreSQL server v2',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.resources/subscriptions',
    displayName: 'Subscription',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.appplatform/spring',
    displayName: 'Azure Spring Cloud',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.databoxedge/databoxedgedevices',
    displayName: 'Azure Stack Edge / Data Box Gateway',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.azurestackresourcemonitor/storageaccountmonitor',
    displayName: 'Azure Stack Resource Monitor',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.synapse/workspaces',
    displayName: 'Synapse workspace',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.network/bastionhosts',
    displayName: 'Bastion',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.batch/batchaccounts',
    displayName: 'Batch account',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.botservice/botservices',
    displayName: 'Bot Service',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.netapp/netappaccounts/capacitypools',
    displayName: 'Capacity pool',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.classiccompute/domainnames',
    displayName: 'Cloud service (classic)',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.vmwarecloudsimple/virtualmachines',
    displayName: 'CloudSimple Virtual Machine',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.cognitiveservices/accounts',
    displayName: 'Cognitive Services',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.network/networkwatchers/connectionmonitors',
    displayName: 'Connection Monitors',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.network/connections',
    displayName: 'Connection',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.containerinstance/containergroups',
    displayName: 'Container instances',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.containerregistry/registries',
    displayName: 'Container registry',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.insights/qos',
    displayName: 'Custom Metric Usage',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.customerinsights/hubs',
    displayName: 'CustomerInsights',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.datafactory/datafactories',
    displayName: 'Data factory',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.datafactory/factories',
    displayName: 'Data factory (V2)',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.datalakeanalytics/accounts',
    displayName: 'Data Lake Analytics',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.datalakestore/accounts',
    displayName: 'Data Lake Storage Gen1',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.datashare/accounts',
    displayName: 'Data Share',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.synapse/workspaces/sqlpools',
    displayName: 'Dedicated SQL pool',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.devices/provisioningservices',
    displayName: 'Device Provisioning Service',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.compute/disks',
    displayName: 'Disk',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.network/dnszones',
    displayName: 'DNS zone',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.eventgrid/domains',
    displayName: 'Event Grid Domain',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.eventgrid/systemtopics',
    displayName: 'Event Grid System Topic',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.eventgrid/topics',
    displayName: 'Event Grid Topic',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.eventhub/clusters',
    displayName: 'Event Hubs Cluster',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.eventhub/namespaces',
    displayName: 'Event Hubs Namespace',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.network/expressroutecircuits',
    displayName: 'ExpressRoute circuit',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.network/expressrouteports',
    displayName: 'ExpressRoute Direct',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.network/expressroutegateways',
    displayName: 'ExpressRoute Gateways',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.fabric.admin/fabriclocations',
    displayName: 'Fabric Locations',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.network/azurefirewalls',
    displayName: 'Firewall',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.network/frontdoors',
    displayName: 'Front Door',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.hdinsight/clusters',
    displayName: 'HDInsight cluster',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.storagecache/caches',
    displayName: 'HPC cache',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.logic/integrationserviceenvironments',
    displayName: 'Integration Service Environment',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.iotcentral/iotapps',
    displayName: 'IoT Central Application',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.devices/iothubs',
    displayName: 'IoT Hub',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.keyvault/vaults',
    displayName: 'Key vault',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.kubernetes/connectedclusters',
    displayName: 'Kubernetes - Azure Arc',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.containerservice/managedclusters',
    displayName: 'Kubernetes service',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.media/mediaservices/liveevents',
    displayName: 'Live event',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.network/loadbalancers',
    displayName: 'Load balancer',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.operationalinsights/workspaces',
    displayName: 'Log Analytics workspace',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.logic/workflows',
    displayName: 'Logic app',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.machinelearningservices/workspaces',
    displayName: 'Machine learning',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.media/mediaservices',
    displayName: 'Media service',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.network/natgateways',
    displayName: 'NAT gateway',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.network/networkinterfaces',
    displayName: 'Network interface',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.network/networkvirtualappliances',
    displayName: 'Network Virtual Appliances',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.network/networkwatchers',
    displayName: 'Network Watcher',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.notificationhubs/namespaces/notificationhubs',
    displayName: 'Notification Hub',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.network/p2svpngateways',
    displayName: 'P2S VPN Gateways',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.peering/peeringservices',
    displayName: 'Peering Service',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.powerbidedicated/capacities',
    displayName: 'Power BI Embedded',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.network/privateendpoints',
    displayName: 'Private endpoint',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.network/privatelinkservices',
    displayName: 'Private link service',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.network/publicipaddresses',
    displayName: 'Public IP address',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.cache/redisenterprise',
    displayName: 'Redis Enterprise',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.relay/namespaces',
    displayName: 'Relay',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.synapse/workspaces/scopepools',
    displayName: 'Scope pool',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.search/searchservices',
    displayName: 'Search service',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.servicebus/namespaces',
    displayName: 'Service Bus Namespace',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.signalrservice/signalr',
    displayName: 'SignalR',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.operationsmanagement/solutions',
    displayName: 'Solution',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.sql/servers/databases',
    displayName: 'SQL database',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.sql/servers/elasticpools',
    displayName: 'SQL elastic pool',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.sql/managedinstances',
    displayName: 'SQL managed instance',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.storage/storageaccounts',
    displayName: 'Storage account',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.classicstorage/storageaccounts',
    displayName: 'Storage account (classic)',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.storagesync/storagesyncservices',
    displayName: 'Storage Sync Service',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.streamanalytics/streamingjobs',
    displayName: 'Stream Analytics job',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.media/mediaservices/streamingendpoints',
    displayName: 'Streaming Endpoint',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.timeseriesinsights/environments',
    displayName: 'Time Series Insights environment',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.network/trafficmanagerprofiles',
    displayName: 'Traffic Manager profile',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.compute/virtualmachinescalesets',
    displayName: 'Virtual machine scale set',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.compute/virtualmachines',
    displayName: 'Virtual machine',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.classiccompute/virtualmachines',
    displayName: 'Virtual machine (classic)',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.network/virtualnetworkgateways',
    displayName: 'Virtual network gateway',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.netapp/netappaccounts/capacitypools/volumes',
    displayName: 'Volume',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.network/vpngateways',
    displayName: 'VPN Gateways',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.cdn/cdnwebapplicationfirewallpolicies',
    displayName: 'Content Delivery Network WAF policy',
    supportsLogs: true,
  },
  {
    resourceType: 'microsoft.web/hostingenvironments/workerpools',
    displayName: 'WorkerPools',
    supportsLogs: true,
  },
];

export const logsSupportedResourceTypesKusto = resourceTypeMetadata
  .filter((v) => v.supportsLogs)
  .map((v) => `"${v.resourceType}"`)
  .join(',');

// Object, keyed by resourceType ID
export const resourceTypeDisplayNames: Record<string, string> = resourceTypeMetadata.reduce(
  (acc, resourceType) => ({
    ...acc,
    [resourceType.resourceType]: resourceType.displayName,
  }),
  {}
);
