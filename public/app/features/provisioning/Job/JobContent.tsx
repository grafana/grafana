import { useEffect, useRef } from 'react';

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
  const lastReportedStateRef = useRef<string>();

  const { state, message, progress, summary } = job?.status || {};
  const repoName = job?.metadata?.labels?.['provisioning.grafana.app/repository'];
  const pullRequestURL = job?.status?.url?.newPullRequestURL;

  // Update step status based on job state.
  // Guard with lastReportedStateRef to avoid re-reporting the same state,
  // which would create new objects on each call and trigger infinite re-render loops.
  useEffect(() => {
    if (!state || state === lastReportedStateRef.current) {
      return;
    }
    lastReportedStateRef.current = state;

    switch (state) {
      case 'success':
        onStatusChange?.({ status: 'success' });
        break;
      case 'warning': {
        const messages = getJobMessages(job?.status ?? {});
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
        const messages = getJobMessages(job?.status ?? {});
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
  }, [state, message, job, onStatusChange, onRetry]);

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
