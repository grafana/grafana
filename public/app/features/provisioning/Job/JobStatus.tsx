import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useRef } from 'react';

import { Alert, ControlledCollapse, LinkButton, Spinner, Stack, Text } from '@grafana/ui';
import {
  Job,
  useGetRepositoryJobsWithPathQuery,
  useGetRepositoryQuery,
  useListJobQuery,
} from 'app/api/clients/provisioning';
import { Trans, t } from 'app/core/internationalization';

import ProgressBar from '../Shared/ProgressBar';
import { getRepoHref } from '../utils/git';

import { JobSummary } from './JobSummary';

export interface JobStatusProps {
  watch: Job;
  onStatusChange?: (success: boolean) => void;
  onRunningChange?: (isRunning: boolean) => void;
  onErrorChange?: (error: string | null) => void;
}

// Shared hook for status change effects
function useJobStatusEffect(
  job?: Job,
  onStatusChange?: (success: boolean) => void,
  onRunningChange?: (isRunning: boolean) => void,
  onErrorChange?: (error: string | null) => void
) {
  useEffect(() => {
    if (!job) {
      return;
    }

    if (onStatusChange && job.status?.state === 'success') {
      onStatusChange(true);
      if (onRunningChange) {
        onRunningChange(false);
      }
    }
    if (onErrorChange && job.status?.state === 'error') {
      onErrorChange(job.status.message ?? t('provisioning.job-status.error-unknown', 'An unknown error occurred'));
      if (onRunningChange) {
        onRunningChange(false);
      }
    }
  }, [job, onStatusChange, onErrorChange, onRunningChange]);
}

export function JobStatus({ watch, onStatusChange, onRunningChange, onErrorChange }: JobStatusProps) {
  const activeQuery = useListJobQuery({
    fieldSelector: `metadata.name=${watch.metadata?.name}`,
    watch: true,
  });
  const activeJob = activeQuery?.data?.items?.[0];
  const repoLabel = watch.metadata?.labels?.['provisioning.grafana.app/repository'];

  // Only initialize finished query if we've checked active jobs and found none
  const activeQueryCompleted = !activeQuery.isUninitialized && !activeQuery.isLoading;
  const shouldCheckFinishedJobs = activeQueryCompleted && !activeJob && !!repoLabel;

  if (activeQuery.isLoading) {
    return (
      <Stack direction="row" alignItems="center" justifyContent="center" gap={2}>
        <Spinner size={24} />
        <Text element="h4" weight="bold">
          <Trans i18nKey="provisioning.job-status.starting">Starting...</Trans>
        </Text>
      </Stack>
    );
  }

  if (activeJob) {
    return (
      <ActiveJobStatus
        job={activeJob}
        onStatusChange={onStatusChange}
        onRunningChange={onRunningChange}
        onErrorChange={onErrorChange}
      />
    );
  }

  if (shouldCheckFinishedJobs) {
    return (
      <FinishedJobStatus
        jobUid={watch.metadata?.uid!}
        repositoryName={repoLabel}
        onStatusChange={onStatusChange}
        onRunningChange={onRunningChange}
        onErrorChange={onErrorChange}
      />
    );
  }

  return (
    <Stack direction="row" alignItems="center" justifyContent="center" gap={2}>
      <Spinner size={24} />
      <Text element="h4" weight="bold">
        <Trans i18nKey="provisioning.job-status.starting">Starting...</Trans>
      </Text>
    </Stack>
  );
}

interface ActiveJobProps {
  job: Job;
  onStatusChange?: (success: boolean) => void;
  onRunningChange?: (isRunning: boolean) => void;
  onErrorChange?: (error: string | null) => void;
}

function ActiveJobStatus({ job, onStatusChange, onRunningChange, onErrorChange }: ActiveJobProps): JSX.Element {
  useJobStatusEffect(job, onStatusChange, onRunningChange, onErrorChange);
  return <JobContent job={job} isFinishedJob={false} />;
}

interface FinishedJobProps {
  jobUid: string;
  repositoryName: string;
  onStatusChange?: (success: boolean) => void;
  onRunningChange?: (isRunning: boolean) => void;
  onErrorChange?: (error: string | null) => void;
}

