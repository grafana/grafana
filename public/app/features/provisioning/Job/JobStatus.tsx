import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect } from 'react';

import { Alert, ControlledCollapse, LinkButton, Spinner, Stack, Text } from '@grafana/ui';
import { useGetRepositoryQuery } from 'app/api/clients/provisioning';
import { Trans, t } from 'app/core/internationalization';

import ProgressBar from '../Shared/ProgressBar';
import { useRepositoryAllJobs } from '../hooks/useRepositoryAllJobs';
import { getRepoHref } from '../utils/git';

import { JobSummary } from './JobSummary';

export interface JobStatusProps {
  name: string;
  onStatusChange?: (success: boolean) => void;
  onRunningChange?: (isRunning: boolean) => void;
  onErrorChange?: (error: string | null) => void;
}

export function JobStatus({ name, onStatusChange, onRunningChange, onErrorChange }: JobStatusProps) {
  const [jobs, activeQuery, historicQuery] = useRepositoryAllJobs({ jobName: name, watch: true });
  const job = jobs?.[0];

  useEffect(() => {
    if (onRunningChange) {
      onRunningChange(
        activeQuery.isLoading ||
          historicQuery.isLoading ||
          !job ||
          job.status?.state === 'working' ||
          job.status?.state === 'pending'
      );
    }
  }, [activeQuery.isLoading, historicQuery.isLoading, job, onRunningChange, onErrorChange]);

  useEffect(() => {
    if (onStatusChange && job?.status?.state === 'success') {
      onStatusChange(true);
      if (onRunningChange) {
        onRunningChange(false);
      }
    }
    if (onErrorChange && job?.status?.state === 'error') {
      onErrorChange(job.status.message ?? t('provisioning.job-status.error-unknown', 'An unknown error occurred'));
      if (onRunningChange) {
        onRunningChange(false);
      }
    }
  }, [job, onStatusChange, onErrorChange, onRunningChange]);

  if (!name || activeQuery.isLoading || historicQuery.isLoading || !job) {
    return (
      <Stack direction="row" alignItems="center" justifyContent="center" gap={2}>
        <Spinner size={24} />
        <Text element="h4" weight="bold">
          <Trans i18nKey="provisioning.job-status.starting">Starting...</Trans>
        </Text>
      </Stack>
    );
  }

  const status = () => {
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
        {!job.status?.progress && <Spinner size={24} />}
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
          {status()}

          <Stack direction="row" alignItems="center" justifyContent="center" gap={2}>
            <ProgressBar progress={job.status.progress} />
          </Stack>

          {job.status.summary && (
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
              <pre>{JSON.stringify(job, null, ' ')}</pre>
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
