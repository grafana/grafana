import { useCallback, useEffect, useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Box, Card, Field, Input, LoadingPlaceholder, Stack, Text } from '@grafana/ui';
import { RepositoryViewList, useGetRepositoryFilesQuery, useGetResourceStatsQuery } from 'app/api/clients/provisioning';
import { t, Trans } from 'app/core/internationalization';

import { StepStatus } from '../hooks/useStepStatus';

import { getState } from './actions';
import { ModeOption, WizardFormData } from './types';

interface Props {
  onOptionSelect: (requiresMigration: boolean) => void;
  onStepUpdate: (status: StepStatus, error?: string) => void;
  settingsData?: RepositoryViewList;
  repoName: string;
}

export function BootstrapStep({ onOptionSelect, settingsData, repoName }: Props) {
  const {
    register,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<WizardFormData>();

  const selectedTarget = watch('repository.sync.target');

  const resourceStats = useGetResourceStatsQuery();
  const filesQuery = useGetRepositoryFilesQuery({ name: repoName });

  const state = useMemo(() => {
    return getState(repoName, settingsData, filesQuery.data, resourceStats.data);
  }, [repoName, settingsData, resourceStats.data, filesQuery.data]);

  useEffect(() => {
    if (state.actions.length && !selectedTarget) {
      const first = state.actions[0];
      setValue('repository.sync.target', first.target);
      onOptionSelect(first.operation === 'migrate');
    }
  }, [state, selectedTarget, setValue, onOptionSelect]);

  const handleOptionSelect = useCallback(
    (option: ModeOption) => {
      setValue('repository.sync.target', option.target);

      if (option.operation === 'migrate') {
        setValue('migrate.history', true);
        setValue('migrate.identifier', true);
      }
      onOptionSelect(option.operation === 'migrate');
    },
    [setValue, onOptionSelect]
  );

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
                  {state.resourceCount > 0
                    ? state.resourceCountString
                    : t('provisioning.bootstrap-step.empty', 'Empty')}
                </Text>
              </Stack>
            </Stack>
            <Stack direction="column" gap={1} alignItems="center">
              <Text color="secondary">
                <Trans i18nKey="provisioning.bootstrap-step.ext-storage">External storage</Trans>
              </Text>
              <Text variant="h4">
                {state.fileCount > 0
                  ? t('provisioning.bootstrap-step.files-count', '{{count}} files', { count: state.fileCount })
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
              {state.actions.map((action, index) => (
                <Card
                  key={`${action.target}-${action.operation}`}
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
              autoFocus={state.actions.length === 1 && state.actions[0].target === 'folder'}
            />
          </Field>
        )}
      </Stack>
    </Stack>
  );
}
