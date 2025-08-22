import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { CellProps, Column, FilterInput, InteractiveTable, LinkButton, Spinner, Stack } from '@grafana/ui';
import { Repository, useGetRepositoryFilesQuery } from 'app/api/clients/provisioning/v0alpha1';

import { PROVISIONING_URL } from '../constants';
import { FileDetails } from '../types';

import { isFileHistorySupported } from './utils';

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
  const showHistoryBtn = isFileHistorySupported(repo.spec?.type);

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
              <LinkButton href={`${PROVISIONING_URL}/${name}/file/${path}`}>
                <Trans i18nKey="provisioning.files-view.columns.view">View</Trans>
              </LinkButton>
            )}
            {showHistoryBtn && (
              <LinkButton href={`${PROVISIONING_URL}/${name}/history/${path}?repo_type=${repo.spec?.type}`}>
                <Trans i18nKey="provisioning.files-view.columns.history">History</Trans>
              </LinkButton>
            )}
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
