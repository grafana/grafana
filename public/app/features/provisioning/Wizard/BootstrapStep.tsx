import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import {
  Alert,
  Box,
  Card,
  Field,
  FieldSet,
  Icon,
  Input,
  LoadingPlaceholder,
  Stack,
  Switch,
  Text,
  Tooltip,
} from '@grafana/ui';
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
  const repoType = watch('repository.type');

  const resourceStats = useGetResourceStatsQuery();
  const filesQuery = useGetRepositoryFilesQuery({ name: repoName });
  const [selectedOption, setSelectedOption] = useState<ModeOption | null>(null);

  const state = useMemo(() => {
    return getState(repoName, settingsData, filesQuery.data, resourceStats.data);
  }, [repoName, settingsData, resourceStats.data, filesQuery.data]);

  useEffect(() => {
    if (state.actions.length && !selectedOption) {
      const first = state.actions[0];
      setSelectedOption(first);
      onOptionSelect(first.operation === 'migrate');
      setValue('repository.sync.target', first.target);
    }
  }, [state, selectedOption, setValue, onOptionSelect]);

  const handleOptionSelect = useCallback(
    (option: ModeOption) => {
      // Select the new option and update form state
      setSelectedOption(option);
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

  // Show the history selection
  const canIncludeHistory = repoType === 'github' && settingsData?.legacyStorage;

  return (
    <Stack direction="column" gap={2}>
      <Stack direction="column" gap={2}>
        <Box alignItems="center" padding={4}>
          <Stack direction="row" gap={4} alignItems="flex-start" justifyContent="center">
            <Stack direction="column" gap={1} alignItems="center">
              <Text variant="h4" color="secondary">
                <Trans i18nKey="provisioning.bootstrap-step.grafana">Grafana</Trans>
              </Text>
              <Stack direction="row" gap={2}>
                <Text variant="h3">
                  <Text variant="h3">
                    {state.resourceCount > 0
                      ? state.resourceCountString
                      : t('provisioning.bootstrap-step.empty', 'Empty')}
                  </Text>
                </Text>
              </Stack>
            </Stack>
            <Stack direction="column" gap={1} alignItems="center">
              <Text variant="h4" color="secondary">
                <Trans i18nKey="provisioning.bootstrap-step.repository">Repository</Trans>
              </Text>
              <Text variant="h3">
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
                  isSelected={action === selectedOption}
                  onClick={() => {
                    handleOptionSelect(action);
                  }}
                  autoFocus={index === 0}
                >
                  <Card.Heading>{action.label}</Card.Heading>
                  <Card.Description>{action.description}</Card.Description>
                </Card>
              ))}
            </>
          )}
        />

        {/* Add migration options */}
        {selectedOption?.operation === 'migrate' && (
          <>
            {Boolean(state.resourceCount) && (
              <Alert severity="info" title={t('provisioning.bootstrap-step.title-note', 'Note')}>
                <Trans i18nKey="provisioning.bootstrap-step.dashboards-unavailable-while-running-process">
                  Dashboards will be unavailable while running this process
                </Trans>
              </Alert>
            )}
            {Boolean(state.fileCount) && Boolean(state.resourceCount) && (
              <Alert
                title={t('provisioning.bootstrap-step.title-files-exist-in-the-target', 'Files exist in the target')}
                severity="info"
              >
                <Trans
                  i18nKey="provisioning.bootstrap-step.resources-will-be-added"
                  defaults="The {{count}} resources in grafana will be added to the repository. Grafana will then include both the current resources and anything from the repository when done."
                  values={{ count: state.resourceCount }}
                />
              </Alert>
            )}
            {canIncludeHistory && (
              <FieldSet label={t('provisioning.bootstrap-step.label-migrate-options', 'Migrate options')}>
                <Stack direction="column" gap={2}>
                  {canIncludeHistory && (
                    <Stack direction="row" gap={2} alignItems="center">
                      <Switch {...register('migrate.history')} defaultChecked={true} />
                      <Text>
                        <Trans i18nKey="provisioning.bootstrap-step.include-history">Include history</Trans>
                      </Text>
                      <Tooltip
                        content={t(
                          'provisioning.bootstrap-step.tooltip-include-history',
                          'Include complete dashboard version history'
                        )}
                        placement="top"
                      >
                        <Icon name="info-circle" />
                      </Tooltip>
                    </Stack>
                  )}
                </Stack>
              </FieldSet>
            )}
          </>
        )}

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
          >
            <Input
              {...register('repository.title', {
                required: t('provisioning.bootstrap-step.error-field-required', 'This field is required.'),
              })}
              placeholder={t(
                'provisioning.bootstrap-step.placeholder-my-repository-connection',
                'My repository connection'
              )}
              // Auto-focus the title field if it's the only available option
              autoFocus={state.actions.length === 1 && state.actions[0].target === 'folder'}
            />
          </Field>
        )}
      </Stack>
    </Stack>
  );
}
