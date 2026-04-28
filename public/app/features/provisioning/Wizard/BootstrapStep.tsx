import { css } from '@emotion/css';
import { memo, useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Box, Card, Field, Input, LoadingPlaceholder, Stack, Text } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';
import { type RepositoryViewList } from 'app/api/clients/provisioning/v0alpha1';
import { generateRepositoryTitle } from 'app/features/provisioning/utils/data';

import { QuotaLimitNote } from '../Shared/QuotaLimitNote';
import { CONFIGURE_GRAFANA_DOCS_URL, UPGRADE_URL } from '../constants';
import { isOnPrem } from '../utils/isOnPrem';

import { BootstrapStepCardIcons } from './BootstrapStepCardIcons';
import { BootstrapStepResourceCounting } from './BootstrapStepResourceCounting';
import { useStepStatus } from './StepStatusContext';
import { useModeOptions } from './hooks/useModeOptions';
import { useRepositoryStatus } from './hooks/useRepositoryStatus';
import { useResourceStats } from './hooks/useResourceStats';
import { type WizardFormData } from './types';

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
    formState: { errors, dirtyFields },
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
    isHealthy,
    isUnhealthy,
    healthStatusNotReady,
    quota,
  } = useRepositoryStatus(repoName);

  const {
    resourceCountString,
    fileCountString,
    fileCount,
    isLoading: isResourceStatsLoading,
  } = useResourceStats(repoName, selectedTarget, undefined, { isHealthy, healthStatusNotReady });

  const maxResourcesPerRepository = quota?.maxResourcesPerRepository ?? 0;
  const styles = useStyles2(getStyles);

  const isLoading = isRepositoryStatusLoading || isResourceStatsLoading || !isRepositoryReady;
  const isQuotaExceeded = !isLoading && maxResourcesPerRepository > 0 && fileCount > maxResourcesPerRepository;

  useEffect(() => {
    // Pick a nice name based on type+settings, but only if user hasn't modified it
    if (!dirtyFields.repository?.title) {
      const repository = getValues('repository');
      const title = generateRepositoryTitle(repository);
      setValue('repository.title', title);
    }
  }, [getValues, setValue, dirtyFields.repository?.title]);

  useEffect(() => {
    // TODO: improve error handling base on BE response, leverage "fieldErrors" when available
    // Only show error if: query error, OR unhealthy (already reconciled)
    if (repositoryStatusError || isUnhealthy) {
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
      const onPrem = isOnPrem();
      setStepStatusInfo({
        status: 'error',
        error: {
          title: t('provisioning.bootstrap-step.error-quota-exceeded-title', 'Resource quota exceeded'),
          message: onPrem
            ? t(
                'provisioning.bootstrap-step.error-quota-exceeded-message-onprem',
                'This repository folder contains {{fileCount}} resources, which exceeds your instance limit of {{limit}}. To sync this repository, update your Grafana configuration or reduce the number of resources to sync.',
                { fileCount, limit: maxResourcesPerRepository }
              )
            : t(
                'provisioning.bootstrap-step.error-quota-exceeded-message',
                'This repository folder contains {{fileCount}} resources, which exceeds your account limit of {{limit}}. To sync this repository, upgrade your account or reduce the number of resources to sync.',
                { fileCount, limit: maxResourcesPerRepository }
              ),
        },
        action: onPrem
          ? {
              label: t('provisioning.bootstrap-step.update-configuration-action', 'View configuration docs'),
              href: CONFIGURE_GRAFANA_DOCS_URL,
              external: true,
            }
          : {
              label: t('provisioning.bootstrap-step.upgrade-action', 'Upgrade account'),
              href: UPGRADE_URL,
              external: true,
            },
      });
    } else {
      setStepStatusInfo({ status: isLoading ? 'running' : 'idle' });
    }
  }, [
    isLoading,
    setStepStatusInfo,
    repositoryStatusError,
    retryRepositoryStatus,
    maxResourcesPerRepository,
    isQuotaExceeded,
    fileCount,
    isUnhealthy,
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

  // Only show error state if: query error, OR unhealthy (already reconciled), OR quota exceeded
  if (repositoryStatusError || isUnhealthy || isQuotaExceeded) {
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
                      <QuotaLimitNote maxResourcesPerRepository={maxResourcesPerRepository} />
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
              'This name will be used for the repository connection and the folder displayed in the UI'
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
