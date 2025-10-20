import { skipToken } from '@reduxjs/toolkit/query';
import { memo, useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Checkbox, Field, Spinner, Stack, Text, TextLink } from '@grafana/ui';
import { Job, useGetRepositoryStatusQuery } from 'app/api/clients/provisioning/v0alpha1';

import { JobStatus } from '../Job/JobStatus';
import { ProvisioningAlert } from '../Shared/ProvisioningAlert';

import { useStepStatus } from './StepStatusContext';
import { useCreateSyncJob } from './hooks/useCreateSyncJob';
import { useResourceStats } from './hooks/useResourceStats';
import { WizardFormData } from './types';

export interface SynchronizeStepProps {
  isLegacyStorage?: boolean;
  onCancel?: (repoName: string) => void;
  isCancelling?: boolean;
}

export const SynchronizeStep = memo(function SynchronizeStep({
  isLegacyStorage,
  onCancel,
  isCancelling,
}: SynchronizeStepProps) {
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
  const [shouldEnablePolling, setShouldEnablePolling] = useState(true);

  const POLLING_INTERVAL_MS = 5000;

  const repositoryStatusQuery = useGetRepositoryStatusQuery(repoName ? { name: repoName } : skipToken, {
    // Disable polling by setting interval to 0 when we should stop
    pollingInterval: shouldEnablePolling ? POLLING_INTERVAL_MS : 0,
    skipPollingIfUnfocused: true,
  });

  const {
    healthy: isRepositoryHealthy,
    message: repositoryHealthMessages,
    checked,
  } = repositoryStatusQuery?.data?.status?.health || {};

  // healthStatusNotReady: If the repository is not yet ready (e.g., initial setup), synchronization cannot be started.
  // User can potentially fail at this step if they click too fast and repo is not ready.
  const healthStatusNotReady =
    isRepositoryHealthy === false && repositoryStatusQuery?.data?.status?.observedGeneration === 0;

  // Stop polling when repository becomes healthy
  useEffect(() => {
    if (!healthStatusNotReady) {
      setShouldEnablePolling(false);
    }
  }, [healthStatusNotReady]);

  const hasError = repositoryStatusQuery.isError;
  const isLoading = repositoryStatusQuery.isLoading || repositoryStatusQuery.isFetching;
  const isButtonDisabled = hasError || (checked !== undefined && isRepositoryHealthy === false) || healthStatusNotReady;

  const startSynchronization = async () => {
    const [history] = getValues(['migrate.history']);
    const response = await createSyncJob({ history });
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
          title={t(
            'provisioning.wizard.alert-title',
            'Important: No data or configuration will be lost, but dashboards will be temporarily unavailable for a few minutes.'
          )}
          severity={'info'}
        >
          <ul style={{ marginLeft: '16px' }}>
            <li>
              <Trans i18nKey="provisioning.wizard.alert-point-1">
                Resources won&#39;t be able to be created, edited, or deleted during this process. In the last step,
                they will disappear.
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
      )}
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

      {healthStatusNotReady ? (
        <>
          <Stack>
            <Trans i18nKey="provisioning.wizard.check-status-message">
              Repository connecting, synchronize will be ready soon.
            </Trans>
          </Stack>
          <Stack>
            <Stack>
              <Button
                onClick={() => {
                  repositoryStatusQuery.refetch();
                }}
                disabled={isLoading}
              >
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
