import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';

import { Checkbox, Field, Input, Stack, Text, TextLink } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { checkPublicAccess, checkImageRenderer } from '../GettingStarted/features';

import { WizardFormData } from './types';

export function FinishStep() {
  const { register, watch, setValue } = useFormContext<WizardFormData>();

  const [type, readOnly] = watch(['repository.type', 'repository.readOnly']);
  const isGithub = type === 'github';
  const isPublic = checkPublicAccess();
  const hasImageRenderer = checkImageRenderer();

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

      <Field>
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

      {isGithub && (
        <>
          <Field>
            <Checkbox
              {...register('repository.prWorkflow')}
              disabled={readOnly}
              label={t('provisioning.finish-step.label-pr-workflow', 'Enable pull request option when saving')}
              description={
                <Trans i18nKey="provisioning.finish-step.description-pr-enable-description">
                  Allows users to choose whether to open a pull request when saving changes. If the repository does not
                  allow direct changes to the main branch, a pull request may still be required.
                </Trans>
              }
            />
          </Field>

          <Stack direction="column" gap={2}>
            <Stack direction="column" gap={0}>
              <Text element="h4">
                <Trans i18nKey="provisioning.finish-step.title-enhance-github">Enhance your GitHub experience</Trans>
              </Text>
              <Text color="secondary" variant="bodySmall">
                <Trans i18nKey="provisioning.finish-step.text-setup-later">You can always set this up later</Trans>
              </Text>
            </Stack>
            <Field>
              <Checkbox
                disabled={!hasImageRenderer || !isPublic}
                label={t(
                  'provisioning.finish-step.label-enable-previews',
                  'Enable dashboard previews in pull requests'
                )}
                description={
                  <>
                    <Trans i18nKey="provisioning.finish-step.description-enable-previews">
                      Adds an image preview of dashboard changes in pull requests. Images of your Grafana dashboards
                      will be shared in your Git repository and visible to anyone with repository access.
                    </Trans>{' '}
                    <Text italic>
                      <Trans i18nKey="provisioning.finish-step.description-image-rendering">
                        Requires image rendering.{' '}
                        <TextLink
                          variant="bodySmall"
                          external
                          href="https://grafana.com/grafana/plugins/grafana-image-renderer"
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
          </Stack>
        </>
      )}
    </Stack>
  );
}
