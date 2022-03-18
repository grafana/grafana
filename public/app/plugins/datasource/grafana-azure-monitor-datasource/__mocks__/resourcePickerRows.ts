import { ResourceRowGroup, ResourceRowType } from '../components/ResourcePicker/types';

export const createMockResourcePickerRows = (): ResourceRowGroup => [
  {
    id: 'abc-123',
    uri: '/subscriptions/abc-123',
    name: 'Primary Subscription',
    type: ResourceRowType.Subscription,
    typeLabel: 'Subscription',
    children: [
      {
        id: 'prod',
        uri: '/subscriptions/abc-123/resourceGroups/prod',
        name: 'Production',
        type: ResourceRowType.ResourceGroup,
        typeLabel: 'Resource Group',
        children: [],
      },
      {
        id: 'pre-prod',
        uri: '/subscriptions/abc-123/resourceGroups/pre-prod',
        name: 'Pre-production',
        type: ResourceRowType.ResourceGroup,
        typeLabel: 'Resource Group',
        children: [],
      },
    ],
  },

  {
    id: 'def-456',
    uri: '/subscriptions/def-456',
    name: 'Dev Subscription',
    type: ResourceRowType.Subscription,
    typeLabel: 'Subscription',
    children: [
      {
        id: 'dev',
        uri: '/subscriptions/def-456/resourceGroups/dev',
        name: 'Development',
        type: ResourceRowType.ResourceGroup,
        typeLabel: 'Resource Group',
        children: [
          {
            id: 'web-server',
            uri: '/subscription/def-456/resourceGroups/dev/providers/Microsoft.Compute/virtualMachines/web-server',
            name: 'web-server',
            typeLabel: 'Microsoft.Compute/virtualMachines',
            type: ResourceRowType.Resource,
            location: 'northeurope',
          },
          {
            id: 'web-server_DataDisk',
            uri: '/subscription/def-456/resourceGroups/dev/providers/Microsoft.Compute/disks/web-server_DataDisk',
            name: 'web-server_DataDisk',
            typeLabel: 'Microsoft.Compute/disks',
            type: ResourceRowType.Resource,
            location: 'northeurope',
          },
          {
            id: 'db-server',
            uri: '/subscription/def-456/resourceGroups/dev/providers/Microsoft.Compute/virtualMachines/db-server',
            name: 'db-server',
            typeLabel: 'Microsoft.Compute/virtualMachines',
            type: ResourceRowType.Resource,
            location: 'northeurope',
          },
          {
            id: 'db-server_DataDisk',
            uri: '/subscription/def-456/resourceGroups/dev/providers/Microsoft.Compute/disks/db-server_DataDisk',
            name: 'db-server_DataDisk',
            typeLabel: 'Microsoft.Compute/disks',
            type: ResourceRowType.Resource,
            location: 'northeurope',
          },
        ],
      },
      {
        id: 'test',
        uri: '/subscriptions/def-456/resourceGroups/test',
        name: 'Test',
        type: ResourceRowType.ResourceGroup,
        typeLabel: 'Resource Group',
        children: [],
      },
      {
        id: 'qa',
        uri: '/subscriptions/def-456/resourceGroups/qa',
        name: 'QA',
        type: ResourceRowType.ResourceGroup,
        typeLabel: 'Resource Group',
        children: [],
      },
    ],
  },

  {
    id: '$$grafana-templateVariables$$',
    uri: '$$grafana-templateVariables$$',
    name: 'Template variables',
    type: ResourceRowType.VariableGroup,
    typeLabel: 'Variables',
    children: [
      {
        id: '$machine',
        uri: '$machine',
        name: '$machine',
        type: ResourceRowType.Variable,
        typeLabel: 'Variable',
      },
      {
        id: '$workspace',
        uri: '$workspace',
        name: '$workspace',
        type: ResourceRowType.Variable,
        typeLabel: 'Variable',
      },
    ],
  },
];

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
    name: 'Development',
    type: ResourceRowType.ResourceGroup,
    typeLabel: 'Resource Group',
    children: [],
  },
  {
    id: 'dev-2',
    uri: '/subscriptions/def-456/resourceGroups/dev-2',
    name: 'Development',
    type: ResourceRowType.ResourceGroup,
    typeLabel: 'Resource Group',
    children: [],
  },
  {
    id: 'dev-3',
    uri: '/subscriptions/def-456/resourceGroups/dev-3',
    name: 'Development',
    type: ResourceRowType.ResourceGroup,
    typeLabel: 'Resource Group',
    children: [],
  },
  {
    id: 'dev-4',
    uri: '/subscriptions/def-456/resourceGroups/dev-4',
    name: 'Development',
    type: ResourceRowType.ResourceGroup,
    typeLabel: 'Resource Group',
    children: [],
  },
  {
    id: 'dev-5',
    uri: '/subscriptions/def-456/resourceGroups/dev-5',
    name: 'Development',
    type: ResourceRowType.ResourceGroup,
    typeLabel: 'Resource Group',
    children: [],
  },
];

export const mockResourcesByResourceGroup = (): ResourceRowGroup => [
  {
    id: 'web-server',
    uri: 'Microsoft.Compute/virtualMachines/web-server',
    name: 'web-server',
    typeLabel: 'Microsoft.Compute/virtualMachines',
    type: ResourceRowType.Resource,
    location: 'northeurope',
  },
  {
    id: 'web-server_DataDisk',
    uri: 'Microsoft.Compute/disks/web-server_DataDisk',
    name: 'web-server_DataDisk',
    typeLabel: 'Microsoft.Compute/disks',
    type: ResourceRowType.Resource,
    location: 'northeurope',
  },

  {
    id: 'db-server',
    uri: 'Microsoft.Compute/virtualMachines/db-server',
    name: 'db-server',
    typeLabel: 'Microsoft.Compute/virtualMachines',
    type: ResourceRowType.Resource,
    location: 'northeurope',
  },

  {
    id: 'db-server_DataDisk',
    uri: 'Microsoft.Compute/disks/db-server_DataDisk',
    name: 'db-server_DataDisk',
    typeLabel: 'Microsoft.Compute/disks',
    type: ResourceRowType.Resource,
    location: 'northeurope',
  },
];
