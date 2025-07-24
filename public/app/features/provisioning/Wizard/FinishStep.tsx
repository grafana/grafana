import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Checkbox, Field, Input, Stack, Text, TextLink } from '@grafana/ui';

import { checkImageRenderer, checkPublicAccess } from '../GettingStarted/features';
import { isGitProvider } from '../utils/repositoryTypes';

import { getGitProviderFields } from './fields';
import { WizardFormData } from './types';

export function FinishStep() {
  const { register, watch, setValue } = useFormContext<WizardFormData>();

  const [type, readOnly] = watch(['repository.type', 'repository.readOnly']);

  const isGithub = type === 'github';
  const isGitBased = isGitProvider(type);
  const isPublic = checkPublicAccess();
  const hasImageRenderer = checkImageRenderer();

  // Set sync enabled by default
  useEffect(() => {
    setValue('repository.sync.enabled', true);
  }, [setValue]);

  // Get field configurations for git-based providers
  const gitFields = isGitBased ? getGitProviderFields(type) : null;

  return (
    <Stack direction="column" gap={2}>
      {isGitBased && (
        <Field
          noMargin
          label={t('provisioning.finish-step.label-sync-interval', 'Sync Interval (seconds)')}
          description={t(
            'provisioning.finish-step.description-sync-interval',
            'How often to sync changes from the repository'
          )}
          required
        >
          <Input
            {...register('repository.sync.intervalSeconds', {
              valueAsNumber: true,
              required: t('provisioning.finish-step.error-sync-interval-required', 'Sync interval is required'),
            })}
            type="number"
            // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
            placeholder="60"
          />
        </Field>
      )}

      <Field noMargin>
        <Checkbox
          {...register('repository.readOnly', {
            onChange: (e) => {
              if (e.target.checked) {
                setValue('repository.prWorkflow', false);
              }
            },
          })}
          label={t('provisioning.finish-step.label-read-only', 'Read only')}
          description={t(
            'provisioning.finish-step.description-read-only',
            "Resources can't be modified through Grafana."
          )}
        />
      </Field>

      {gitFields && (
        <Field noMargin>
          <Checkbox
            {...register('repository.prWorkflow')}
            disabled={readOnly}
            label={gitFields.prWorkflowConfig.label}
            description={gitFields.prWorkflowConfig.description}
          />
        </Field>
      )}

      {isGithub && (
        <Field noMargin>
          <Checkbox
            {...register('repository.generateDashboardPreviews')}
            label={t('provisioning.finish-step.label-generate-dashboard-previews', 'Generate Dashboard Previews')}
            description={
              <>
                <Trans i18nKey="provisioning.finish-step.description-generate-dashboard-previews">
                  Create preview links for pull requests
                </Trans>
                {(!isPublic || !hasImageRenderer) && (
                  <>
                    {' '}
                    <Text color="secondary">
                      <Trans i18nKey="provisioning.finish-step.description-preview-requirements">
                        (requires{' '}
                        <TextLink href="https://grafana.com/docs/grafana/latest/setup-grafana/image-rendering/">
                          image rendering
                        </TextLink>{' '}
                        and public access enabled)
                      </Trans>
                    </Text>
                  </>
                )}
              </>
            }
            disabled={!isPublic || !hasImageRenderer}
          />
        </Field>
      )}
    </Stack>
  );
}
