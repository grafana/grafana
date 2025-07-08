import {
  AzureGraphResponse,
  RawAzureResourceGroupItem,
  RawAzureResourceItem,
  RawAzureSubscriptionItem,
} from '../types/types';

export const createMockARGSubscriptionResponse = (): AzureGraphResponse<RawAzureSubscriptionItem[]> => ({
  data: [
    {
      subscriptionId: '1',
      subscriptionName: 'Primary Subscription',
      subscriptionURI: '/subscriptions/1',
      count: 1,
    },
    {
      subscriptionId: '2',
      subscriptionName: 'Dev Subscription',
      subscriptionURI: '/subscriptions/2',
      count: 1,
    },
    {
      subscriptionId: '3',
      subscriptionName: 'Dev Subscription',
      subscriptionURI: '/subscriptions/3',
      count: 1,
    },
    {
      subscriptionId: '4',
      subscriptionName: 'Primary Subscription',
      subscriptionURI: '/subscriptions/4',
      count: 1,
    },
    {
      subscriptionId: '5',
      subscriptionName: 'Primary Subscription',
      subscriptionURI: '/subscriptions/5',
      count: 1,
    },
    {
      subscriptionId: '6',
      subscriptionName: 'Dev Subscription',
      subscriptionURI: '/subscriptions/6',
      count: 1,
    },
  ],
});

export const createMockARGResourceGroupsResponse = (): AzureGraphResponse<RawAzureResourceGroupItem[]> => ({
  data: [
    {
      resourceGroupURI: '/subscriptions/abc-123/resourceGroups/prod',
      resourceGroupName: 'Production',
      count: 1,
    },

    {
      resourceGroupURI: '/subscriptions/def-456/resourceGroups/dev',
      resourceGroupName: 'Development',
      count: 1,
    },

    {
      resourceGroupURI: '/subscriptions/def-456/resourceGroups/test',
      resourceGroupName: 'Test',
      count: 1,
    },

    {
      resourceGroupURI: '/subscriptions/abc-123/resourceGroups/test',
      resourceGroupName: 'Test',
      count: 1,
    },

    {
      resourceGroupURI: '/subscriptions/abc-123/resourceGroups/pre-prod',
      resourceGroupName: 'Pre-production',
      count: 1,
    },

    {
      resourceGroupURI: '/subscriptions/def-456/resourceGroups/qa',
      resourceGroupName: 'QA',
      count: 1,
    },
  ],
});

export const createARGResourcesResponse = (): AzureGraphResponse<RawAzureResourceItem[]> => ({
  data: [
    {
      id: '/subscriptions/def-456/resourceGroups/dev/providers/Microsoft.Compute/virtualMachines/web-server',
      name: 'web-server',
      type: 'Microsoft.Compute/virtualMachines',
      resourceGroup: 'dev',
      subscriptionId: 'def-456',
      location: 'northeurope',
    },

    {
      id: '/subscriptions/def-456/resourceGroups/dev/providers/Microsoft.Compute/disks/web-server_DataDisk',
      name: 'web-server_DataDisk',
      type: 'Microsoft.Compute/disks',
      resourceGroup: 'dev',
      subscriptionId: 'def-456',
      location: 'northeurope',
    },

    {
      id: '/subscriptions/def-456/resourceGroups/dev/providers/Microsoft.Compute/virtualMachines/db-server',
      name: 'db-server',
      type: 'Microsoft.Compute/virtualMachines',
      resourceGroup: 'dev',
      subscriptionId: 'def-456',
      location: 'northeurope',
    },

    {
      id: '/subscriptions/def-456/resourceGroups/dev/providers/Microsoft.Compute/disks/db-server_DataDisk',
      name: 'db-server_DataDisk',
      type: 'Microsoft.Compute/disks',
      resourceGroup: 'dev',
      subscriptionId: 'def-456',
      location: 'northeurope',
    },
  ],
});
