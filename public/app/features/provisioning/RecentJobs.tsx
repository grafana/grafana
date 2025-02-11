import { Spinner, Alert, Tag, InteractiveTable, Button, Card, Tooltip, IconButton } from '@grafana/ui';
import { formatTimestamp } from './utils/time';
import { Repository, useListJobQuery, Job } from './api';
import { joinByLabels } from '../transformers/joinByLabels/joinByLabels';

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
          {job.status?.errors && (
            <Tooltip content={<pre style={{ whiteSpace: 'pre-wrap' }}>{job.status.errors}</pre>}>
              <IconButton name="exclamation-triangle" variant="destructive" tooltip="View error details" />
            </Tooltip>
          )}
          {job.status?.summary?.length && job.status?.summary?.length > 0 && (
            <Tooltip
              content={
                <pre style={{ whiteSpace: 'pre-wrap' }}>
                  {`Summary length: ${job.status.summary.length}\n`}
                  {`Raw summary: ${JSON.stringify(job.status.summary, null, 2)}\n`}
                  {`Mapped resources: ${job.status.summary.map((s) => s.resource).join(', ')}`}
                </pre>
              }
            >
              <IconButton name="list-ul" variant="secondary" tooltip="View error details" />
            </Tooltip>
          )}
        </div>
      ),
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
        />
      </Card.Description>
    </Card>
  );
}
