import { Spinner, Alert, Tag, InteractiveTable, Button, Card, Box, Stack } from '@grafana/ui';
import { formatTimestamp } from './utils/time';
import { Repository, JobResourceSummary, useListJobQuery, Job } from './api';

interface Props {
  repo: Repository;
}

export function RecentJobs({ repo }: Props) {
  const name = repo.metadata?.name;
  const query = useListJobQuery({ labelSelector: `repository=${name}` });
  const items = query?.data?.items ?? [];

  if (query.isLoading) {
    return <Spinner />;
  }
  if (query.isError) {
    return (
      <Alert title="error loading jobs">
        <pre>{JSON.stringify(query.error)}</pre>
      </Alert>
    );
  }
  if (!items?.length) {
    return (
      <div>
        No recent events...
        <br />
        Note: history is not maintained after system restart
      </div>
    );
  }

  const columns = [
    {
      id: 'status',
      header: 'Status',
      cell: ({ row: { original: job } }: { row: { original: Job } }) => (
        <Tag
          name={job.status?.state || ''}
          color={
            job.status?.state === 'success'
              ? 'success'
              : job.status?.state === 'working'
                ? 'warning'
                : job.status?.state === 'pending'
                  ? 'warning'
                  : job.status?.state === 'error'
                    ? 'error'
                    : 'secondary'
          }
          icon={job.status?.state === 'working' ? 'spinner' : undefined}
        />
      ),
    },
    {
      id: 'action',
      header: 'Action',
      cell: ({ row: { original: job } }: { row: { original: Job } }) => job.spec?.action,
    },
    {
      id: 'started',
      header: 'Started',
      cell: ({ row: { original: job } }: { row: { original: Job } }) => formatTimestamp(job.status?.started),
    },
    {
      id: 'finished',
      header: 'Finished',
      cell: ({ row: { original: job } }: { row: { original: Job } }) => formatTimestamp(job.status?.finished),
    },
    {
      id: 'message',
      header: 'Message',
      cell: ({ row: { original: job } }: { row: { original: Job } }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{job.status?.message}</span>
        </div>
      ),
    },
  ];

  const summaryColumns = [
    {
      id: 'group',
      header: 'Group',
      cell: ({ row: { original: item } }: { row: { original: JobResourceSummary } }) => item.group || '-',
    },
    {
      id: 'resource',
      header: 'Resource',
      cell: ({ row: { original: item } }: { row: { original: JobResourceSummary } }) => item.resource,
    },
    {
      id: 'write',
      header: 'Write',
      cell: ({ row: { original: item } }: { row: { original: JobResourceSummary } }) =>
        item.write ? <Tag name={item.write.toString()} color="secondary" /> : '-',
    },
    {
      id: 'created',
      header: 'Created',
      cell: ({ row: { original: item } }: { row: { original: JobResourceSummary } }) =>
        item.create ? <Tag name={item.create.toString()} color="green" /> : '-',
    },
    {
      id: 'deleted',
      header: 'Deleted',
      cell: ({ row: { original: item } }: { row: { original: JobResourceSummary } }) =>
        item.delete ? <Tag name={item.delete.toString()} color="red" /> : '-',
    },
    {
      id: 'updated',
      header: 'Updated',
      cell: ({ row: { original: item } }: { row: { original: JobResourceSummary } }) =>
        item.update ? <Tag name={item.update.toString()} color="blue" /> : '-',
    },
    {
      id: 'unchanged',
      header: 'Unchanged',
      cell: ({ row: { original: item } }: { row: { original: JobResourceSummary } }) =>
        item.noop ? <Tag name={item.noop.toString()} color="secondary" /> : '-',
    },
    {
      id: 'errors',
      header: 'Errors',
      cell: ({ row: { original: item } }: { row: { original: JobResourceSummary } }) =>
        item.error ? <Tag name={item.error.toString()} color="red" /> : '-',
    },
  ];

  return (
    <Card>
      <Card.Heading>Recent Jobs</Card.Heading>
      <Card.Actions>
        <Button icon="sync" variant="secondary" onClick={() => query.refetch()} disabled={query.isFetching}>
          Refresh
        </Button>
      </Card.Actions>
      <Card.Description>
        <InteractiveTable
          data={items.slice(0, 10)}
          columns={columns}
          getRowId={(item) => item.metadata?.resourceVersion || ''}
          renderExpandedRow={(row) =>
            row.status?.summary?.length || row.status?.errors ? (
              <Box padding={2}>
                <Stack direction="column" gap={2}>
                  {row.status?.summary && row.status.summary.length > 0 && (
                    <InteractiveTable
                      data={row.status.summary}
                      columns={summaryColumns}
                      getRowId={(item) => item.resource || ''}
                    />
                  )}
                  {row.status?.errors && (
                    <Alert severity="error" title="Error Details">
                      <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{row.status.errors}</pre>
                    </Alert>
                  )}
                </Stack>
              </Box>
            ) : null
          }
        />
      </Card.Description>
    </Card>
  );
}
