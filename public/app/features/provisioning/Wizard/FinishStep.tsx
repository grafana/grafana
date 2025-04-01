import { css } from '@emotion/css';
import { useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Field, Input, MultiCombobox, Stack, Switch, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

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
  const style = useStyles2(getStyles);

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

      {isGithub && (
        <Field
          useLabel
          label={
            <span>
              {t(
                'provisioning.finish-step.label-enable-dashboard-previews',
                'Enable dashboard previews in pull requests'
              )}{' '}
              <span className={style.explanation}>
                {t('provisioning.finish-step.text-requires-image-rendering', '(Requires image rendering.')}{' '}
                <a className={style.explanationLink} href="https://grafana.com">
                  {t('provisioning.finish-step.link-setup-image-rendering', 'Set up image rendering')}
                </a>
                {')'}
              </span>
            </span>
          }
          description={t(
            'provisioning.finish-step.description-dashboard-previews',
            'Adds an image preview of dashboard changes in pull requests. Images of your Grafana dashboards will be shared in your Git repository and visible to anyone with repository access.'
          )}
          disabled={!hasImageRenderer || !isPublic}
        >
          <Switch {...register('repository.generateDashboardPreviews')} id="repository.generateDashboardPreviews" />
        </Field>
      )}
    </Stack>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    explanation: css({
      color: theme.colors.text.disabled,
      fontStyle: 'italic',
    }),
    explanationLink: css({
      color: theme.colors.text.link,
      fontStyle: 'italic',
    }),
  };
}
