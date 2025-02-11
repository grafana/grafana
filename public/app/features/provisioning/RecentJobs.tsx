import { Spinner, Alert, Badge, InteractiveTable, Button, Card, Box, Stack, Icon } from '@grafana/ui';

import { Repository, JobResourceSummary, useListJobQuery, Job } from './api';
import { formatTimestamp } from './utils/time';

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
        <Badge
          text={job.status?.state || ''}
          color={
            job.status?.state === 'success'
              ? 'green'
              : job.status?.state === 'working'
                ? 'orange'
                : job.status?.state === 'pending'
                  ? 'orange'
                  : job.status?.state === 'error'
                    ? 'red'
                    : 'darkgrey'
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
      cell: ({ row: { original: item } }: { row: { original: JobResourceSummary } }) => item.write?.toString() || '-',
    },
    {
      id: 'created',
      header: 'Created',
      cell: ({ row: { original: item } }: { row: { original: JobResourceSummary } }) => item.create?.toString() || '-',
    },
    {
      id: 'deleted',
      header: 'Deleted',
      cell: ({ row: { original: item } }: { row: { original: JobResourceSummary } }) => item.delete?.toString() || '-',
    },
    {
      id: 'updated',
      header: 'Updated',
      cell: ({ row: { original: item } }: { row: { original: JobResourceSummary } }) => item.update?.toString() || '-',
    },
    {
      id: 'unchanged',
      header: 'Unchanged',
      cell: ({ row: { original: item } }: { row: { original: JobResourceSummary } }) => item.noop?.toString() || '-',
    },
    {
      id: 'errors',
      header: 'Errors',
      cell: ({ row: { original: item } }: { row: { original: JobResourceSummary } }) => item.error?.toString() || '-',
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
            (row.status?.summary?.length ?? 0) > 0 || row.status?.errors ? (
              <Box padding={2}>
                <Stack direction="column" gap={2}>
                  {row.status?.errors && (
                    <Stack direction="column" gap={1}>
                      {row.status.errors.map(
                        (error, index) =>
                          error.trim() && (
                            <Alert key={index} severity="error" title="Error">
                              <Stack direction="row" alignItems="center" gap={1}>
                                <Icon name="exclamation-circle" size="sm" />
                                {error}
                              </Stack>
                            </Alert>
                          )
                      )}
                    </Stack>
                  )}
                  {row.status?.summary?.length && row.status.summary.length > 0 && (
                    <InteractiveTable
                      data={row.status.summary}
                      columns={summaryColumns}
                      getRowId={(item) => item.resource || ''}
                    />
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
