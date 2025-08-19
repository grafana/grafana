import { ResourceRowGroup, ResourceRowType } from '../components/ResourcePicker/types';

export const createMockSubscriptions = (): ResourceRowGroup => [
  {
    id: 'def-123',
    uri: '/subscriptions/def-123',
    name: 'Primary Subscription',
    type: ResourceRowType.Subscription,
    typeLabel: 'Subscription',
    children: [],
  },
  {
    id: 'def-456',
    uri: '/subscriptions/def-456',
    name: 'Dev Subscription',
    type: ResourceRowType.Subscription,
    typeLabel: 'Subscription',
    children: [],
  },
  {
    id: 'def-789',
    uri: '/subscriptions/def-789',
    name: 'Test Subscription',
    type: ResourceRowType.Subscription,
    typeLabel: 'Subscription',
    children: [],
  },
];

export const createMockResourceGroupsBySubscription = (): ResourceRowGroup => [
  {
    id: 'dev-1',
    uri: '/subscriptions/def-456/resourceGroups/dev-1',
    name: 'Development 1',
    type: ResourceRowType.ResourceGroup,
    typeLabel: 'Resource Group',
    children: [],
  },
  {
    id: 'dev-2',
    uri: '/subscriptions/def-456/resourceGroups/dev-2',
    name: 'Development 2',
    type: ResourceRowType.ResourceGroup,
    typeLabel: 'Resource Group',
    children: [],
  },
  {
    id: 'dev-3',
    uri: '/subscriptions/def-456/resourceGroups/dev-3',
    name: 'A Great Resource Group',
    type: ResourceRowType.ResourceGroup,
    typeLabel: 'Resource Group',
    children: [],
  },
  {
    id: 'dev-4',
    uri: '/subscriptions/def-456/resourceGroups/dev-4',
    name: 'Development 3',
    type: ResourceRowType.ResourceGroup,
    typeLabel: 'Resource Group',
    children: [],
  },
  {
    id: 'dev-5',
    uri: '/subscriptions/def-456/resourceGroups/dev-5',
    name: 'Development 4',
    type: ResourceRowType.ResourceGroup,
    typeLabel: 'Resource Group',
    children: [],
  },
];

export const mockResourcesByResourceGroup = (): ResourceRowGroup => [
  {
    id: 'web-server',
    uri: '/subscriptions/def-456/resourceGroups/dev-3/providers/Microsoft.Compute/virtualMachines/web-server',
    name: 'web-server',
    typeLabel: 'Microsoft.Compute/virtualMachines',
    type: ResourceRowType.Resource,
    location: 'northeurope',
  },
  {
    id: 'web-server_DataDisk',
    uri: '/subscriptions/def-456/resourceGroups/dev-3/providers/Microsoft.Compute/disks/web-server_DataDisk',
    name: 'web-server_DataDisk',
    typeLabel: 'Microsoft.Compute/disks',
    type: ResourceRowType.Resource,
    location: 'northeurope',
  },
  {
    id: 'db-server',
    uri: '/subscriptions/def-456/resourceGroups/dev-3/providers/Microsoft.Compute/virtualMachines/db-server',
    name: 'db-server',
    typeLabel: 'Microsoft.Compute/virtualMachines',
    type: ResourceRowType.Resource,
    location: 'northeurope',
  },

  {
    id: 'db-server_DataDisk',
    uri: '/subscriptions/def-456/resourceGroups/dev-3/providers/Microsoft.Compute/disks/db-server_DataDisk',
    name: 'db-server_DataDisk',
    typeLabel: 'Microsoft.Compute/disks',
    type: ResourceRowType.Resource,
    location: 'northeurope',
  },
  {
    id: 'la-workspace',
    uri: '/subscriptions/def-456/resourceGroups/dev-3/providers/microsoft.operationalinsights/workspaces/la-workspace',
    name: 'la-workspace',
    typeLabel: 'Microsoft.OperationalInsights',
    type: ResourceRowType.Resource,
    location: 'northeurope',
  },
  {
    id: 'la-workspace-1',
    uri: '/subscriptions/def-456/resourceGroups/dev-3/providers/microsoft.operationalinsights/workspaces/la-workspace-1',
    name: 'la-workspace-1',
    typeLabel: 'Microsoft.OperationalInsights',
    type: ResourceRowType.Resource,
    location: 'northeurope',
  },
  {
    id: 'app-insights-1',
    uri: '/subscriptions/def-456/resourceGroups/dev-3/providers/microsoft.insights/components/app-insights-1',
    name: 'app-insights-1',
    typeLabel: 'Microsoft.Insights/components',
    type: ResourceRowType.Resource,
    location: 'northeurope',
  },
  {
    id: 'app-insights-2',
    uri: '/subscriptions/def-456/resourceGroups/dev-3/providers/microsoft.insights/components/app-insights-2',
    name: 'app-insights-2',
    typeLabel: 'Microsoft.Insights/components',
    type: ResourceRowType.Resource,
    location: 'northeurope',
  },
];

export const mockSearchResults = (): ResourceRowGroup => [
  {
    id: 'search-result',
    uri: '/subscriptions/def-456/resourceGroups/dev-3/providers/Microsoft.Compute/disks/search-result',
    name: 'search-result',
    typeLabel: 'Microsoft.Compute/disks',
    type: ResourceRowType.Resource,
    location: 'northeurope',
  },
];
