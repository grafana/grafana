import React from 'react';

import { InteractiveTable, CellProps, Stack, Text, Icon } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { MigrationResourceDTO } from '../api';

interface ResourcesTableProps {
  resources: MigrationResourceDTO[];
}

const columns = [
  { id: 'name', header: 'Name', cell: NameCell },
  { id: 'type', header: 'Type', cell: TypeCell },
  { id: 'status', header: 'Status', cell: StatusCell },
];

export function ResourcesTable({ resources }: ResourcesTableProps) {
  return <InteractiveTable columns={columns} data={resources} getRowId={(r) => r.uid} pageSize={20} />;
}

function NameCell(props: CellProps<MigrationResourceDTO>) {
  const data = props.row.original;
  return (
    <Stack direction="column" gap={0}>
      <span>
        {iconForType(data.type)} {data.resource.name}
      </span>
      <Text color="secondary">{data.resource.type}</Text>
    </Stack>
  );
}

function TypeCell(props: CellProps<MigrationResourceDTO>) {
  const data = props.row.original;
  return <span>{getTypeName(data.type)}</span>;
}

function StatusCell(props: CellProps<MigrationResourceDTO>) {
  const data = props.row.original;

  return <span>{data.status}</span>;
}

function getTypeName(type: string) {
  if (type === 'datasource') {
    return t('migrate-to-cloud.table.type-datasource', 'Data source');
  }

  return t('migrate-to-cloud.table.type-unknown', 'Unknown');
}

function iconForType(type: string) {
  if (type === 'datasource') {
    return <Icon name="database" />;
  }

  return undefined;
}
