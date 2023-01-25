import { ResourceRowGroup, ResourceRowType } from '../components/ResourcePicker/types';
import { AzureMonitorLocations } from '../types';

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

export const mockGetValidLocations = (): Map<string, AzureMonitorLocations> =>
  new Map([['northeurope', { displayName: 'North Europe', name: 'northeurope', supportsLogs: true }]]);
