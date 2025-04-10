import { useEffect, useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Box, Card, Field, Input, LoadingPlaceholder, Stack, Text } from '@grafana/ui';
import { RepositoryViewList, useGetRepositoryFilesQuery, useGetResourceStatsQuery } from 'app/api/clients/provisioning';
import { t, Trans } from 'app/core/internationalization';

import { StepStatus } from '../hooks/useStepStatus';

import { getResourceStats, isMigrateOperation, useModeOptions } from './actions';
import { ModeOption, WizardFormData } from './types';

interface Props {
  onOptionSelect: (requiresMigration: boolean) => void;
  onStepUpdate: (status: StepStatus, error?: string) => void;
  settingsData?: RepositoryViewList;
  repoName: string;
}

export function BootstrapStep({ onOptionSelect, settingsData, repoName, onStepUpdate }: Props) {
  const {
    register,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<WizardFormData>();

  const resourceStats = useGetResourceStatsQuery();
  const filesQuery = useGetRepositoryFilesQuery({ name: repoName });
  const selectedTarget = watch('repository.sync.target');
  const options = useModeOptions(repoName, settingsData);
  const { resourceCount, resourceCountString, fileCount } = useMemo(
    () => getResourceStats(filesQuery.data, resourceStats.data),
    [filesQuery.data, resourceStats.data]
  );

  useEffect(() => {
    const isLoading = resourceStats.isLoading || filesQuery.isLoading;

    onStepUpdate(isLoading ? 'running' : 'idle');
  }, [filesQuery.isLoading, onStepUpdate, resourceStats.isLoading]);

  // Auto select the first option on mount
  useEffect(() => {
    setValue('repository.sync.target', options[0].target);
    onOptionSelect(resourceCount === 0);
  }, [onOptionSelect, options, resourceCount, setValue]);

  const handleOptionSelect = (option: ModeOption) => {
    setValue('repository.sync.target', option.target);

    if (isMigrateOperation(option.target)) {
      setValue('migrate.history', true);
      setValue('migrate.identifier', true);
    }
  };

  if (resourceStats.isLoading || filesQuery.isLoading) {
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
        <Box alignItems="center" padding={4}>
          <Stack direction="row" gap={4} alignItems="flex-start" justifyContent="center">
            <Stack direction="column" gap={1} alignItems="center">
              <Text color="secondary">
                <Trans i18nKey="provisioning.bootstrap-step.grafana">Grafana instance</Trans>
              </Text>
              <Stack direction="row" gap={2}>
                <Text variant="h4">
                  {resourceCount > 0 ? resourceCountString : t('provisioning.bootstrap-step.empty', 'Empty')}
                </Text>
              </Stack>
            </Stack>
            <Stack direction="column" gap={1} alignItems="center">
              <Text color="secondary">
                <Trans i18nKey="provisioning.bootstrap-step.ext-storage">External storage</Trans>
              </Text>
              <Text variant="h4">
                {fileCount > 0
                  ? t('provisioning.bootstrap-step.files-count', '{{count}} files', { count: fileCount })
                  : t('provisioning.bootstrap-step.empty', 'Empty')}
              </Text>
            </Stack>
          </Stack>
        </Box>

        <Controller
          name="repository.sync.target"
          control={control}
          render={() => (
            <>
              {options.map((action, index) => (
                <Card
                  key={action.target}
                  isSelected={action.target === selectedTarget}
                  onClick={() => {
                    handleOptionSelect(action);
                  }}
                  autoFocus={index === 0}
                >
                  <Card.Heading>{action.label}</Card.Heading>
                  <Card.Description>
                    <Stack direction="column" gap={3}>
                      {action.description}
                      <Text color="primary">{action.subtitle}</Text>
                    </Stack>
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
          >
            <Input
              {...register('repository.title', {
                required: t('provisioning.bootstrap-step.error-field-required', 'This field is required.'),
              })}
              placeholder={t(
                'provisioning.bootstrap-step.placeholder-my-repository-connection',
                'My repository connection'
              )}
              // Autofocus the title field if it's the only available option
              autoFocus={options.length === 1 && options[0].target === 'folder'}
            />
          </Field>
        )}
      </Stack>
    </Stack>
  );
}
