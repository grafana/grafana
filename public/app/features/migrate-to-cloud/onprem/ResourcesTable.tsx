import { useCallback, useMemo, useState } from 'react';

import { InteractiveTable, Pagination, Stack } from '@grafana/ui';

import { MigrateDataResponseItemDto } from '../api';

import { NameCell } from './NameCell';
import { ResourceDetailsModal } from './ResourceDetailsModal';
import { StatusCell } from './StatusCell';
import { TypeCell } from './TypeCell';
import { ResourceTableItem } from './types';

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
  const [focusedResource, setfocusedResource] = useState<ResourceTableItem | undefined>();

  const handleShowDetailsModal = useCallback((resource: ResourceTableItem) => {
    setfocusedResource(resource);
  }, []);

  const data = useMemo(() => {
    return resources.map((r) => ({ ...r, showDetails: handleShowDetailsModal }));
  }, [resources, handleShowDetailsModal]);

  return (
    <>
      <Stack alignItems="flex-end" direction="column">
        <InteractiveTable columns={columns} data={data} getRowId={(r) => r.refId} />

        <Pagination numberOfPages={numberOfPages} currentPage={page} onNavigate={onChangePage} />
      </Stack>

      <ResourceDetailsModal resource={focusedResource} onClose={() => setfocusedResource(undefined)} />
    </>
  );
}
