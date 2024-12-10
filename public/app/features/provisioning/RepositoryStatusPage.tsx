import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import {
  Alert,
  CellProps,
  Column,
  EmptyState,
  FilterInput,
  InteractiveTable,
  LinkButton,
  Spinner,
  Stack,
  Text,
  TextLink,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { useGetRepositoryStatusQuery, useListRepositoryFilesQuery, useTestRepositoryQuery } from './api';
import { PROVISIONING_URL } from './constants';

export default function RepositoryStatusPage() {
  const { name = '' } = useParams();
  const query = useGetRepositoryStatusQuery({ name });

  //@ts-expect-error TODO add error types
  const notFound = query.isError && query.error?.status === 404;
  return (
    <Page
      navId="provisioning"
      pageNav={{
        text: query.data?.spec.title ?? 'Repository Status',
        subTitle: 'Check the status of configured repository.',
      }}
    >
      <Page.Contents isLoading={false}>
        {notFound ? (
          <EmptyState message={`Repository not found`} variant="not-found">
            <Text element={'p'}>Make sure the repository config exists in the configuration file.</Text>
            <TextLink href={PROVISIONING_URL}>Back to repositories</TextLink>
          </EmptyState>
        ) : (
          <>
            <RepoTestOptions name={name} />
            <FilesTable name={name} />
          </>
        )}
      </Page.Contents>
    </Page>
  );
}

type FileDetails = {
  path: string;
  size: string;
  hash: string;
};

interface FilesTableProps {
  name: string;
}

function RepoTestOptions({ name }: FilesTableProps) {
  const status = useTestRepositoryQuery({ name });
  if (status.isLoading) {
    return (
      <div>
        <Spinner /> Testing configuration...
      </div>
    );
  }
  if (status.isError) {
    if (!status.data) {
      return <Alert title="Error testing configuration" severity="error" />;
    }
    return <pre>{JSON.stringify(status.data, null, '  ')}</pre>;
  }
  return null; // don't show anything when it is OK?
}

type Cell<T extends keyof FileDetails = keyof FileDetails> = CellProps<FileDetails, FileDetails[T]>;

function FilesTable({ name }: FilesTableProps) {
  const query = useListRepositoryFilesQuery({ name });
  const [searchQuery, setSearchQuery] = useState('');
  const data = [...(query.data?.files ?? [])].filter((file) =>
    file.path.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const columns: Array<Column<FileDetails>> = useMemo(
    () => [
      {
        id: 'path',
        header: 'Path',
        sortType: 'string',
        cell: ({ row: { original } }: Cell<'path'>) => {
          const { path } = original;
          return <a href={`${PROVISIONING_URL}/${name}/file/${path}`}>{path}</a>;
        },
      },
      {
        id: 'size',
        header: 'Size (KB)',
        cell: ({ row: { original } }: Cell<'size'>) => {
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
        cell: ({ row: { original } }: Cell<'path'>) => {
          const { path } = original;
          return (
            <Stack>
              <LinkButton href={`${PROVISIONING_URL}/${name}/file/${path}`}>View</LinkButton>
              <LinkButton href={`${PROVISIONING_URL}/${name}/history/${path}`}>History</LinkButton>
            </Stack>
          );
        },
      },
    ],
    [name]
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
      <Text element={'h3'}>Repository files</Text>
      <Stack gap={2}>
        <FilterInput placeholder="Search" autoFocus={true} value={searchQuery} onChange={setSearchQuery} />
      </Stack>
      <InteractiveTable
        columns={columns}
        data={data}
        pageSize={25}
        getRowId={(file: FileDetails) => String(file.hash)}
      />
    </Stack>
  );
}
