import { useEffect, useRef } from 'react';

import { Trans, useTranslate } from '@grafana/i18n';
import { Alert, Spinner, Stack, Text } from '@grafana/ui';
import { useGetRepositoryJobsWithPathQuery } from 'app/api/clients/provisioning';

import { useStepStatus } from '../Wizard/StepStatusContext';

import { JobContent } from './JobContent';

export interface FinishedJobProps {
  jobUid: string;
  repositoryName: string;
}

export function FinishedJobStatus({ jobUid, repositoryName }: FinishedJobProps) {
  const hasRetried = useRef(false);
  const { setStepStatusInfo } = useStepStatus();
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
      setStepStatusInfo({ status: 'success' });
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [finishedQuery, job, setStepStatusInfo]);

  const { t } = useTranslate();

  if (retryFailed) {
    setStepStatusInfo({ status: 'error' });
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
