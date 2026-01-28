import { memo, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Checkbox, Field, Spinner, Stack, Text, TextLink } from '@grafana/ui';
import { Job } from 'app/api/clients/provisioning/v0alpha1';

import { JobStatus } from '../Job/JobStatus';
import { ProvisioningAlert } from '../Shared/ProvisioningAlert';

import { useStepStatus } from './StepStatusContext';
import { useCreateSyncJob } from './hooks/useCreateSyncJob';
import { useRepositoryStatus } from './hooks/useRepositoryStatus';
import { useResourceStats } from './hooks/useResourceStats';
import { WizardFormData } from './types';

export interface SynchronizeStepProps {
  onCancel?: (repoName: string) => void;
  isCancelling?: boolean;
}

export const SynchronizeStep = memo(function SynchronizeStep({ onCancel, isCancelling }: SynchronizeStepProps) {
  const { watch, register } = useFormContext<WizardFormData>();
  const { setStepStatusInfo } = useStepStatus();
  const [repoName = '', syncTarget, migrateResources] = watch([
    'repositoryName',
    'repository.sync.target',
    'migrate.migrateResources',
  ]);

  const {
    isHealthy: isRepositoryHealthy,
    healthMessage: repositoryHealthMessages,
    checked,
    healthStatusNotReady,
    hasError,
    isLoading,
    refetch: refetchRepositoryStatus,
  } = useRepositoryStatus(repoName);

  const { requiresMigration } = useResourceStats(repoName, syncTarget, migrateResources, {
    enableRepositoryStatus: false,
    isHealthy: isRepositoryHealthy,
  });

  const { createSyncJob } = useCreateSyncJob({
    repoName,
    setStepStatusInfo,
  });
  const [job, setJob] = useState<Job>();

  const isButtonDisabled = hasError || (checked !== undefined && isRepositoryHealthy === false) || healthStatusNotReady;

  const startSynchronization = async () => {
    const response = await createSyncJob(requiresMigration);
    if (response) {
      setJob(response);
    }
  };

  if (isLoading) {
    return <Spinner />;
  }
  if (job) {
    return <JobStatus watch={job} onStatusChange={setStepStatusInfo} jobType="sync" />;
  }

  return (
    <Stack direction="column" gap={3}>
      <Text color="secondary">
        <Trans i18nKey="provisioning.wizard.sync-description">
          Sync resources with external storage. After this one-time step, all future updates will be automatically saved
          to the repository and provisioned back into the instance.
        </Trans>
      </Text>
      {hasError && (
        <ProvisioningAlert
          error={{
            title: t('provisioning.synchronize-step.repository-error', 'Repository error'),
            message: t(
              'provisioning.synchronize-step.repository-error-message',
              'Unable to check repository status. Please verify the repository configuration and try again.'
            ),
          }}
        />
      )}
      {repositoryHealthMessages && !isRepositoryHealthy && !hasError && (
        <ProvisioningAlert
          error={{
            title: t(
              'provisioning.synchronize-step.repository-unhealthy',
              'The repository cannot be synchronized. Cancel provisioning and try again once the issue has been resolved. See details below.'
            ),
            message: repositoryHealthMessages,
          }}
        />
      )}
      {isRepositoryHealthy && (
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
                Import existing dashboards from all folders into the new provisioned folder
              </Trans>
            )
          }
        />
      </Field>
      {healthStatusNotReady ? (
        <>
          <Stack>
            <Trans i18nKey="provisioning.wizard.check-status-message">
              Repository connecting, synchronize will be ready soon.
            </Trans>
          </Stack>
          <Stack>
            <Stack>
              <Button onClick={refetchRepositoryStatus} disabled={isLoading}>
                <Trans i18nKey="provisioning.wizard.check-status-button">Check repository status</Trans>
              </Button>
            </Stack>
          </Stack>
        </>
      ) : (
        <Field noMargin>
          {hasError || (checked !== undefined && isRepositoryHealthy === false) ? (
            <Button variant="destructive" onClick={() => onCancel?.(repoName)} disabled={isCancelling}>
              {isCancelling ? (
                <Trans i18nKey="provisioning.wizard.button-cancelling">Cancelling...</Trans>
              ) : (
                <Trans i18nKey="provisioning.wizard.button-cancel">Cancel</Trans>
              )}
            </Button>
          ) : (
            <Button variant="primary" onClick={startSynchronization} disabled={isButtonDisabled}>
              <Trans i18nKey="provisioning.wizard.button-start">Begin synchronization</Trans>
            </Button>
          )}
        </Field>
      )}
    </Stack>
  );
});
