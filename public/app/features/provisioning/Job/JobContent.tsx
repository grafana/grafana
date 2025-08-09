import { useEffect, useRef } from 'react';

import { Trans, t } from '@grafana/i18n';
import { ControlledCollapse, Spinner, Stack, Text } from '@grafana/ui';
import { Job } from 'app/api/clients/provisioning/v0alpha1';

import { RepositoryLink } from '../Repository/RepositoryLink';
import ProgressBar from '../Shared/ProgressBar';
import { StepStatusInfo } from '../Wizard/types';

import { JobSummary } from './JobSummary';

export interface JobContentProps {
  jobType: 'sync' | 'delete' | 'move';
  job?: Job;
  isFinishedJob?: boolean;
  onStatusChange?: (statusInfo: StepStatusInfo) => void;
}

export function JobContent({ jobType, job, isFinishedJob = false, onStatusChange }: JobContentProps) {
  const errorSetRef = useRef(false);

  if (!job?.status) {
    return null;
  }

  const { state, message, progress, summary, errors } = job.status;
  const repoName = job.metadata?.labels?.['provisioning.grafana.app/repository'];

  // Update step status based on job state
  useEffect(() => {
    if (!state) {
      return;
    }

    switch (state) {
      case 'success':
        onStatusChange?.({ status: 'success' });
        break;
      case 'warning':
        if (!errorSetRef.current) {
          onStatusChange?.({
            status: 'warning',
            warning: {
              title: t('provisioning.job-status.status.title-warning-running-job', 'Job completed with warnings'),
              message: errors?.length ? errors : message,
            },
          });
          errorSetRef.current = true;
        }
        break;
      case 'error':
        if (!errorSetRef.current) {
          onStatusChange?.({
            status: 'error',
            error: {
              title: t('provisioning.job-status.status.title-error-running-job', 'Error running job'),
              message: errors?.length ? errors : message,
            },
          });
          errorSetRef.current = true;
        }
        break;
      case 'working':
      case 'pending':
        onStatusChange?.({ status: 'running' });
        break;
      default:
        break;
    }
  }, [state, message, errors, onStatusChange]);

  return (
    <Stack direction="column" gap={2}>
      <Stack direction="column" gap={2}>
        {['working', 'pending'].includes(state ?? '') && (
          <Stack direction="row" alignItems="center" justifyContent="center" gap={2}>
            <Spinner size={24} />
            <Text element="h5" color="secondary">
              {message ?? state ?? t('provisioning.job-status.starting', 'Starting...')}
            </Text>
          </Stack>
        )}
        {state && !['success', 'error'].includes(state) && (
          <Stack direction="row" alignItems="center" justifyContent="center" gap={2}>
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
          <RepositoryLink name={repoName} jobType={jobType} />
        ) : (
          <ControlledCollapse label={t('provisioning.job-status.label-view-details', 'View details')} isOpen={false}>
            <pre>{JSON.stringify(job, null, 2)}</pre>
          </ControlledCollapse>
        )}
      </Stack>
    </Stack>
  );
}