function FinishedJobStatus({
  jobUid,
  repositoryName,
  onStatusChange,
  onRunningChange,
  onErrorChange,
}: FinishedJobProps) {
  const hasRetried = useRef(false);
  const finishedQuery = useGetRepositoryJobsWithPathQuery({
    name: repositoryName,
    uid: jobUid,
  });
  const retryFailed = hasRetried.current && finishedQuery.isError;

  const job = finishedQuery.data;

  useJobStatusEffect(job, onStatusChange, onRunningChange, onErrorChange);

  useEffect(() => {
    const shouldRetry = !hasRetried.current && !finishedQuery.isFetching;

    if (shouldRetry) {
      hasRetried.current = true;
      setTimeout(() => {
        finishedQuery.refetch();
      }, 1000);
    }

    return undefined;
  }, [finishedQuery]);

  if (finishedQuery.isLoading || finishedQuery.isFetching) {
    return (
      <Stack direction="row" alignItems="center" justifyContent="center" gap={2}>
        <Spinner size={24} />
        <Text element="h4" weight="bold">
          <Trans i18nKey="provisioning.job-status.loading-finished-job">Loading finished job...</Trans>
        </Text>
      </Stack>
    );
  }

  if (retryFailed) {
    return (
      <Alert severity="error" title={t('provisioning.job-status.no-job-found', 'No job found')}>
        <Trans i18nKey="provisioning.job-status.no-job-found-message">
          The job may have been deleted or could not be retrieved. Cancel the current process and start again.
        </Trans>
      </Alert>
    );
  }

  return <JobContent job={job} isFinishedJob={true} />;
}

interface JobContentProps {
  job?: Job;
  isFinishedJob?: boolean;
}

function JobContent({ job, isFinishedJob = false }: JobContentProps) {
  if (!job) {
    return null;
  }

  const getStatusDisplay = () => {
    switch (job.status?.state) {
      case 'success':
        return (
          <Alert
            severity="success"
            title={t('provisioning.job-status.status.title-job-completed-successfully', 'Job completed successfully')}
          />
        );
      case 'error':
        return (
          <Alert
            severity="error"
            title={t('provisioning.job-status.status.title-error-running-job', 'error running job')}
          >
            {job.status.message}
          </Alert>
        );
    }
    return (
      <Stack direction="row" alignItems="center" justifyContent="center" gap={2}>
        {job.status?.state === 'working' && <Spinner size={24} />}
        <Text element="h4" color="secondary">
          {job.status?.message ?? job.status?.state ?? ''}
        </Text>
      </Stack>
    );
  };

  return (
    <Stack direction="column" gap={2}>
      {job.status && (
        <Stack direction="column" gap={2}>
          {getStatusDisplay()}

          <Stack direction="row" alignItems="center" justifyContent="center" gap={2}>
            <ProgressBar progress={job.status.progress} />
          </Stack>

          {isFinishedJob && job.status.summary && (
            <Stack direction="column" gap={2}>
              <Text variant="h3">
                <Trans i18nKey="provisioning.job-status.summary">Summary</Trans>
              </Text>
              <JobSummary summary={job.status.summary} />
            </Stack>
          )}
          {job.status.state === 'success' ? (
            <RepositoryLink name={job.metadata?.labels?.repository} />
          ) : (
            <ControlledCollapse label={t('provisioning.job-status.label-view-details', 'View details')} isOpen={false}>
              <pre>{JSON.stringify(job, null, 2)}</pre>
            </ControlledCollapse>
          )}
        </Stack>
      )}
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

  const repoHref = getRepoHref(repo.spec?.github);
  const folderHref = repo.spec?.sync.target === 'folder' ? `/dashboards/f/${repo.metadata?.name}` : '/dashboards';

  if (!repoHref) {
    return null;
  }

  return (
    <Stack direction="column" gap={1}>
      <Text>
        <Trans i18nKey="provisioning.repository-link.grafana-repository">
          Grafana and your repository are now in sync.
        </Trans>
      </Text>
      <Stack direction="row" gap={2}>
        <LinkButton fill="outline" href={repoHref} icon="external-link-alt" target="_blank" rel="noopener noreferrer">
          <Trans i18nKey="provisioning.repository-link.view-repository">View repository</Trans>
        </LinkButton>
        <LinkButton fill="outline" href={folderHref} icon="folder-open">
          <Trans i18nKey="provisioning.repository-link.view-folder">View folder</Trans>
        </LinkButton>
      </Stack>
    </Stack>
  );
}
