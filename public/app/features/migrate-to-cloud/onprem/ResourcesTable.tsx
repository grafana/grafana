import React from 'react';

import { InteractiveTable } from '@grafana/ui';

import { MigrateDataResponseItemDto } from '../api';

import { NameCell } from './NameCell';
import { StatusCell } from './StatusCell';
import { TypeCell } from './TypeCell';

interface ResourcesTableProps {
  resources: MigrateDataResponseItemDto[];
}

const columns = [
  { id: 'name', header: 'Name', cell: NameCell },
  { id: 'type', header: 'Type', cell: TypeCell },
  { id: 'status', header: 'Status', cell: StatusCell },
];

export function ResourcesTable({ resources }: ResourcesTableProps) {
  return <InteractiveTable columns={columns} data={resources} getRowId={(r) => r.refId} pageSize={15} />;
}
