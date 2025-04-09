import { useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Checkbox, Field, Input, MultiCombobox, Stack, Switch, Text, TextLink } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { getWorkflowOptions } from '../Config/ConfigForm';
import { checkPublicAccess, checkImageRenderer } from '../GettingStarted/features';

import { WizardFormData } from './types';

export function FinishStep() {
  const { register, watch, control, formState } = useFormContext<WizardFormData>();
  const { errors } = formState;

  const type = watch('repository.type');
  const isGithub = type === 'github';
  const isPublic = checkPublicAccess();
  const hasImageRenderer = checkImageRenderer();
  // Enable sync by default
  const { setValue } = useFormContext<WizardFormData>();

  if (!isPublic || !hasImageRenderer) {
    if (formState.defaultValues?.repository) {
      formState.defaultValues.repository.generateDashboardPreviews = false;
    }
  }
  if (!isPublic) {
    if (formState.defaultValues?.repository) {
      // TODO: Disable webhooks by default
    }
  }

  // Set sync enabled by default
  useEffect(() => {
    setValue('repository.sync.enabled', true);
  }, [setValue]);

  return (
    <Stack direction="column">
      {isGithub && (
        <Field
          label={t(
            'provisioning.finish-step.label-update-instance-interval-seconds',
            'Update instance interval (seconds)'
          )}
          description={t(
            'provisioning.finish-step.description-often-shall-instance-updates-git-hub',
            'How often shall the instance pull updates from GitHub?'
          )}
          required
        >
          <Input
            {...register('repository.sync.intervalSeconds', { valueAsNumber: true })}
            type="number"
            placeholder={t('provisioning.finish-step.placeholder', '60')}
          />
        </Field>
      )}

      <Field
        label={t('provisioning.finish-step.label-workflows', 'Workflows')}
        description={t(
          'provisioning.finish-step.description-select-workflows-allowed-within-repository',
          'Select the workflows that are allowed within this repository'
        )}
        required
        error={errors.repository?.workflows?.message}
        invalid={!!errors.repository?.workflows}
      >
        <Controller
          name="repository.workflows"
          control={control}
          rules={{ required: t('provisioning.finish-step.error-field-required', 'This field is required.') }}
          render={({ field: { ref, onChange, ...field } }) => (
            <MultiCombobox
              options={getWorkflowOptions(type)}
              placeholder={t('provisioning.finish-step.placeholder-readonly-repository', 'Read-only repository')}
              onChange={(val) => {
                onChange(val.map((v) => v.value));
              }}
              {...field}
            />
          )}
        />
      </Field>

      {isGithub && false /* TODO */ && (
        <Field
          label={
            t(
              'provisioning.finish-step.label-enable-webhooks',
              'Enable webhooks on changes'
            ) /* TODO: Link to docs when !isPublic */
          }
          description={t(
            'provisioning.finish-step.description-enable-webhooks',
            'Enable webhooks to automatically notify Grafana when a change occurs in the repository. This will allow Grafana to pull changes as soon as they are made.'
          )}
          disabled={!isPublic}
        >
          {/* TODO: Make an option for the switch to control */}
          <Switch id="repository.webhook.enable" />
        </Field>
      )}

      <Stack direction="column" gap={2}>
        <Stack direction="column" gap={0}>
          <Text element="h4">
            <Trans i18nKey="provisioning.finish-step.title-enhance-github">Enhance your GitHub experience</Trans>
          </Text>
          <Text color="secondary" variant="bodySmall">
            <Trans i18nKey="provisioning.finish-step.text-setup-later">You can always set this up later</Trans>
          </Text>
        </Stack>
        {isGithub && (
          <Field>
            <Checkbox
              disabled={!hasImageRenderer || !isPublic}
              label={t('provisioning.finish-step.label-enable-previews', 'Enable dashboard previews in pull requests')}
              description={
                <>
                  <Trans i18nKey="provisioning.finish-step.description-enable-previews">
                    Adds an image preview of dashboard changes in pull requests. Images of your Grafana dashboards will
                    be shared in your Git repository and visible to anyone with repository access.
                  </Trans>{' '}
                  <Text italic>
                    <Trans i18nKey="provisioning.finish-step.description-image-rendering">
                      Requires image rendering.{' '}
                      <TextLink
                        variant="bodySmall"
                        external
                        href="https://grafana.com/grafana/plugins/grafana-image-renderer/"
                      >
                        Set up image rendering
                      </TextLink>
                    </Trans>
                  </Text>
                </>
              }
              {...register('repository.generateDashboardPreviews')}
            />
          </Field>
        )}
      </Stack>
    </Stack>
  );
}
