import { useState } from 'react';

import { Trans, useTranslate } from '@grafana/i18n';
import { CellProps, Column, FilterInput, InteractiveTable, LinkButton, Spinner, Stack } from '@grafana/ui';
import { Repository, useGetRepositoryFilesQuery } from 'app/api/clients/provisioning';

import { PROVISIONING_URL } from '../constants';
import { FileDetails } from '../types';

interface FilesViewProps {
  repo: Repository;
}

type FileCell<T extends keyof FileDetails = keyof FileDetails> = CellProps<FileDetails, FileDetails[T]>;

export function FilesView({ repo }: FilesViewProps) {
  const name = repo.metadata?.name ?? '';
  const query = useGetRepositoryFilesQuery({ name });
  const [searchQuery, setSearchQuery] = useState('');
  const data = [...(query.data?.items ?? [])].filter((file) =>
    file.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const { t } = useTranslate();
  const getFileUrl = (path: string) => `${PROVISIONING_URL}/${name}/file/${path}`;
  const supportsHistory = repo.spec?.type === 'github';

  const getHistoryUrl = (path: string) => supportsHistory ? `${PROVISIONING_URL}/${name}/history/${path}` : '';
  const isViewableFile = (path: string) => ['.json', '.yaml', '.yml'].some(ext => path.endsWith(ext));

  const baseColumns: Array<Column<FileDetails>> = [
    {
      id: 'path',
      header: 'Path',
      sortType: 'string',
      cell: ({ row: { original } }: FileCell<'path'>) => {
        const { path } = original;
        return <a href={getFileUrl(path)}>{path}</a>;
      },
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
            {isViewableFile(path) && (
              <LinkButton href={getFileUrl(path)}>
                <Trans i18nKey="provisioning.files-view.columns.view">View</Trans>
              </LinkButton>
            )}
            {supportsHistory && (
              <LinkButton href={getHistoryUrl(path)}>
                <Trans i18nKey="provisioning.files-view.columns.history">History</Trans>
              </LinkButton>
            )}
          </Stack>
        );
      },
    },
  ];

  const sizeColumn: Column<FileDetails> = {
    id: 'size',
    header: 'Size (KB)',
    cell: ({ row: { original } }: FileCell<'size'>) => {
      const { size } = original;
      return (parseInt(size, 10) / 1024).toFixed(2);
    },
    sortType: 'number',
  };

  const columns = repo.spec?.type === 'github' || repo.spec?.type === 'local'
    ? [...baseColumns.slice(0, 1), sizeColumn, ...baseColumns.slice(1)]
    : baseColumns;


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
        <FilterInput
          placeholder={t('provisioning.files-view.placeholder-search', 'Search')}
          autoFocus={true}
          value={searchQuery}
          onChange={setSearchQuery}
        />
      </Stack>
      <InteractiveTable columns={columns} data={data} pageSize={25} getRowId={(f: FileDetails) => String(f.path)} />
    </Stack>
  );
}
