import { type UseFormRegister } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Checkbox, ControlledCollapse, Field, Input, Stack, Text, TextLink } from '@grafana/ui';
import { useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { checkImageRenderer, checkPublicAccess, checkImageRenderingAllowed } from '../GettingStarted/features';
import { GETTING_STARTED_URL } from '../constants';
import { type RepositoryFormData } from '../types';

export interface ConfigFormGithubCollapseProps {
  register: UseFormRegister<RepositoryFormData>;
}

export function ConfigFormGithubCollapse({ register }: ConfigFormGithubCollapseProps) {
  const settings = useGetFrontendSettingsQuery();
  const isPublic = checkPublicAccess();
  const hasImageRenderer = checkImageRenderer();
  const imageRenderingAllowed = checkImageRenderingAllowed(settings.data);

  if (!imageRenderingAllowed && isPublic) {
    // don't display the whole collapse if neither feature is applicable
    return null;
  }

  return (
    <ControlledCollapse
      label={t('provisioning.config-form-github-collapse.label-git-hub-features', 'GitHub features')}
      isOpen={true}
    >
      <Stack direction="column" gap={2}>
        {imageRenderingAllowed && (
          <Field noMargin>
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
                        href="https://grafana.com/grafana/plugins/grafana-image-renderer"
                      >
                        Set up image rendering
                      </TextLink>
                    </Trans>
                  </Text>
                </>
              }
              {...register('generateDashboardPreviews')}
            />
          </Field>
        )}

        <Field
          noMargin
          label={t('provisioning.config-form-github-collapse.label-webhook-url', 'Webhook URL')}
          description={
            <>
              <Trans i18nKey="provisioning.config-form-github-collapse.description-webhook-url">
                Overrides the auto-detected URL for registering webhooks.
              </Trans>
              {!isPublic && (
                <>
                  {' '}
                  <TextLink variant="bodySmall" href={GETTING_STARTED_URL}>
                    <Trans i18nKey="provisioning.config-form-github-collapse.description-webhook-url-learn-more">
                      Learn more
                    </Trans>
                  </TextLink>
                </>
              )}
            </>
          }
        >
          <Input
            {...register('webhook.baseUrl')}
            placeholder={t(
              'provisioning.config-form-github-collapse.placeholder-webhook-url',
              'https://grafana.example.com'
            )}
          />
        </Field>
      </Stack>
    </ControlledCollapse>
  );
}
