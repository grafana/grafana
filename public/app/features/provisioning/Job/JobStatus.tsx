import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect } from 'react';

import { Alert, ControlledCollapse, LinkButton, Spinner, Stack, Text } from '@grafana/ui';
import {
  Job,
  useGetRepositoryJobsWithPathQuery,
  useGetRepositoryQuery,
  useListJobQuery,
} from 'app/api/clients/provisioning';

import ProgressBar from '../Shared/ProgressBar';
import { getRepoHref } from '../utils/git';

import { JobSummary } from './JobSummary';

export interface JobStatusProps {
  watch: Job;
  onStatusChange?: (success: boolean) => void;
  onRunningChange?: (isRunning: boolean) => void;
  onErrorChange?: (error: string | null) => void;
}

export function JobStatus({ watch, onStatusChange, onRunningChange, onErrorChange }: JobStatusProps) {
  const activeQuery = useListJobQuery({
    fieldSelector: `metadata.name=${watch.metadata?.name}`,
    watch: true,
  });
  const activeJob = activeQuery?.data?.items?.[0];
  const finishedQuery = useGetRepositoryJobsWithPathQuery(
    activeJob
      ? skipToken
      : {
          name: watch.metadata?.labels?.['provisioning.grafana.app/repository']!,
          uid: watch.metadata?.uid!,
        }
  );

  const job = activeJob || finishedQuery.data;

  useEffect(() => {
    if (!job) {
      finishedQuery.refetch();
    }
  }, [finishedQuery, job]);

  useEffect(() => {
    if (onStatusChange && job?.status?.state === 'success') {
      onStatusChange(true);
      if (onRunningChange) {
        onRunningChange(false);
      }
    }
    if (onErrorChange && job?.status?.state === 'error') {
      onErrorChange(job.status.message ?? 'An unknown error occurred');
      if (onRunningChange) {
        onRunningChange(false);
      }
    }
  }, [job, onStatusChange, onErrorChange, onRunningChange]);

  if (!job || activeQuery.isLoading) {
    return (
      <Stack direction="row" alignItems="center" justifyContent="center" gap={2}>
        <Spinner size={24} />
        <Text element="h4" weight="bold">
          Starting...
        </Text>
      </Stack>
    );
  }

  const status = () => {
    switch (job.status?.state) {
      case 'success':
        return <Alert severity="success" title="Job completed successfully" />;
      case 'error':
        return (
          <Alert severity="error" title="error running job">
            {job.status.message}
          </Alert>
        );
    }
    return (
      <Stack direction="row" alignItems="center" justifyContent="center" gap={2}>
        {!job.status?.progress && <Spinner size={24} />}
        <Text element="h4" color="secondary">
          {job.status?.message ?? job.status?.state!}
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
              <Text variant="h3">Summary</Text>
              <JobSummary summary={job.status.summary} />
            </Stack>
          )}
          {job.status.state === 'success' ? (
            <RepositoryLink name={job.metadata?.labels?.repository} />
          ) : (
            <ControlledCollapse label="View details" isOpen={false}>
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
      <Text>Grafana and your repository are now in sync.</Text>
      <Stack direction="row" gap={2}>
        <LinkButton fill="outline" href={repoHref} icon="external-link-alt" target="_blank" rel="noopener noreferrer">
          View repository
        </LinkButton>
        <LinkButton fill="outline" href={folderHref} icon="folder-open">
          View folder
        </LinkButton>
      </Stack>
    </Stack>
  );
}
