import { useEffect, useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Box, Card, Field, Input, LoadingPlaceholder, Stack, Text } from '@grafana/ui';
import { RepositoryViewList, useGetRepositoryFilesQuery, useGetResourceStatsQuery } from 'app/api/clients/provisioning';
import { t, Trans } from 'app/core/internationalization';

import { getResourceStats, useModeOptions } from './actions';
import { StepStatusInfo, WizardFormData } from './types';

interface Props {
  onOptionSelect: (requiresMigration: boolean) => void;
  onStepStatusUpdate: (info: StepStatusInfo) => void;
  settingsData?: RepositoryViewList;
  repoName: string;
}

export function BootstrapStep({ onOptionSelect, settingsData, repoName, onStepStatusUpdate }: Props) {
  const {
    register,
    control,
    setValue,
    watch,
    getValues,
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
    // Pick a name nice name based on type+settings
    const repository = getValues('repository');
    switch (repository.type) {
      case 'github':
        const name = repository.url ?? 'github';
        setValue('repository.title', name.replace('https://github.com/', ''));
        break;
      case 'local':
        setValue('repository.title', repository.path ?? 'local');
        break;
    }
  }, [getValues, setValue]);

  useEffect(() => {
    const isLoading = resourceStats.isLoading || filesQuery.isLoading;
    onStepStatusUpdate({ status: isLoading ? 'running' : 'idle' });
  }, [filesQuery.isLoading, onStepStatusUpdate, resourceStats.isLoading]);

  // Auto select the first option on mount
  useEffect(() => {
    const { target } = options[0];
    setValue('repository.sync.target', target);
    onOptionSelect(settingsData?.legacyStorage || resourceCount > 0);
    // Only run this effect on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          render={({ field: { ref, onChange, ...field } }) => (
            <>
              {options.map((action, index) => (
                <Card
                  key={action.target}
                  isSelected={action.target === selectedTarget}
                  onClick={() => {
                    onChange(action.target);
                  }}
                  {...field}
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
