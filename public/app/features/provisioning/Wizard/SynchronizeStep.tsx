import { useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Button, Text, Stack, Alert, TextLink, Field, Checkbox } from '@grafana/ui';
import { Job } from 'app/api/clients/provisioning/v0alpha1';

import { JobStatus } from '../Job/JobStatus';

import { useStepStatus } from './StepStatusContext';
import { useCreateSyncJob } from './hooks/useCreateSyncJob';
import { useResourceStats } from './hooks/useResourceStats';
import { WizardFormData } from './types';

export interface SynchronizeStepProps {
  isLegacyStorage?: boolean;
}

export function SynchronizeStep({ isLegacyStorage }: SynchronizeStepProps) {
  const { getValues, register, watch } = useFormContext<WizardFormData>();
  const { setStepStatusInfo } = useStepStatus();
  const [repoName = '', repoType] = watch(['repositoryName', 'repository.type']);
  const { requiresMigration } = useResourceStats(repoName, isLegacyStorage);
  const { createSyncJob, supportsHistory } = useCreateSyncJob({
    repoName,
    requiresMigration,
    repoType,
    isLegacyStorage,
    setStepStatusInfo,
  });
  const [job, setJob] = useState<Job>();

  const startSynchronization = async () => {
    const [history] = getValues(['migrate.history']);
    const response = await createSyncJob({ history });
    if (response) {
      setJob(response);
    }
  };

  if (job) {
    return <JobStatus watch={job} onStatusChange={setStepStatusInfo} jobType="sync" />;
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
      {supportsHistory && (
        <>
          <Text element="h3">
            <Trans i18nKey="provisioning.synchronize-step.synchronization-options">Synchronization options</Trans>
          </Text>
          <Field noMargin>
            <Checkbox
              {...register('migrate.history')}
              id="migrate-history"
              label={t('provisioning.wizard.sync-option-history', 'History')}
              description={
                <Trans i18nKey="provisioning.synchronize-step.synchronization-description">
                  Include commits for each historical value
                </Trans>
              }
            />
          </Field>
        </>
      )}

      <Button variant="primary" onClick={startSynchronization}>
        <Trans i18nKey="provisioning.wizard.button-start">Begin synchronization</Trans>
      </Button>
    </Stack>
  );
}
