import { css } from '@emotion/css';
import { memo, useCallback, useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Box, Card, Field, Input, LoadingPlaceholder, Stack, Text, useStyles2 } from '@grafana/ui';
import { RepositoryViewList } from 'app/api/clients/provisioning/v0alpha1';
import { generateRepositoryTitle } from 'app/features/provisioning/utils/data';

import { FreeTierLimitNote } from '../Shared/FreeTierLimitNote';
import { UPGRADE_URL } from '../constants';
import { isFreeTierLicense } from '../utils/isFreeTierLicense';

import { BootstrapStepCardIcons } from './BootstrapStepCardIcons';
import { BootstrapStepResourceCounting } from './BootstrapStepResourceCounting';
import { useStepStatus } from './StepStatusContext';
import { useModeOptions } from './hooks/useModeOptions';
import { useRepositoryStatus } from './hooks/useRepositoryStatus';
import { useResourceStats } from './hooks/useResourceStats';
import { WizardFormData } from './types';

// TODO use the limits from the API when they are available
const FREE_TIER_FOLDER_RESOURCE_LIMIT = 20;

export interface Props {
  settingsData?: RepositoryViewList;
  repoName: string;
}

export const BootstrapStep = memo(function BootstrapStep({ settingsData, repoName }: Props) {
  const { setStepStatusInfo } = useStepStatus();
  const {
    register,
    control,
    setValue,
    watch,
    getValues,
    formState: { errors },
  } = useFormContext<WizardFormData>();

  const selectedTarget = watch('repository.sync.target');
  const repositoryType = watch('repository.type');
  const { enabledOptions } = useModeOptions(repoName, settingsData);
  const { target } = enabledOptions?.[0];

  const {
    isReady: isRepositoryReady,
    isLoading: isRepositoryStatusLoading,
    hasError: repositoryStatusError,
    refetch: retryRepositoryStatus,
    isHealthy: isRepositoryHealthy,
    hasTimedOut,
    resetTimeout,
  } = useRepositoryStatus(repoName);

  const {
    resourceCountString,
    fileCountString,
    resourceCount,
    isLoading: isResourceStatsLoading,
  } = useResourceStats(repoName, selectedTarget, undefined, {
    enableRepositoryStatus: false,
    isHealthy: isRepositoryHealthy,
  });

  const isQuotaExceeded = Boolean(
    isFreeTierLicense() && selectedTarget === 'folder' && resourceCount > FREE_TIER_FOLDER_RESOURCE_LIMIT
  );
  const styles = useStyles2(getStyles);

  const isLoading = isRepositoryStatusLoading || isResourceStatsLoading || !isRepositoryReady;
  const isWaitingForHealth = isRepositoryReady && isRepositoryHealthy === undefined && !repositoryStatusError;

  const handleRetryWithReset = useCallback(() => {
    resetTimeout();
    retryRepositoryStatus();
  }, [resetTimeout, retryRepositoryStatus]);

  useEffect(() => {
    // Pick a name nice name based on type+settings
    const repository = getValues('repository');
    const title = generateRepositoryTitle(repository);
    setValue('repository.title', title);
  }, [getValues, setValue]);

  useEffect(() => {
    // Handle timeout error
    if (hasTimedOut) {
      setStepStatusInfo({
        status: 'error',
        error: {
          title: t(
            'provisioning.bootstrap-step.error-repository-status-timeout-title',
            'Repository health check timed out'
          ),
          message: t(
            'provisioning.bootstrap-step.error-repository-status-timeout-message',
            'The repository did not become healthy within 30 seconds. Please check the repository settings and try again.'
          ),
        },
        action: {
          label: t('provisioning.bootstrap-step.retry-action', 'Retry'),
          onClick: handleRetryWithReset,
        },
      });
      return;
    }

    // TODO: improve error handling base on BE response, leverage "fieldErrors" when available
    if (repositoryStatusError || isRepositoryHealthy === false) {
      setStepStatusInfo({
        status: 'error',
        error: {
          title: t(
            'provisioning.bootstrap-step.error-repository-status-unhealthy-title',
            'Repository status unhealthy'
          ),
          message: t(
            'provisioning.bootstrap-step.error-repository-status-unhealthy-message',
            'There was an issue connecting to the repository. Please check the repository settings and try again.'
          ),
        },
        action: {
          label: t('provisioning.bootstrap-step.retry-action', 'Retry'),
          onClick: retryRepositoryStatus,
        },
      });
    } else if (isQuotaExceeded) {
      setStepStatusInfo({
        status: 'error',
        error: {
          title: t('provisioning.bootstrap-step.error-quota-exceeded-title', 'Resource quota exceeded'),
          message: t(
            'provisioning.bootstrap-step.error-quota-exceeded-message',
            'The repository contains {{resourceCount}} resources, which exceeds the free-tier limit of {{limit}} resources per folder. To sync this repository, upgrade your account or reduce the number of resources.',
            { resourceCount, limit: FREE_TIER_FOLDER_RESOURCE_LIMIT }
          ),
        },
        action: {
          label: t('provisioning.bootstrap-step.upgrade-action', 'Upgrade account'),
          href: UPGRADE_URL,
          external: true,
        },
      });
    } else if (isWaitingForHealth) {
      // Show running status while waiting for repository to become healthy
      setStepStatusInfo({ status: 'running' });
    } else {
      setStepStatusInfo({ status: isLoading ? 'running' : 'idle' });
    }
  }, [
    isLoading,
    setStepStatusInfo,
    repositoryStatusError,
    retryRepositoryStatus,
    isRepositoryHealthy,
    hasTimedOut,
    handleRetryWithReset,
    isWaitingForHealth,
    isQuotaExceeded,
    resourceCount,
  ]);

  useEffect(() => {
    setValue('repository.sync.target', target);
  }, [target, setValue]);

  if (!repositoryStatusError && isLoading) {
    return (
      <Box padding={4}>
        <LoadingPlaceholder
          text={t('provisioning.bootstrap-step.text-loading-resource-information', 'Loading resource information...')}
        />
      </Box>
    );
  }

  if (isWaitingForHealth && !hasTimedOut) {
    return (
      <Box padding={4}>
        <LoadingPlaceholder
          text={t(
            'provisioning.bootstrap-step.text-waiting-for-repository-health',
            'Waiting for repository to become healthy...'
          )}
        />
      </Box>
    );
  }

  if (repositoryStatusError || isRepositoryHealthy === false || isQuotaExceeded || hasTimedOut) {
    // error message and retry will be set in above step status
    return null;
  }

  return (
    <Stack direction="column" gap={2}>
      <Stack direction="column" gap={2}>
        <Controller
          name="repository.sync.target"
          control={control}
          render={({ field: { ref, onChange, ...field } }) => (
            <>
              {enabledOptions?.map((action) => (
                <Card
                  key={action.target}
                  isSelected={action.target === selectedTarget}
                  onClick={() => {
                    if (!action.disabled) {
                      onChange(action.target);
                    }
                  }}
                  noMargin
                  disabled={action.disabled}
                  {...field}
                >
                  <Card.Heading>
                    <Text variant="h5">{action.label}</Text>
                  </Card.Heading>
                  <Card.Description>
                    <div className={styles.divider} />

                    <Box paddingBottom={2}>
                      <BootstrapStepCardIcons target={action.target} repoType={repositoryType} />
                    </Box>
                    <Stack direction="column" gap={3}>
                      {action.description}
                      <Text color="primary">{action.subtitle}</Text>
                      <FreeTierLimitNote limitType="resource" />
                    </Stack>
                    <div className={styles.divider} />

                    <BootstrapStepResourceCounting
                      fileCountString={fileCountString}
                      resourceCountString={resourceCountString}
                    />
                  </Card.Description>
                </Card>
              ))}
            </>
          )}
        />

        {/* Only show title field if folder sync */}
        {selectedTarget === 'folder' && (
          <Field
            label={t('provisioning.bootstrap-step.label-display-name', 'Display name')}
            description={t(
              'provisioning.bootstrap-step.description-clear-repository-connection',
              'Add a clear name for this repository connection'
            )}
            error={errors.repository?.title?.message}
            invalid={!!errors.repository?.title}
            required
            noMargin
          >
            <Input
              id="repository-title"
              {...register('repository.title', {
                required: t('provisioning.bootstrap-step.error-field-required', 'This field is required.'),
              })}
              placeholder={t(
                'provisioning.bootstrap-step.placeholder-my-repository-connection',
                'My repository connection'
              )}
              // Autofocus the title field if it's the only available option
              autoFocus={enabledOptions?.length === 1 && enabledOptions[0]?.target === 'folder'}
            />
          </Field>
        )}
      </Stack>
    </Stack>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  divider: css({
    height: 1,
    width: '100%',
    backgroundColor: theme.colors.border.medium,
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  }),
});
