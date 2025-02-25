import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useRef, useMemo } from 'react';

import { Stack, Text, TextLink, InteractiveTable, Spinner } from '@grafana/ui';

import ProgressBar from './ProgressBar';
import { useGetRepositoryQuery, useListJobQuery } from './api';
import { getRemoteURL } from './utils/git';

export interface JobStatusProps {
  name: string;
  onStatusChange?: (success: boolean) => void;
}

export function JobStatus({ name, onStatusChange }: JobStatusProps) {
  const jobQuery = useListJobQuery({ watch: true, fieldSelector: `metadata.name=${name}` });
  const job = jobQuery.data?.items?.[0];
  const hasNotifiedSuccess = useRef(false);
  const isSuccess = job?.status?.state === 'success';

  useEffect(() => {
    if (isSuccess && onStatusChange && !hasNotifiedSuccess.current) {
      hasNotifiedSuccess.current = true;
      onStatusChange(true);
    }
  }, [isSuccess, onStatusChange]);

  if (jobQuery.isLoading || !job) {
    return (
      <Stack direction="column" alignItems="center" gap={2}>
        <Spinner />
        <Text>Starting migration...</Text>
      </Stack>
    );
  }

  return (
    <Stack direction="column" gap={2}>
      {job.status && (
        <Stack direction="column" gap={2}>
          <Text element="p" weight="medium">
            {isSuccess ? 'Migration successful!' : (job.status.message ?? '')}
          </Text>
          <ProgressBar progress={job.status.progress} />

          {job.status.state === 'success' && (
            <Stack direction="column" gap={2}>
              {job.status.summary && <MigrationSummaryTable summary={job.status.summary} />}
              <RepositoryLink name={job.metadata?.labels?.repository} />
            </Stack>
          )}
        </Stack>
      )}
    </Stack>
  );
}

interface SummaryRow {
  resource: string;
  group: string;
  created: number;
  updated: number;
  unchanged: number;
  total: number;
}

interface MigrationSummaryTableProps {
  summary: Array<{
    resource?: string;
    group?: string;
    create?: number;
    write?: number;
    noop?: number;
  }>;
}

function MigrationSummaryTable({ summary }: MigrationSummaryTableProps) {
  const summaryData = useMemo(() => {
    return summary.map((item) => ({
      resource: item.resource || '',
      group: item.group || '',
      created: item.create || 0,
      updated: item.write || 0,
      unchanged: item.noop || 0,
      total: (item.create || 0) + (item.write || 0) + (item.noop || 0),
    }));
  }, [summary]);

  const columns = useMemo(
    () => [
      { id: 'resource', header: 'Resource Type' },
      { id: 'created', header: 'Created' },
      { id: 'updated', header: 'Updated' },
      { id: 'unchanged', header: 'Unchanged' },
      { id: 'total', header: 'Total' },
    ],
    []
  );

  return (
    <Stack direction="column" gap={2}>
      <Text variant="h6">Migration Summary</Text>
      <InteractiveTable columns={columns} data={summaryData} getRowId={(row: SummaryRow) => row.resource} />
    </Stack>
  );
}

type RepositoryLinkProps = {
  name?: string;
};

function RepositoryLink({ name }: RepositoryLinkProps) {
  const repoQuery = useGetRepositoryQuery(name ? { name } : skipToken);
  const repo = repoQuery.data;

  if (!repo || repoQuery.isLoading || repo.spec?.type !== 'github' || !repo.spec?.github?.url) {
    return null;
  }

  const href = getRemoteURL(repo);

  if (!href) {
    return null;
  }
  return (
    <Stack direction={'column'}>
      <Text>Your dashboards and folders are now in your repository.</Text>
      <TextLink external href={href}>
        View repository
      </TextLink>
    </Stack>
  );
}
