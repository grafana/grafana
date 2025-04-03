import { useEffect, useRef } from 'react';

import { Alert, Spinner, Stack, Text } from '@grafana/ui';
import { useGetRepositoryJobsWithPathQuery } from 'app/api/clients/provisioning';
import { Trans, t } from 'app/core/internationalization';

import { JobContent } from './JobContent';
import { useJobStatusEffect } from './hooks';

export interface FinishedJobProps {
  jobUid: string;
  repositoryName: string;
  onStatusChange?: (success: boolean) => void;
  onRunningChange?: (isRunning: boolean) => void;
  onErrorChange?: (error: string | null) => void;
}

export function FinishedJobStatus({
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

  if (!job) {
    return null;
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
