import React from 'react';
import NestedResourceTable from './NestedResourceTable';
import { Row, EntryType } from './types';

interface ResourcePickerProps {}

const rows: Row[] = [
  {
    name: 'raintank-dev',
    id: '1',
    typeLabel: 'Subscription',
    type: EntryType.Collection,
    hasChildren: true,
    children: [
      { name: 'awoods-test', id: '2', type: EntryType.SubCollection, typeLabel: 'Resource Group', hasChildren: true },
      {
        name: 'azuremarketplacegrafana',
        id: '3',
        type: EntryType.SubCollection,
        typeLabel: 'Resource Group',
        hasChildren: true,
      },
      { name: 'azure-stack', id: '4', type: EntryType.SubCollection, typeLabel: 'Resource Group', hasChildren: true },
      {
        name: 'cloud-datasources',
        id: '5',
        type: EntryType.Resource,
        typeLabel: 'Resource Group',
        hasChildren: true,
        children: [
          {
            name: 'AppInsightsTestData',
            id: '6',
            type: EntryType.Resource,
            typeLabel: 'Application Insights',
            location: 'North Europe',
            isSelectable: true,
          },
          {
            name: 'AppInsightsTestDataWorkspace',
            id: '7',
            type: EntryType.Resource,
            typeLabel: 'Log Analytics Workspace',
            location: 'North Europe',
            isSelectable: true,
          },
          {
            name: 'GitHubTestDataVM',
            id: '8',
            type: EntryType.Resource,
            typeLabel: 'Virtual Machine',
            location: 'North Europe',
            isSelectable: true,
          },
        ],
      },
      {
        name: 'grafana-test',
        id: '9',
        type: EntryType.SubCollection,
        typeLabel: 'Resource Group',
        hasChildren: true,
      },
    ],
  },
];

const ResourcePicker = (props: ResourcePickerProps) => {
  return (
    <div>
      <NestedResourceTable rows={rows} />
    </div>
  );
};

export default ResourcePicker;
