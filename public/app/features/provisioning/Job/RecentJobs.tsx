import { useMemo } from 'react';

import { intervalToAbbreviatedDurationString, TraceKeyValuePair } from '@grafana/data';
import { Alert, Badge, Box, Card, Icon, InteractiveTable, Spinner, Stack, Text } from '@grafana/ui';
import { Job, Repository, SyncStatus } from 'app/api/clients/provisioning';
import { Trans, t } from 'app/core/internationalization';
import KeyValuesTable from 'app/features/explore/TraceView/components/TraceTimelineViewer/SpanDetail/KeyValuesTable';

import { useRepositoryAllJobs } from '../hooks/useRepositoryAllJobs';
import { formatTimestamp } from '../utils/time';

import { JobSummary } from './JobSummary';

interface Props {
  repo: Repository;
}

type JobCell = {
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
    header: t('provisioning.recent-jobs.column-status', 'Status'),
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
    header: t('provisioning.recent-jobs.column-action', 'Action'),
    cell: ({ row: { original: job } }: JobCell) => job.spec?.action,
  },
  {
    id: 'started',
    header: t('provisioning.recent-jobs.column-started', 'Started'),
    cell: ({ row: { original: job } }: JobCell) => formatTimestamp(job.status?.started),
  },
  {
    id: 'duration',
    header: t('provisioning.recent-jobs.column-duration', 'Duration'),
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
    header: t('provisioning.recent-jobs.column-message', 'Message'),
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
    return null;
  }

  // the action is already showing
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
              <Trans i18nKey="provisioning.expanded-row.job-specification">Job Specification</Trans>
            </Text>
            <KeyValuesTable data={data} />
          </Stack>
        )}
        {hasErrors && (
          <Stack direction="column">
            {row.status?.errors?.map(
              (error, index) =>
                error.trim() && (
                  <Alert key={index} severity="error" title={t('provisioning.expanded-row.title-error', 'Error')}>
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
              <Trans i18nKey="provisioning.expanded-row.summary">Summary</Trans>
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
      <Text color="secondary">
        <Trans i18nKey="provisioning.empty-state.no-jobs">No jobs...</Trans>
      </Text>
    </Stack>
  );
}

function ErrorLoading(typ: string, error: string) {
  return (
    <Alert
      title={t('provisioning.recent-jobs.error-loading', 'Error loading {{type}}', { type: typ })}
      severity="error"
    >
      <pre>{JSON.stringify(error)}</pre>
    </Alert>
  );
}

function Loading() {
  return (
    <Stack direction={'column'} alignItems={'center'}>
      <Spinner />
    </Stack>
  );
}

export function RecentJobs({ repo }: Props) {
  // TODO: Decide on whether we want to wait on historic jobs to show the current ones.
  //   Gut feeling is that current jobs are far more important to show than historic ones.
  const [jobs, activeQuery, historicQuery] = useRepositoryAllJobs({
    repositoryName: repo.metadata?.name ?? 'x',
  });
  const jobColumns = useMemo(() => getJobColumns(), []);

  let description: JSX.Element;
  if (activeQuery.isLoading || historicQuery.isLoading) {
    description = Loading();
  } else if (activeQuery.isError) {
    description = ErrorLoading(t('provisioning.recent-jobs.active-jobs', 'active jobs'), activeQuery.error);
    // TODO: Figure out what to do if historic fails. Maybe a separate card?
  } else if (!jobs?.length) {
    description = <EmptyState />;
  } else {
    description = (
      <InteractiveTable
        data={jobs}
        columns={jobColumns}
        getRowId={(item) => `${item.metadata?.uid}`}
        renderExpandedRow={(row) => <ExpandedRow row={row} />}
        pageSize={10}
      />
    );
  }

  return (
    <Card>
      <Card.Heading>
        <Trans i18nKey="provisioning.recent-jobs.jobs">Jobs</Trans>
      </Card.Heading>
      <Card.Description>{description}</Card.Description>
    </Card>
  );
}
