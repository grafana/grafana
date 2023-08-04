import React from 'react';

import { Switch, InteractiveTable, type CellProps } from '@grafana/ui';

import { type FeatureToggle } from './AdminFeatureTogglesAPI';

interface Props {
  featureToggles: FeatureToggle[];
}

export function AdminFeatureTogglesTable({ featureToggles }: Props) {
  const columns = [
    {
      id: 'name',
      header: 'Name',
      cell: ({ cell: { value } }: CellProps<FeatureToggle, string>) => <div>{value}</div>,
    },
    {
      id: 'description',
      header: 'Description',
      cell: ({ cell: { value } }: CellProps<FeatureToggle, string>) => <div>{value}</div>,
    },
    {
      id: 'enabled',
      header: 'State',
      cell: ({ cell: { value } }: CellProps<FeatureToggle, boolean>) => (
        <div>
          <Switch value={value} disabled={true} />
        </div>
      ),
    },
  ];

  return <InteractiveTable columns={columns} data={featureToggles} getRowId={(featureToggle) => featureToggle.name} />;
}
