import { memo, useCallback, useEffect } from 'react';
import { useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Box, Button, Checkbox, Field, LoadingPlaceholder, Stack, Text } from '@grafana/ui';

import { JobStatus } from '../Job/JobStatus';
import { GitSyncLimitationsAlert } from '../Shared/GitSyncLimitationsAlert';

import { useStepStatus } from './StepStatusContext';
import { useRepositoryStatus } from './hooks/useRepositoryStatus';
import { useResourceStats } from './hooks/useResourceStats';
import { useSyncJob } from './hooks/useSyncJob';
import { type WizardFormData, type WizardStep } from './types';
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

  const { job, setJob, startJob } = useSyncJob({ repoName, setStepStatusInfo });

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

  const startSynchronization = useCallback(async () => {
    await startJob(requiresMigration);
  }, [startJob, requiresMigration]);

  const retryJob = useCallback(() => {
    setJob(undefined);
    void startSynchronization();
  }, [setJob, startSynchronization]);

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
      {isHealthy && <GitSyncLimitationsAlert syncTarget={syncTarget} />}
      {config.featureToggles.provisioningExport && (
        <>
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
                    Instance sync requires all resources to be managed. Existing resources will be migrated
                    automatically.
                  </Trans>
                ) : (
                  <Trans i18nKey="provisioning.synchronize-step.migrate-resources-description">
                    Import existing dashboards from connected external storage into the provisioning folder created in
                    the previous step
                  </Trans>
                )
              }
            />
          </Field>
        </>
      )}
      <Field noMargin>
        <Button variant="primary" onClick={startSynchronization} disabled={isButtonDisabled}>
          <Trans i18nKey="provisioning.wizard.button-start">Begin synchronization</Trans>
        </Button>
      </Field>
    </Stack>
  );
});
