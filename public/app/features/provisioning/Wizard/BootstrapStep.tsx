import { css } from '@emotion/css';
import { useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Box, Card, Field, Input, LoadingPlaceholder, Stack, Text, useStyles2 } from '@grafana/ui';
import { RepositoryViewList } from 'app/api/clients/provisioning/v0alpha1';
import { generateRepositoryTitle } from 'app/features/provisioning/utils/data';

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

export function BootstrapStep({ settingsData, repoName }: Props) {
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
  const options = useModeOptions(repoName, settingsData);
  const { target } = options[0];
  const { resourceCountString, fileCountString, isLoading } = useResourceStats(repoName, settingsData?.legacyStorage);
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
        {/* <Box alignItems="center" padding={4}>
          <Stack direction="row" gap={4} alignItems="flex-start" justifyContent="center">
            <Stack direction="column" gap={1} alignItems="center">
              <Text color="secondary">
                <Trans i18nKey="provisioning.bootstrap-step.grafana">Grafana instance</Trans>
              </Text>
              <Stack direction="row" gap={2}>
                <Text variant="h4">{resourceCountString}</Text>
              </Stack>
            </Stack>
            <Stack direction="column" gap={1} alignItems="center">
              <Text color="secondary">
                <Trans i18nKey="provisioning.bootstrap-step.ext-storage">External storage</Trans>
              </Text>
              <Text variant="h4">{fileCountString}</Text>
            </Stack>
          </Stack>
        </Box> */}

        <Controller
          name="repository.sync.target"
          control={control}
          render={({ field: { ref, onChange, ...field } }) => (
            <>
              {options.map((action) => (
                <Card
                  key={action.target}
                  isSelected={action.target === selectedTarget}
                  onClick={() => {
                    onChange(action.target);
                  }}
                  noMargin
                  {...field}
                >
                  <Card.Heading>{action.label}</Card.Heading>
                  <Card.Description>
                    <div className={styles.divider} />
                    <Stack direction="row" gap={4} alignItems="center">
                      <Stack>
                        <Box paddingBottom={2}>
                          <BootstrapStepCardIcons target={action.target} repoType={repositoryType} />
                        </Box>
                      </Stack>
                      <Stack direction="column" gap={3}>
                        {action.description}
                        <Text color="primary">{action.subtitle}</Text>
                      </Stack>
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
              autoFocus={options.length === 1 && options[0].target === 'folder'}
            />
          </Field>
        )}
      </Stack>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  divider: css({
    height: 1,
    width: '100%',
    backgroundColor: theme.colors.border.medium,
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  }),
});
