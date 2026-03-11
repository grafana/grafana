import { useEffect, useMemo } from 'react';

import { Trans, t } from '@grafana/i18n';
import { ControlledCollapse, Spinner, Stack, Text } from '@grafana/ui';
import { Job } from 'app/api/clients/provisioning/v0alpha1';

import { PullRequestButtons } from '../Repository/PullRequestButtons';
import { RepositoryLink } from '../Repository/RepositoryLink';
import ProgressBar from '../Shared/ProgressBar';
import { StepStatusInfo } from '../Wizard/types';
import { JobType } from '../types';

import { JobSummary } from './JobSummary';
import { getJobMessages } from './getJobMessage';

export interface JobContentProps {
  jobType: JobType;
  job?: Job;
  isFinishedJob?: boolean;
  onStatusChange?: (statusInfo: StepStatusInfo) => void;
  onRetry?: () => void;
}

export function JobContent({ jobType, job, isFinishedJob = false, onStatusChange, onRetry }: JobContentProps) {
  const { state, message, progress, summary, errors, warnings } = job?.status || {};
  const repoName = job?.metadata?.labels?.['provisioning.grafana.app/repository'];
  const pullRequestURL = job?.status?.url?.newPullRequestURL;
  const messages = useMemo(
    () => getJobMessages({ state, message, errors, warnings }),
    [state, message, errors, warnings]
  );

  // Update step status based on job state.
  // Use deconstructed fields from job status to avoid effect churn from whole-object dependency changes.
  useEffect(() => {
    if (!state) {
      return;
    }

    switch (state) {
      case 'success':
        onStatusChange?.({ status: 'success' });
        break;
      case 'warning': {
        onStatusChange?.({
          status: 'warning',
          warning: {
            title: t('provisioning.job-status.status.title-warning-running-job', 'Job completed with warnings'),
            message: messages.warning,
          },
        });
        break;
      }
      case 'error': {
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
        break;
      }
      case 'working':
      case 'pending':
        onStatusChange?.({ status: 'running' });
        break;
      default:
        break;
    }
  }, [state, messages, onStatusChange, onRetry]);

  if (!job?.status) {
    return null;
  }

  return (
    <Stack direction="column" gap={2}>
      <Stack direction="column" gap={2}>
        {['working', 'pending'].includes(state ?? '') && (
          <Stack direction="column" alignItems="center">
            <Stack direction="row" alignItems="center" justifyContent="center" gap={2}>
              <Spinner size={24} />
              <Text element="h3" variant="h5" color="secondary">
                {message ?? state ?? t('provisioning.job-status.starting', 'Starting...')}
              </Text>
            </Stack>
            <ProgressBar progress={progress ?? 0} />
          </Stack>
        )}
        {isFinishedJob && summary && (
          <Stack direction="column" gap={2}>
            <Text variant="h3">
              <Trans i18nKey="provisioning.job-status.summary">Summary</Trans>
            </Text>
            <JobSummary summary={summary} />
          </Stack>
        )}
        {state === 'success' ? (
          pullRequestURL ? (
            <PullRequestButtons urls={job.status?.url} jobType={jobType} />
          ) : (
            <RepositoryLink name={repoName} jobType={jobType} />
          )
        ) : (
          <ControlledCollapse label={t('provisioning.job-status.label-view-details', 'View details')} isOpen={false}>
            <pre>{JSON.stringify(job, null, 2)}</pre>
          </ControlledCollapse>
        )}
      </Stack>
    </Stack>
  );
}
