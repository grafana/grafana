import { useCallback, useMemo, useState } from 'react';

import { InteractiveTable, Pagination, Stack } from '@grafana/ui';

import { LocalPlugin } from '../../plugins/admin/types';
import { MigrateDataResponseItemDto } from '../api';

import { NameCell } from './NameCell';
import { ResourceDetailsModal } from './ResourceDetailsModal';
import { StatusCell } from './StatusCell';
import { TypeCell } from './TypeCell';
import { ResourceTableItem } from './types';

export interface ResourcesTableProps {
  resources: MigrateDataResponseItemDto[];
  localPlugins: LocalPlugin[];
  page: number;
  numberOfPages: number;
  onChangePage: (page: number) => void;
}

const columns = [
  { id: 'name', header: 'Name', cell: NameCell },
  { id: 'type', header: 'Type', cell: TypeCell },
  { id: 'status', header: 'Status', cell: StatusCell },
];

export function ResourcesTable({
  resources,
  localPlugins,
  numberOfPages = 0,
  onChangePage,
  page = 1,
}: ResourcesTableProps) {
  const [focusedResource, setfocusedResource] = useState<ResourceTableItem | undefined>();

  const handleShowDetailsModal = useCallback((resource: ResourceTableItem) => {
    setfocusedResource(resource);
  }, []);

  const data = useMemo(() => {
    return resources.map((r) => {
      const plugin = getPlugin(r, localPlugins);

      return {
        ...r,
        showDetails: handleShowDetailsModal,
        plugin: plugin,
      };
    });
  }, [resources, handleShowDetailsModal, localPlugins]);

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

function getPlugin(
  r: MigrateDataResponseItemDto | undefined,
  plugins: LocalPlugin[] | undefined
): LocalPlugin | undefined {
  if (!r || !plugins || r.type !== 'PLUGIN') {
    return undefined;
  }

  return plugins.find((plugin) => plugin.id === r.refId);
}
