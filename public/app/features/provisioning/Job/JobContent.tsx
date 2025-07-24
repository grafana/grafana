import { Trans, t } from '@grafana/i18n';
import { Alert, ControlledCollapse, Spinner, Stack, Text } from '@grafana/ui';
import { Job } from 'app/api/clients/provisioning/v0alpha1';

import { RepositoryLink } from '../Repository/RepositoryLink';
import ProgressBar from '../Shared/ProgressBar';

import { JobSummary } from './JobSummary';

export interface JobContentProps {
  job?: Job;
  isFinishedJob?: boolean;
}

export function JobContent({ job, isFinishedJob = false }: JobContentProps) {
  if (!job?.status) {
    return null;
  }

  const { state, message, progress, summary, errors } = job.status;
  const repoName = job.metadata?.labels?.['provisioning.grafana.app/repository'];

  const getStatusDisplay = () => {
    switch (state) {
      case 'success':
        return (
          <Alert
            severity="success"
            title={t('provisioning.job-status.status.title-job-completed-successfully', 'Job completed successfully')}
          />
        );
      case 'warning':
        return (
          <Alert
            severity="warning"
            title={t('provisioning.job-status.status.title-warning-running-job', 'Job completed with warnings')}
          >
            {errors?.length ? errors?.join('\n') : message}
          </Alert>
        );
      case 'error':
        return (
          <Alert
            severity="error"
            title={t('provisioning.job-status.status.title-error-running-job', 'Error running job')}
          >
            {errors?.length ? errors?.join('\n') : message}
          </Alert>
        );
    }
    return (
      <Stack direction="row" alignItems="center" justifyContent="center" gap={2}>
        {['working', 'pending'].includes(state ?? '') && <Spinner size={24} />}
        <Text element="h4" color="secondary">
          {message ?? state ?? ''}
        </Text>
      </Stack>
    );
  };

  return (
    <Stack direction="column" gap={2}>
      <Stack direction="column" gap={2}>
        {getStatusDisplay()}
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
          <RepositoryLink name={repoName} />
        ) : (
          <ControlledCollapse label={t('provisioning.job-status.label-view-details', 'View details')} isOpen={false}>
            <pre>{JSON.stringify(job, null, 2)}</pre>
          </ControlledCollapse>
        )}
      </Stack>
    </Stack>
  );
}
