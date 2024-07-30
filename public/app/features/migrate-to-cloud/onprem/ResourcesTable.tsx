import { useCallback, useMemo, useState } from 'react';

import { InteractiveTable, Pagination, Stack } from '@grafana/ui';

import { MigrateDataResponseItemDto } from '../api';

import { NameCell } from './NameCell';
import { ResourceErrorModal } from './ResourceErrorModal';
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
  const [erroredResource, setErroredResource] = useState<ResourceTableItem | undefined>();

  const handleShowErrorModal = useCallback((resource: ResourceTableItem) => {
    setErroredResource(resource);
  }, []);

  const data = useMemo(() => {
    return resources.map((r) => ({ ...r, showError: handleShowErrorModal }));
  }, [resources, handleShowErrorModal]);

  return (
    <>
      <InteractiveTable columns={columns} data={data} getRowId={(r) => r.refId} />
      <Stack justifyContent={'flex-end'}>
        <Pagination numberOfPages={numberOfPages} currentPage={page} onNavigate={onChangePage} />
      </Stack>

      <ResourceErrorModal resource={erroredResource} onClose={() => setErroredResource(undefined)} />
    </>
  );
}
