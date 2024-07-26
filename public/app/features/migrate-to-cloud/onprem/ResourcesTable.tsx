import { InteractiveTable, Pagination, Stack } from '@grafana/ui';

import { MigrateDataResponseItemDto } from '../api';

import { NameCell } from './NameCell';
import { StatusCell } from './StatusCell';
import { TypeCell } from './TypeCell';

export interface ResourcesTableProps {
  resources: MigrateDataResponseItemDto[];
  page: number;
  numberOfPages: number;
  onChangePage: (page: number) => void;
}

const columns = [
  { id: 'name', header: 'Name', cell: NameCell },
  { id: 'type', header: 'Type', cell: TypeCell },
  { id: 'status', header: 'Status', cell: StatusCell },
];

export function ResourcesTable({ resources, numberOfPages = 0, onChangePage, page = 1 }: ResourcesTableProps) {
  return (
    <>
      <InteractiveTable columns={columns} data={resources} getRowId={(r) => r.refId} />
      <Stack justifyContent={'flex-end'}>
        <Pagination numberOfPages={numberOfPages} currentPage={page} onNavigate={onChangePage} />
      </Stack>
    </>
  );
}
