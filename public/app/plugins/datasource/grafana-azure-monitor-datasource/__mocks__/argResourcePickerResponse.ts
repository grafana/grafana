import {
  AzureGraphResponse,
  RawAzureResourceGroupItem,
  RawAzureResourceItem,
  RawAzureSubscriptionItem,
} from '../types';

export const createMockARGSubscriptionResponse = (): AzureGraphResponse<RawAzureSubscriptionItem[]> => ({
  data: [
    {
      subscriptionId: '1',
      subscriptionName: 'Primary Subscription',
    },
    {
      subscriptionId: '2',
      subscriptionName: 'Dev Subscription',
    },
    {
      subscriptionId: '3',
      subscriptionName: 'Dev Subscription',
    },
    {
      subscriptionId: '4',
      subscriptionName: 'Primary Subscription',
    },
    {
      subscriptionId: '5',
      subscriptionName: 'Primary Subscription',
    },
    {
      subscriptionId: '6',
      subscriptionName: 'Dev Subscription',
    },
  ],
});

export const createMockARGResourceGroupsResponse = (): AzureGraphResponse<RawAzureResourceGroupItem[]> => ({
  data: [
    {
      resourceGroupURI: '/subscriptions/abc-123/resourceGroups/prod',
      resourceGroupName: 'Production',
    },

    {
      resourceGroupURI: '/subscriptions/def-456/resourceGroups/dev',
      resourceGroupName: 'Development',
    },

    {
      resourceGroupURI: '/subscriptions/def-456/resourceGroups/test',
      resourceGroupName: 'Test',
    },

    {
      resourceGroupURI: '/subscriptions/abc-123/resourceGroups/test',
      resourceGroupName: 'Test',
    },

    {
      resourceGroupURI: '/subscriptions/abc-123/resourceGroups/pre-prod',
      resourceGroupName: 'Pre-production',
    },

    {
      resourceGroupURI: '/subscriptions/def-456/resourceGroups/qa',
      resourceGroupName: 'QA',
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
