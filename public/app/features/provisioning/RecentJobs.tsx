import { useMemo } from 'react';

import { intervalToAbbreviatedDurationString, TraceKeyValuePair } from '@grafana/data';
import { Alert, Badge, Box, Card, Icon, InteractiveTable, Spinner, Stack, Text } from '@grafana/ui';
import { Job, Repository, SyncStatus } from 'app/api/clients/provisioning';

import KeyValuesTable from '../explore/TraceView/components/TraceTimelineViewer/SpanDetail/KeyValuesTable';

import { JobSummary } from './JobSummary';
import { useRepositoryJobs } from './hooks';
import { formatTimestamp } from './utils/time';

interface Props {
  repo: Repository;
}

type JobCell<T extends keyof Job = keyof Job> = {
  row: {
    original: Job;
  };
};

const getStatusColor = (state?: SyncStatus['state']) => {
  switch (state) {
    case 'success':
      return 'green';
    case 'working':
    case 'pending':
      return 'orange';
    case 'error':
      return 'red';
    default:
      return 'darkgrey';
  }
};

const getJobColumns = () => [
  {
    id: 'status',
    header: 'Status',
    cell: ({ row: { original: job } }: JobCell) => (
      <Badge
        text={job.status?.state || ''}
        color={getStatusColor(job.status?.state)}
        icon={job.status?.state === 'working' ? 'spinner' : undefined}
      />
    ),
  },
  {
    id: 'action',
    header: 'Action',
    cell: ({ row: { original: job } }: JobCell) => job.spec?.action,
  },
  {
    id: 'started',
    header: 'Started',
    cell: ({ row: { original: job } }: JobCell) => formatTimestamp(job.status?.started),
  },
  {
    id: 'duration',
    header: 'Duration',
    cell: ({ row: { original: job } }: JobCell) => {
      const interval = {
        start: job.status?.started ?? 0,
        end: job.status?.finished ?? Date.now(),
      };
      if (!interval.start) {
        return null;
      }
      const elapsed = interval.end - interval.start;
      if (elapsed < 1000) {
        return `${elapsed}ms`;
      }
      return intervalToAbbreviatedDurationString(interval, true);
    },
  },
  {
    id: 'message',
    header: 'Message',
    cell: ({ row: { original: job } }: JobCell) => <span>{job.status?.message}</span>,
  },
];

interface ExpandedRowProps {
  row: Job;
}

function ExpandedRow({ row }: ExpandedRowProps) {
  const hasSummary = Boolean(row.status?.summary?.length);
  const hasErrors = Boolean(row.status?.errors?.length);
  const hasSpec = Boolean(row.spec);

  if (!hasSummary && !hasErrors && !hasSpec) {
    console.log('no summary, errors, or spec', row);
    return null;
  }

  // the action is already showin
  const data = useMemo(() => {
    const v: TraceKeyValuePair[] = [];
    const action = row.spec?.action;
    if (!action) {
      return v;
    }
    const def = row.spec?.[action];
    if (!def) {
      return v;
    }
    for (const [key, value] of Object.entries(def)) {
      v.push({ key, value });
    }
    return v;
  }, [row.spec]);

  return (
    <Box padding={2}>
      <Stack direction="column" gap={2}>
        {hasSpec && (
          <Stack direction="column">
            <Text variant="body" color="secondary">
              Job Specification
            </Text>
            <KeyValuesTable data={data} />
          </Stack>
        )}
        {hasErrors && (
          <Stack direction="column">
            {row.status?.errors?.map(
              (error, index) =>
                error.trim() && (
                  <Alert key={index} severity="error" title="Error">
                    <Stack alignItems="center" gap={1}>
                      <Icon name="exclamation-circle" size="sm" />
                      {error}
                    </Stack>
                  </Alert>
                )
            )}
          </Stack>
        )}
        {hasSummary && (
          <Stack direction="column" gap={2}>
            <Text variant="body" color="secondary">
              Summary
            </Text>
            <JobSummary summary={row.status!.summary!} />
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

function EmptyState() {
  return (
    <Stack direction={'column'} alignItems={'center'}>
      <Text color="secondary">No recent events...</Text>
      <Text variant="bodySmall" color="secondary">
        Note: history is not maintained after system restart
      </Text>
    </Stack>
  );
}

export function RecentJobs({ repo }: Props) {
  const [items, query] = useRepositoryJobs({ name: repo.metadata?.name, watch: true });
  const jobColumns = useMemo(() => getJobColumns(), []);

  if (query.isLoading) {
    return <Spinner />;
  }

  if (query.isError) {
    return (
      <Alert title="Error loading jobs" severity="error">
        <pre>{JSON.stringify(query.error)}</pre>
      </Alert>
    );
  }

  return (
    <Card>
      <Card.Heading>Recent jobs</Card.Heading>
      <Card.Description>
        {!items?.length ? (
          <EmptyState />
        ) : (
          <InteractiveTable
            data={items}
            columns={jobColumns}
            getRowId={(item) => `${item.metadata?.name}`}
            renderExpandedRow={(row) => <ExpandedRow row={row} />}
            pageSize={10}
          />
        )}
      </Card.Description>
    </Card>
  );
}
