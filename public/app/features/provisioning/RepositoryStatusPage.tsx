import { useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { Column, EmptyState, FilterInput, InteractiveTable, Spinner, Stack, Text, TextLink } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { useGetRepositoryStatusQuery, useListRepositoryFilesQuery } from './api';
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
        subTitle: 'Configure a repository for storing your resources.',
      }}
    >
      <Page.Contents isLoading={false}>
        {notFound ? (
          <EmptyState message={`Repository not found`} variant="not-found">
            <Text element={'p'}>Make sure the repository config exists in the configuration file.</Text>
            <TextLink href={PROVISIONING_URL}>Back to repositories</TextLink>
          </EmptyState>
        ) : (
          <FilesTable name={name} />
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

function FilesTable({ name }: FilesTableProps) {
  const query = useListRepositoryFilesQuery({ name });
  const [searchQuery, setSearchQuery] = useState('');
  const data = [...(query.data?.files ?? [])].filter((file) =>
    file.path.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const columns: Array<Column<FileDetails>> = [
    {
      id: 'path',
      header: 'Path',
      sortType: 'string',
    },
    {
      id: 'size',
      header: 'Size',
      sortType: 'number',
    },
    {
      id: 'hash',
      header: 'Hash',
      sortType: 'string',
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
      <Text element={'h3'}>Repository files</Text>
      <Stack gap={2}>
        <FilterInput
          placeholder="Search by login, email, or name"
          autoFocus={true}
          value={searchQuery}
          onChange={setSearchQuery}
        />
      </Stack>
      <InteractiveTable
        columns={columns}
        data={data}
        pageSize={10}
        getRowId={(file: FileDetails) => String(file.hash)}
      />
    </Stack>
  );
}
