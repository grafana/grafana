import { ResourceRowGroup, ResourceRowType } from '../components/ResourcePicker/types';

export const createMockResourcePickerRows = (): ResourceRowGroup => [
  {
    id: '/subscriptions/abc-123',
    name: 'Primary Subscription',
    type: ResourceRowType.Subscription,
    typeLabel: 'Subscription',
    children: [
      {
        id: '/subscriptions/abc-123/resourceGroups/prod',
        name: 'Production',
        type: ResourceRowType.ResourceGroup,
        typeLabel: 'Resource Group',
        children: [],
      },
      {
        id: '/subscriptions/abc-123/resourceGroups/pre-prod',
        name: 'Pre-production',
        type: ResourceRowType.ResourceGroup,
        typeLabel: 'Resource Group',
        children: [],
      },
    ],
  },

  {
    id: '/subscriptions/def-456',
    name: 'Dev Subscription',
    type: ResourceRowType.Subscription,
    typeLabel: 'Subscription',
    children: [
      {
        id: '/subscriptions/def-456/resourceGroups/dev',
        name: 'Development',
        type: ResourceRowType.ResourceGroup,
        typeLabel: 'Resource Group',
        children: [
          {
            id: '/subscription/def-456/resourceGroups/dev/providers/Microsoft.Compute/virtualMachines/web-server',
            name: 'web-server',
            typeLabel: 'Microsoft.Compute/virtualMachines',
            type: ResourceRowType.Resource,
            location: 'northeurope',
          },

          {
            id: '/subscription/def-456/resourceGroups/dev/providers/Microsoft.Compute/disks/web-server_DataDisk',
            name: 'web-server_DataDisk',
            typeLabel: 'Microsoft.Compute/disks',
            type: ResourceRowType.Resource,
            location: 'northeurope',
          },

          {
            id: '/subscription/def-456/resourceGroups/dev/providers/Microsoft.Compute/virtualMachines/db-server',
            name: 'db-server',
            typeLabel: 'Microsoft.Compute/virtualMachines',
            type: ResourceRowType.Resource,
            location: 'northeurope',
          },

          {
            id: '/subscription/def-456/resourceGroups/dev/providers/Microsoft.Compute/disks/db-server_DataDisk',
            name: 'db-server_DataDisk',
            typeLabel: 'Microsoft.Compute/disks',
            type: ResourceRowType.Resource,
            location: 'northeurope',
          },
        ],
      },
      {
        id: '/subscriptions/def-456/resourceGroups/test',
        name: 'Test',
        type: ResourceRowType.ResourceGroup,
        typeLabel: 'Resource Group',
        children: [],
      },
      {
        id: '/subscriptions/def-456/resourceGroups/qa',
        name: 'QA',
        type: ResourceRowType.ResourceGroup,
        typeLabel: 'Resource Group',
        children: [],
      },
    ],
  },
];
