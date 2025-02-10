import { useMemo, useState } from 'react';

import { Column, CellProps, Stack, Spinner, FilterInput, InteractiveTable } from '@grafana/ui';

import { Repository, ResourceListItem, useGetRepositoryResourcesQuery } from './api';

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
  const data = [...(query.data?.items ?? [])].filter((Resource) =>
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
            return <a href={`/dashboards/f/${folder}`}>{folder}</a>;
          }
          return <span></span>;
        },
      },
    ],
    []
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
