import { useCallback, useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { Button, Text, Stack, Alert, TextLink } from '@grafana/ui';
import { Job, useCreateRepositoryJobsMutation } from 'app/api/clients/provisioning';
import { t, Trans } from 'app/core/internationalization';

import { JobStatus } from '../Job/JobStatus';
import { StepStatus } from '../hooks/useStepStatus';

import { WizardFormData } from './types';

export interface SynchronizeStepProps {
  onStepUpdate: (status: StepStatus, error?: string) => void;
  requiresMigration: boolean;
}

export function SynchronizeStep({ onStepUpdate, requiresMigration }: SynchronizeStepProps) {
  const [createJob] = useCreateRepositoryJobsMutation();
  const { getValues } = useFormContext<WizardFormData>();
  const [history, repoName] = getValues(['migrate.history', 'repositoryName']);
  const [job, setJob] = useState<Job>();

  useEffect(() => {
    onStepUpdate('running');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startSynchronization = useCallback(async () => {
    if (!repoName) {
      onStepUpdate('error', t('provisioning.job-step.error-no-repository-name', 'No repository name provided'));
      return;
    }

    try {
      onStepUpdate('running');
      const jobSpec = requiresMigration
        ? {
            migrate: {
              history,
            },
          }
        : {
            pull: {
              incremental: false, // will queue a full resync job
            },
          };

      const response = await createJob({
        name: repoName,
        jobSpec,
      }).unwrap();

      // The API returns an id in the status object
      if (response.status && 'id' in response.status) {
        setJob(response);
        return;
      }

      onStepUpdate('error', t('provisioning.job-step.error-no-job-id', 'Failed to start job'));
    } catch (error) {
      onStepUpdate('error', t('provisioning.job-step.error-starting-job', 'Error starting job'));
      console.error('Error starting job:', error);
    }
  }, [createJob, history, requiresMigration, repoName, onStepUpdate]);

  if (job) {
    return (
      <JobStatus
        watch={job}
        onStatusChange={(success) => {
          if (success) {
            onStepUpdate('success');
          } else {
            onStepUpdate('error', t('provisioning.job-step.error-job-failed', 'Job failed'));
          }
        }}
        onRunningChange={(isRunning) => {
          if (isRunning) {
            onStepUpdate('running');
          }
        }}
        onErrorChange={(error) => {
          if (error) {
            onStepUpdate('error', error);
          }
        }}
      />
    );
  }

  return (
    <Stack direction="column" gap={3} alignItems="flex-start">
      <Text color="secondary">
        <Trans i18nKey="provisioning.wizard.sync-description">
          Sync resources with external storage. After this one-time step, all future updates will be automatically saved
          to the repository and provisioned back into the instance.
        </Trans>
      </Text>
      <Alert
        title={t(
          'provisioning.wizard.alert-title',
          'Important: No data or configuration will be lost, but dashboards will be temporarily unavailable for a few minutes.'
        )}
        severity={'info'}
      >
        <ul style={{ marginLeft: '16px' }}>
          <li>
            <Trans i18nKey="provisioning.wizard.alert-point-1">
              Resources won't be able to be created, edited, or deleted during this process. In the last step, they will
              disappear.
            </Trans>
          </li>
          <li>
            <Trans i18nKey="provisioning.wizard.alert-point-2">
              Once provisioning is complete, resources will reappear and be managed through external storage.
            </Trans>
          </li>
          <li>
            <Trans i18nKey="provisioning.wizard.alert-point-3">
              The duration of this process depends on the number of resources involved.
            </Trans>
          </li>
          <li>
            <Trans i18nKey="provisioning.wizard.alert-point-4">
              Enterprise instance administrators can display an announcement banner to users. See{' '}
              <TextLink external href="https://grafana.com/docs/grafana/latest/administration/announcement-banner/">
                this guide
              </TextLink>{' '}
              for step-by-step instructions.
            </Trans>
          </li>
        </ul>
      </Alert>
      <Button variant="primary" onClick={startSynchronization}>
        {t('provisioning.wizard.button-start', 'Begin synchronization')}
      </Button>
    </Stack>
  );
}
