import { useState } from 'react';

import {
  Button,
  CellProps,
  Column,
  ConfirmModal,
  FilterInput,
  InteractiveTable,
  LinkButton,
  Spinner,
  Stack,
} from '@grafana/ui';
import {
  Repository,
  useGetRepositoryFilesQuery,
  useDeleteRepositoryFilesWithPathMutation,
} from 'app/api/clients/provisioning';

import { PROVISIONING_URL } from '../constants';
import { FileDetails } from '../types';

interface FilesViewProps {
  repo: Repository;
}

type FileCell<T extends keyof FileDetails = keyof FileDetails> = CellProps<FileDetails, FileDetails[T]>;

export function FilesView({ repo }: FilesViewProps) {
  const name = repo.metadata?.name ?? '';
  const query = useGetRepositoryFilesQuery({ name });
  const [deleteFile, deleteFileStatus] = useDeleteRepositoryFilesWithPathMutation();

  const [searchQuery, setSearchQuery] = useState('');
  const [pathToDelete, setPathToDelete] = useState<string>();
  const data = [...(query.data?.items ?? [])].filter((file) =>
    file.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns: Array<Column<FileDetails>> = [
    {
      id: 'path',
      header: 'Path',
      sortType: 'string',
      cell: ({ row: { original } }: FileCell<'path'>) => {
        const { path } = original;
        return <a href={`${PROVISIONING_URL}/${name}/file/${path}`}>{path}</a>;
      },
    },
    {
      id: 'size',
      header: 'Size (KB)',
      cell: ({ row: { original } }: FileCell<'size'>) => {
        const { size } = original;
        return (parseInt(size, 10) / 1024).toFixed(2);
      },
      sortType: 'number',
    },
    {
      id: 'hash',
      header: 'Hash',
      sortType: 'string',
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row: { original } }: FileCell<'path'>) => {
        const { path } = original;
        return (
          <Stack>
            {(path.endsWith('.json') || path.endsWith('.yaml') || path.endsWith('.yml')) && (
              <LinkButton href={`${PROVISIONING_URL}/${name}/file/${path}`}>View</LinkButton>
            )}
            <LinkButton href={`${PROVISIONING_URL}/${name}/history/${path}`}>History</LinkButton>
            <Button variant="destructive" onClick={() => setPathToDelete(path)}>
              Delete
            </Button>
          </Stack>
        );
      },
    },
  ];

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
        title="Delete file in repository?"
        body={deleteFileStatus.isLoading ? 'Deleting file...' : pathToDelete}
        confirmText="Delete"
        icon={deleteFileStatus.isLoading ? `spinner` : `exclamation-triangle`}
        onConfirm={() => {
          deleteFile({
            name: name,
            path: pathToDelete!,
            message: `Deleted from repo test UI`,
          });
          setPathToDelete('');
        }}
        onDismiss={() => setPathToDelete('')}
      />
      <Stack gap={2}>
        <FilterInput placeholder="Search" autoFocus={true} value={searchQuery} onChange={setSearchQuery} />
      </Stack>
      <InteractiveTable columns={columns} data={data} pageSize={25} getRowId={(f: FileDetails) => String(f.path)} />
    </Stack>
  );
}
