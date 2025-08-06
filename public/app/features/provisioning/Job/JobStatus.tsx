import { Trans, t } from '@grafana/i18n';
import { Spinner, Stack, Text } from '@grafana/ui';
import { Job, useListJobQuery } from 'app/api/clients/provisioning/v0alpha1';

import { StepStatusInfo } from '../Wizard/types';

import { FinishedJobStatus } from './FinishedJobStatus';
import { JobContent } from './JobContent';

export interface JobStatusProps {
  watch: Job;
  onStatusChange?: (statusInfo: StepStatusInfo) => void;
  jobType: 'sync' | 'delete' | 'move';
}

export function JobStatus({ jobType, watch, onStatusChange }: JobStatusProps) {
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
        <Text element="h4" color="secondary">
          <Trans i18nKey="provisioning.job-status.starting">Starting...</Trans>
        </Text>
      </Stack>
    );
  }

  if (activeQuery.isError) {
    onStatusChange?.({
      status: 'error',
      error: {
        title: t('provisioning.job-status.title.error-fetching-active-job', 'Error fetching active job'),
      },
    });
    return null;
  }

  if (activeJob) {
    return <JobContent job={activeJob} isFinishedJob={false} onStatusChange={onStatusChange} jobType={jobType} />;
  }

  if (shouldCheckFinishedJobs) {
    return <FinishedJobStatus jobUid={watch.metadata?.uid!} repositoryName={repoLabel} onStatusChange={onStatusChange} />;
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
