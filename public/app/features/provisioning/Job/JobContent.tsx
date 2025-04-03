import { Alert, ControlledCollapse, Spinner, Stack, Text } from '@grafana/ui';
import { Job } from 'app/api/clients/provisioning';
import { Trans, t } from 'app/core/internationalization';

import { RepositoryLink } from '../Repository/RepositoryLink';
import ProgressBar from '../Shared/ProgressBar';

import { JobSummary } from './JobSummary';

export interface JobContentProps {
  job?: Job;
  isFinishedJob?: boolean;
}

export function JobContent({ job, isFinishedJob = false }: JobContentProps) {
  if (!job) {
    return null;
  }

  const getStatusDisplay = () => {
    switch (job.status?.state) {
      case 'success':
        return (
          <Alert
            severity="success"
            title={t('provisioning.job-status.status.title-job-completed-successfully', 'Job completed successfully')}
          />
        );
      case 'error':
        return (
          <Alert
            severity="error"
            title={t('provisioning.job-status.status.title-error-running-job', 'Error running job')}
          >
            {job.status.message}
          </Alert>
        );
    }
    return (
      <Stack direction="row" alignItems="center" justifyContent="center" gap={2}>
        {job.status?.state === 'working' && <Spinner size={24} />}
        <Text element="h4" color="secondary">
          {job.status?.message ?? job.status?.state ?? ''}
        </Text>
      </Stack>
    );
  };

  return (
    <Stack direction="column" gap={2}>
      {job.status && (
        <Stack direction="column" gap={2}>
          {getStatusDisplay()}

          <Stack direction="row" alignItems="center" justifyContent="center" gap={2}>
            <ProgressBar progress={job.status.progress} />
          </Stack>

          {isFinishedJob && job.status.summary && (
            <Stack direction="column" gap={2}>
              <Text variant="h3">
                <Trans i18nKey="provisioning.job-status.summary">Summary</Trans>
              </Text>
              <JobSummary summary={job.status.summary} />
            </Stack>
          )}
          {job.status.state === 'success' ? (
            <RepositoryLink name={job.metadata?.labels?.repository} />
          ) : (
            <ControlledCollapse label={t('provisioning.job-status.label-view-details', 'View details')} isOpen={false}>
              <pre>{JSON.stringify(job, null, 2)}</pre>
            </ControlledCollapse>
          )}
        </Stack>
      )}
    </Stack>
  );
}
