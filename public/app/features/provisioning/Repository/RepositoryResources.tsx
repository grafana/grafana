import { useMemo, useState } from 'react';

import {
  Column,
  CellProps,
  Link,
  Stack,
  Spinner,
  FilterInput,
  InteractiveTable,
  LinkButton,
  ConfirmModal,
  Button,
} from '@grafana/ui';
import {
  Repository,
  ResourceListItem,
  useGetRepositoryResourcesQuery,
  useDeleteRepositoryFilesWithPathMutation,
} from 'app/api/clients/provisioning';

import { PROVISIONING_URL } from '../constants';

interface RepoProps {
  repo: Repository;
}

type ResourceCell<T extends keyof ResourceListItem = keyof ResourceListItem> = CellProps<
  ResourceListItem,
  ResourceListItem[T]
>;

export function RepositoryResources({ repo }: RepoProps) {
  const name = repo.metadata?.name ?? '';
  const query = useGetRepositoryResourcesQuery({ name });
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteFile, deleteFileStatus] = useDeleteRepositoryFilesWithPathMutation();
  const [pathToDelete, setPathToDelete] = useState<string>();
  const data = (query.data?.items ?? []).filter((Resource) =>
    Resource.path.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const columns: Array<Column<ResourceListItem>> = useMemo(
    () => [
      {
        id: 'title',
        header: 'Title',
        sortType: 'string',
        cell: ({ row: { original } }: ResourceCell<'title'>) => {
          const { resource, name, title } = original;
          if (resource === 'dashboards') {
            return <a href={`/d/${name}`}>{title}</a>;
          }
          if (resource === 'folders') {
            return <a href={`/dashboards/f/${name}`}>{title}</a>;
          }
          return <span>{title}</span>;
        },
      },
      {
        id: 'resource',
        header: 'Type',
        sortType: 'string',
        cell: ({ row: { original } }: ResourceCell<'resource'>) => {
          return <span style={{ textTransform: 'capitalize' }}>{original.resource}</span>;
        },
      },
      {
        id: 'path',
        header: 'Path',
        sortType: 'string',
        cell: ({ row: { original } }: ResourceCell<'path'>) => {
          const { resource, name, path } = original;
          if (resource === 'dashboards') {
            return <a href={`/d/${name}`}>{path}</a>;
          }
          return <span>{path}</span>;
        },
      },
      {
        id: 'hash',
        header: 'Hash',
        sortType: 'string',
        cell: ({ row: { original } }: ResourceCell<'hash'>) => {
          const { hash } = original;
          return <span title={hash}>{hash.substring(0, 7)}</span>;
        },
      },
      {
        id: 'folder',
        header: 'Folder',
        sortType: 'string',
        cell: ({ row: { original } }: ResourceCell<'title'>) => {
          const { folder } = original;
          if (folder?.length) {
            return <Link href={`/dashboards/f/${folder}`}>{folder}</Link>;
          }
          return <span></span>;
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row: { original } }: ResourceCell) => {
          const { resource, name, path } = original;
          return (
            <Stack>
              {resource === 'dashboards' && <LinkButton href={`/d/${name}`}>View</LinkButton>}
              {resource === 'folders' && <LinkButton href={`/dashboards/f/${name}`}>View</LinkButton>}
              <LinkButton href={`${PROVISIONING_URL}/${repo.metadata?.name}/history/${path}`}>History</LinkButton>
              <Button variant="destructive" onClick={() => setPathToDelete(path)}>
                Delete
              </Button>
            </Stack>
          );
        },
      },
    ],
    [repo.metadata?.name]
  );

  if (query.isLoading) {
    return (
      <Stack justifyContent={'center'} alignItems={'center'}>
        <Spinner />
      </Stack>
    );
  }

  return (
    <Stack grow={1} direction={'column'} gap={2}>
      <ConfirmModal
        isOpen={Boolean(pathToDelete?.length) || deleteFileStatus.isLoading}
        title="Delete resource in repository?"
        body={deleteFileStatus.isLoading ? 'Deleting resource...' : pathToDelete}
        confirmText="Delete"
        icon={deleteFileStatus.isLoading ? `spinner` : `exclamation-triangle`}
        onConfirm={() => {
          if (pathToDelete) {
            deleteFile({
              name: name,
              path: pathToDelete,
              message: `Deleted from repo test UI`,
            });
            setPathToDelete('');
          }
        }}
        onDismiss={() => setPathToDelete('')}
      />
      <Stack gap={2}>
        <FilterInput placeholder="Search" autoFocus={true} value={searchQuery} onChange={setSearchQuery} />
      </Stack>
      <InteractiveTable
        columns={columns}
        data={data}
        pageSize={25}
        getRowId={(r: ResourceListItem) => String(r.path)}
      />
    </Stack>
  );
}
