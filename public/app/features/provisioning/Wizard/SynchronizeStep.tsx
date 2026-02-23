import { memo, useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Alert, Box, Button, Checkbox, Field, LoadingPlaceholder, Stack, Text, TextLink } from '@grafana/ui';
import { Job } from 'app/api/clients/provisioning/v0alpha1';

import { JobStatus } from '../Job/JobStatus';

import { useStepStatus } from './StepStatusContext';
import { useCreateSyncJob } from './hooks/useCreateSyncJob';
import { useRepositoryStatus } from './hooks/useRepositoryStatus';
import { useResourceStats } from './hooks/useResourceStats';
import { WizardFormData, WizardStep } from './types';
import { getSyncStepStatus } from './utils/getSteps';

export interface SynchronizeStepProps {
  onCancel?: (repoName: string) => void;
  goToStep: (stepId: WizardStep) => void;
  isCancelling?: boolean;
}

export const SynchronizeStep = memo(function SynchronizeStep({
  onCancel,
  isCancelling,
  goToStep,
}: SynchronizeStepProps) {
  const { watch, register } = useFormContext<WizardFormData>();
  const { setStepStatusInfo } = useStepStatus();
  const [repoName = '', syncTarget, migrateResources] = watch([
    'repositoryName',
    'repository.sync.target',
    'migrate.migrateResources',
  ]);

  const {
    isHealthy,
    isUnhealthy,
    healthMessage: repositoryHealthMessages,
    healthStatusNotReady,
    hasError,
    fieldErrors,
    isLoading,
  } = useRepositoryStatus(repoName);

  const { requiresMigration } = useResourceStats(repoName, syncTarget, migrateResources, {
    isHealthy,
    healthStatusNotReady,
  });

  const { createSyncJob } = useCreateSyncJob({
    repoName,
    setStepStatusInfo,
  });
  const [job, setJob] = useState<Job>();

  useEffect(() => {
    // This useEffect is used to update the step status info based on the repository status and the form errors
    setStepStatusInfo(
      getSyncStepStatus({
        fieldErrors,
        hasError,
        isUnhealthy,
        isLoading,
        healthStatusNotReady,
        repositoryHealthMessages,
        goToStep,
      })
    );
  }, [
    fieldErrors,
    hasError,
    isUnhealthy,
    isLoading,
    healthStatusNotReady,
    repositoryHealthMessages,
    setStepStatusInfo,
    goToStep,
  ]);

  const isButtonDisabled = hasError || !isHealthy;

  const startSynchronization = async () => {
    const response = await createSyncJob(requiresMigration);
    if (response) {
      setJob(response);
    }
  };

  const retryJob = () => {
    setJob(undefined);
    startSynchronization();
  };

  if (isLoading || healthStatusNotReady) {
    return (
      <Box padding={4}>
        <LoadingPlaceholder
          text={t('provisioning.synchronize-step.text-checking-repository', 'Checking repository status...')}
        />
      </Box>
    );
  }
  if (hasError || isUnhealthy) {
    // Error message is handled by status context, only show cancel button
    return (
      <Stack direction="column" gap={3}>
        <Field noMargin>
          <Button variant="destructive" onClick={() => onCancel?.(repoName)} disabled={isCancelling}>
            {isCancelling ? (
              <Trans i18nKey="provisioning.wizard.button-cancelling">Cancelling...</Trans>
            ) : (
              <Trans i18nKey="provisioning.wizard.button-cancel">Cancel</Trans>
            )}
          </Button>
        </Field>
      </Stack>
    );
  }
  if (job) {
    return <JobStatus watch={job} onStatusChange={setStepStatusInfo} jobType="sync" onRetry={retryJob} />;
  }

  return (
    <Stack direction="column" gap={3}>
      <Text color="secondary">
        <Trans i18nKey="provisioning.wizard.sync-description">
          Sync resources with external storage. After this one-time step, all future updates will be automatically saved
          to the repository and provisioned back into the instance.
        </Trans>
      </Text>
      {isHealthy && (
        <Alert
          title={t('provisioning.wizard.alert-title', 'Important: Review Git Sync limitations before proceeding')}
          severity={'warning'}
        >
          <Stack direction="column" gap={2}>
            <Text>
              <Trans i18nKey="provisioning.wizard.alert-intro">
                Please be aware of the following limitations. For more details, see the{' '}
                <TextLink
                  external
                  href="https://grafana.com/docs/grafana/latest/as-code/observability-as-code/provision-resources/intro-git-sync/"
                >
                  Git Sync documentation
                </TextLink>
                .
              </Trans>
            </Text>
            <ul style={{ marginLeft: '16px', marginTop: 0, marginBottom: 0 }}>
              <li>
                <Trans i18nKey="provisioning.wizard.alert-point-1">
                  Resources can still be created, edited, or deleted during this process, but changes may not be
                  exported.
                </Trans>
              </li>
              <li>
                <Trans i18nKey="provisioning.wizard.alert-point-unsupported">
                  Alerts and library panels are not supported in provisioned folders.
                </Trans>
              </li>
              <li>
                <Trans i18nKey="provisioning.wizard.alert-point-permissions">
                  Fine-grained permissions are not supported. Default permissions apply: Admin, Editor, and Viewer roles
                  are preserved with their standard access levels.
                </Trans>
              </li>
              <li>
                <Trans i18nKey="provisioning.wizard.alert-point-3">
                  The duration of this process depends on the number of resources involved.
                </Trans>
              </li>
              {syncTarget === 'instance' && (
                <li>
                  <Trans i18nKey="provisioning.wizard.alert-point-instance-alerts">
                    Existing alerts and library panels will be lost and will not be usable after migration.
                  </Trans>
                </li>
              )}
              {syncTarget === 'folder' && (
                <>
                  <li>
                    <Trans i18nKey="provisioning.wizard.alert-point-folder-structure">
                      When migrating existing dashboards, the folder structure will be replicated in the repository.
                      Original folders will be emptied of dashboards but may still contain alerts or library panels.
                    </Trans>
                  </li>
                  <li>
                    <Trans i18nKey="provisioning.wizard.alert-point-folder-cleanup">
                      You may need to manually remove or manage original folders after migration.
                    </Trans>
                  </li>
                </>
              )}
            </ul>
            <Text color="secondary" variant="bodySmall">
              <Trans i18nKey="provisioning.wizard.alert-point-4">
                Enterprise instance administrators can display an announcement banner to notify users that migration is
                in progress. See{' '}
                <TextLink
                  external
                  variant="bodySmall"
                  href="https://grafana.com/docs/grafana/latest/administration/announcement-banner/"
                >
                  this guide
                </TextLink>{' '}
                for step-by-step instructions.
              </Trans>
            </Text>
          </Stack>
        </Alert>
      )}
      <Text element="h3">
        <Trans i18nKey="provisioning.synchronize-step.options">Options</Trans>
      </Text>
      <Field noMargin>
        <Checkbox
          {...register('migrate.migrateResources')}
          id="migrate-resources"
          label={t('provisioning.wizard.sync-option-migrate-resources', 'Migrate existing resources')}
          checked={syncTarget === 'instance' ? true : undefined}
          disabled={syncTarget === 'instance'}
          description={
            syncTarget === 'instance' ? (
              <Trans i18nKey="provisioning.synchronize-step.instance-migrate-resources-description">
                Instance sync requires all resources to be managed. Existing resources will be migrated automatically.
              </Trans>
            ) : (
              <Trans i18nKey="provisioning.synchronize-step.migrate-resources-description">
                Import existing dashboards from connected external storage into the provisioning folder created in the
                previous step
              </Trans>
            )
          }
        />
      </Field>
      <Field noMargin>
        <Button variant="primary" onClick={startSynchronization} disabled={isButtonDisabled}>
          <Trans i18nKey="provisioning.wizard.button-start">Begin synchronization</Trans>
        </Button>
      </Field>
    </Stack>
  );
});
