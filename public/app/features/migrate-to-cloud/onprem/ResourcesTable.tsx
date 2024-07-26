import { useCallback, useMemo, useState } from 'react';

import { InteractiveTable } from '@grafana/ui';

import { MigrateDataResponseItemDto } from '../api';

import { NameCell } from './NameCell';
import { ResourceErrorModal } from './ResourceErrorModal';
import { StatusCell } from './StatusCell';
import { TypeCell } from './TypeCell';
import { ResourceTableItem } from './types';

interface ResourcesTableProps {
  resources: MigrateDataResponseItemDto[];
}

const columns = [
  { id: 'name', header: 'Name', cell: NameCell },
  { id: 'type', header: 'Type', cell: TypeCell },
  { id: 'status', header: 'Status', cell: StatusCell },
];

export function ResourcesTable({ resources }: ResourcesTableProps) {
  const [erroredResource, setErroredResource] = useState<ResourceTableItem | undefined>();

  const handleShowErrorModal = useCallback((resource: ResourceTableItem) => {
    setErroredResource(resource);
  }, []);

  const data = useMemo(() => {
    return resources.map((r) => ({ ...r, showError: handleShowErrorModal }));
  }, [resources, handleShowErrorModal]);

  return (
    <>
      <InteractiveTable columns={columns} data={data} getRowId={(r) => r.refId} pageSize={15} />

      <ResourceErrorModal resource={erroredResource} onClose={() => setErroredResource(undefined)} />
    </>
  );
}
