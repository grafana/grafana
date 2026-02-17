import { useEffect, useRef } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Spinner, Stack, Text } from '@grafana/ui';
import { useGetRepositoryJobsWithPathQuery } from 'app/api/clients/provisioning/v0alpha1';

import { StepStatusInfo } from '../Wizard/types';

import { JobContent } from './JobContent';
import { getJobMessages } from './getJobMessage';

export interface FinishedJobProps {
  jobUid: string;
  repositoryName: string;
  jobType: 'sync' | 'delete' | 'move';
  onStatusChange?: (statusInfo: StepStatusInfo) => void;
  onRetry?: () => void;
}

export function FinishedJobStatus({ jobUid, repositoryName, jobType, onStatusChange, onRetry }: FinishedJobProps) {
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

    if (retryFailed) {
      onStatusChange?.({
        status: 'error',
        error: {
          title: t('provisioning.job-status.no-job-found', 'No job found'),
          message: t(
            'provisioning.job-status.no-job-found-message',
            'The job may have been deleted or could not be retrieved. Cancel the current process and start again.'
          ),
        },
      });
      return;
    }

    if (finishedQuery.isSuccess && job?.status) {
      const { state } = job.status;
      const messages = getJobMessages(job.status);

      if (state === 'error') {
        const warningInfo = messages.warning
          ? {
              title: t('provisioning.job-status.status.title-warning-running-job', 'Job completed with warnings'),
              message: messages.warning,
            }
          : undefined;
        onStatusChange?.({
          status: 'error',
          error: {
            title: t('provisioning.job-status.status.title-error-running-job', 'Error running job'),
            message: messages.error,
          },
          warning: warningInfo,
          action: onRetry && {
            label: t('provisioning.job-status.retry-action', 'Retry'),
            onClick: onRetry,
          },
        });
      } else if (state === 'success') {
        onStatusChange?.({
          status: 'success',
          success: {
            title: t('provisioning.job-status.status.title-success-running-job', 'Job completed successfully'),
          },
        });
      } else if (state === 'warning') {
        onStatusChange?.({
          status: 'warning',
          warning: {
            title: t('provisioning.job-status.status.title-warning-running-job', 'Job completed with warnings'),
            message: messages.warning,
          },
        });
      }
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [finishedQuery, job, onStatusChange, onRetry, retryFailed]);

  // If retry failed, return null - parent handles the error via onStatusChange
  if (retryFailed) {
    return null;
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

  return (
    <JobContent job={job} isFinishedJob={true} onStatusChange={onStatusChange} jobType={jobType} onRetry={onRetry} />
  );
}
