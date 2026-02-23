import { useMemo, useRef } from 'react';

import { intervalToAbbreviatedDurationString, TraceKeyValuePair } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Badge, Box, Card, InteractiveTable, Spinner, Stack, Text } from '@grafana/ui';
import { getErrorMessage } from 'app/api/clients/provisioning/utils/httpUtils';
import { Job, Repository } from 'app/api/clients/provisioning/v0alpha1';
import KeyValuesTable from 'app/features/explore/TraceView/components/TraceTimelineViewer/SpanDetail/KeyValuesTable';

import { ProvisioningAlert } from '../Shared/ProvisioningAlert';
import { useRepositoryAllJobs } from '../hooks/useRepositoryAllJobs';
import { getStatusColor } from '../utils/repositoryStatus';
import { formatTimestamp } from '../utils/time';

import { JobAlerts } from './JobAlerts';
import { JobSummary } from './JobSummary';

interface Props {
  repo: Repository;
}

type JobCell = {
  row: {
    original: Job;
  };
};

function formatJobDuration(job: Job): string | null {
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
}

const getJobColumns = () => [
  {
    id: 'jobId',
    header: t('provisioning.recent-jobs.column-job-id', 'Job ID'),
    cell: ({ row: { original: job } }: JobCell) => <Text variant="body">{job.metadata?.name || ''}</Text>,
  },
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
    cell: ({ row: { original: job } }: JobCell) => formatJobDuration(job),
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
  const hasWarnings = Boolean(row.status?.warnings?.length);
  const hasSpec = Boolean(row.spec);

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

  if (!hasSummary && !hasErrors && !hasWarnings && !hasSpec) {
    return null;
  }

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
        {row.status && <JobAlerts status={row.status} />}
        {hasSummary && row.status?.summary && (
          <Stack direction="column" gap={2}>
            <Text variant="body" color="secondary">
              <Trans i18nKey="provisioning.expanded-row.summary">Summary</Trans>
            </Text>
            <JobSummary summary={row.status.summary} />
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

export function RecentJobs({ repo }: Props) {
  const [jobs, activeQuery, historicQuery] = useRepositoryAllJobs({
    repositoryName: repo.metadata?.name ?? 'x',
  });
  const jobColumns = useMemo(() => getJobColumns(), []);
  const hasLoadedDataRef = useRef(false);

  if (activeQuery.data || historicQuery.data) {
    hasLoadedDataRef.current = true;
  }

  const renderContent = () => {
    const isInitialLoading = !hasLoadedDataRef.current && (activeQuery.isLoading || historicQuery.isLoading);

    if (isInitialLoading) {
      return (
        <Stack direction="column" alignItems="center">
          <Spinner />
        </Stack>
      );
    }

    if (activeQuery.isError) {
      return (
        <ProvisioningAlert
          error={{
            title: t('provisioning.recent-jobs.error-loading-active-jobs', 'Error loading active jobs'),
            message: getErrorMessage(activeQuery.error),
          }}
        />
      );
    }

    if (historicQuery.isError) {
      return (
        <ProvisioningAlert
          error={{
            title: t('provisioning.recent-jobs.error-loading-historic-jobs', 'Error loading historic jobs'),
            message: getErrorMessage(historicQuery.error),
          }}
        />
      );
    }

    if (!jobs?.length) {
      return <EmptyState />;
    }

    return (
      <InteractiveTable
        data={jobs}
        columns={jobColumns}
        getRowId={(item) => `${item.metadata?.uid}`}
        renderExpandedRow={(row) => <ExpandedRow row={row} />}
        pageSize={10}
      />
    );
  };

  return (
    <Card noMargin>
      <Card.Heading>
        <Trans i18nKey="provisioning.recent-jobs.jobs">Jobs</Trans>
      </Card.Heading>
      <Card.Description>{renderContent()}</Card.Description>
    </Card>
  );
}
