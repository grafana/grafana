import { useEffect, useRef } from 'react';

import { Alert, Spinner, Stack, Text } from '@grafana/ui';
import { useGetRepositoryJobsWithPathQuery } from 'app/api/clients/provisioning';
import { Trans, t } from 'app/core/internationalization';

import { StepStatusInfo } from '../Wizard/types';

import { JobContent } from './JobContent';

export interface FinishedJobProps {
  jobUid: string;
  repositoryName: string;
  onStatusChange: (status: StepStatusInfo, error?: string) => void;
}

export function FinishedJobStatus({ jobUid, repositoryName, onStatusChange }: FinishedJobProps) {
  const hasRetried = useRef(false);
  const finishedQuery = useGetRepositoryJobsWithPathQuery({
    name: repositoryName,
    uid: jobUid,
  });
  const retryFailed = hasRetried.current && finishedQuery.isError;

  const job = finishedQuery.data;

  useEffect(() => {
    const shouldRetry = !job && !hasRetried.current && !finishedQuery.isFetching;
    let timeoutId: ReturnType<typeof setTimeout>;

    if (shouldRetry) {
      hasRetried.current = true;
      timeoutId = setTimeout(() => {
        finishedQuery.refetch();
      }, 1000);
    }

    if (finishedQuery.isSuccess) {
      onStatusChange({ status: 'success' });
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [finishedQuery, job, onStatusChange]);

  if (retryFailed) {
    onStatusChange({ status: 'error' });
    return (
      <Alert severity="error" title={t('provisioning.job-status.no-job-found', 'No job found')}>
        <Trans i18nKey="provisioning.job-status.no-job-found-message">
          The job may have been deleted or could not be retrieved. Cancel the current process and start again.
        </Trans>
      </Alert>
    );
  }

  if (!job || finishedQuery.isLoading || finishedQuery.isFetching) {
    return (
      <Stack direction="row" alignItems="center" justifyContent="center" gap={2}>
        <Spinner size={24} />
        <Text element="h4" color="secondary">
          <Trans i18nKey="provisioning.job-status.loading-finished-job">Loading finished job...</Trans>
        </Text>
      </Stack>
    );
  }

  return <JobContent job={job} isFinishedJob={true} />;
}
