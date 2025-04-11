import { Spinner, Stack, Text } from '@grafana/ui';
import { Job, useListJobQuery } from 'app/api/clients/provisioning';
import { Trans } from 'app/core/internationalization';

import { StepStatusInfo } from '../Wizard/types';

import { FinishedJobStatus } from './FinishedJobStatus';
import { JobContent } from './JobContent';

export interface JobStatusProps {
  watch: Job;
  onStatusChange: (status: StepStatusInfo, error?: string) => void;
}

export function JobStatus({ watch, onStatusChange }: JobStatusProps) {
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
    onStatusChange({ status: 'error', error: 'Error fetching active job' });
    return null;
  }

  if (activeJob) {
    return <JobContent job={activeJob} isFinishedJob={false} />;
  }

  if (shouldCheckFinishedJobs) {
    return (
      <FinishedJobStatus jobUid={watch.metadata?.uid!} repositoryName={repoLabel} onStatusChange={onStatusChange} />
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
