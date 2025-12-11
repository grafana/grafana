import { css } from '@emotion/css';
import React, { memo, useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Box, Card, Checkbox, Field, Icon, Input, LoadingPlaceholder, Stack, Text, useStyles2 } from '@grafana/ui';
import { RepositoryViewList } from 'app/api/clients/provisioning/v0alpha1';
import { generateRepositoryTitle } from 'app/features/provisioning/utils/data';

import { FreeTierLimitNote } from '../Shared/FreeTierLimitNote';

import { BootstrapStepCardIcons } from './BootstrapStepCardIcons';
import { BootstrapStepResourceCounting } from './BootstrapStepResourceCounting';
import { useStepStatus } from './StepStatusContext';
import { useModeOptions } from './hooks/useModeOptions';
import { useResourceStats } from './hooks/useResourceStats';
import { WizardFormData } from './types';

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
  const { enabledOptions, disabledOptions } = useModeOptions(repoName, settingsData);
  const { target } = enabledOptions?.[0];
  const { resourceCountString, fileCountString, isLoading } = useResourceStats(repoName, selectedTarget);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    // Pick a name nice name based on type+settings
    const repository = getValues('repository');
    const title = generateRepositoryTitle(repository);
    setValue('repository.title', title);
  }, [getValues, setValue]);

  useEffect(() => {
    setStepStatusInfo({ status: isLoading ? 'running' : 'idle' });
  }, [isLoading, setStepStatusInfo]);

  useEffect(() => {
    setValue('repository.sync.target', target);
  }, [target, setValue]);

  if (isLoading) {
    return (
      <Box padding={4}>
        <LoadingPlaceholder
          text={t('provisioning.bootstrap-step.text-loading-resource-information', 'Loading resource information...')}
        />
      </Box>
    );
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
                      target={action.target}
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
          <>
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
            <Controller
              name="migrate.migrateExistingResources"
              control={control}
              render={({ field: { onChange, value, ...field } }) => (
                <Field
                  description={t(
                    'provisioning.bootstrap-step.description-migrate-existing-resources',
                    'Additionally migrate all existing unmanaged resources to this repository and pull everything from there.'
                  )}
                  noMargin
                >
                  <Checkbox
                    id="migrate-existing-resources"
                    {...field}
                    value={value || false}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
                    label={t(
                      'provisioning.bootstrap-step.label-migrate-existing-resources',
                      'Additionally migrate all existing unmanaged resources to this folder'
                    )}
                  />
                </Field>
              )}
            />
          </>
        )}

        {disabledOptions?.length > 0 && (
          <>
            {/* Unavailable options */}
            <Box marginTop={3}>
              <Text variant="h4">
                {t('provisioning.bootstrap-step.unavailable-options.title', 'Unavailable options')}
              </Text>
            </Box>
            {disabledOptions?.map((action) => (
              <Card key={action.target} noMargin disabled={action.disabled}>
                <Card.Heading>
                  <Text variant="h5">{action.label}</Text>
                </Card.Heading>
                <Card.Description>
                  <div className={styles.divider} />
                  <Icon name="info-circle" className={styles.infoIcon} /> {action.disabledReason}
                </Card.Description>
              </Card>
            ))}
          </>
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
  infoIcon: css({
    color: theme.colors.primary.main,
    marginRight: theme.spacing(0.25),
    marginBottom: theme.spacing(0.25),
  }),
});
