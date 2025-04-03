import { Spinner, Stack, Text } from '@grafana/ui';
import { Job, useListJobQuery } from 'app/api/clients/provisioning';
import { Trans } from 'app/core/internationalization';

import { ActiveJobStatus } from './ActiveJobStatus';
import { FinishedJobStatus } from './FinishedJobStatus';

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
