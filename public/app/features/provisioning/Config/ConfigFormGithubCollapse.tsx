import { UseFormRegister } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Checkbox, ControlledCollapse, Field, Text, TextLink } from '@grafana/ui';

import { checkImageRenderer, checkPublicAccess } from '../GettingStarted/features';
import { GETTING_STARTED_URL } from '../constants';
import { RepositoryFormData } from '../types';

export interface ConfigFormGithubCollapseProps {
  register: UseFormRegister<RepositoryFormData>;
}

export function ConfigFormGithubCollapse({ register }: ConfigFormGithubCollapseProps) {
  const isPublic = checkPublicAccess();
  const hasImageRenderer = checkImageRenderer();

  return (
    <ControlledCollapse
      label={t('provisioning.config-form-github-collapse.label-git-hub-features', 'GitHub features')}
      isOpen={true}
    >
      <Field>
        <Checkbox
          disabled={!hasImageRenderer || !isPublic}
          label={t('provisioning.finish-step.label-enable-previews', 'Enable dashboard previews in pull requests')}
          description={
            <>
              <Trans i18nKey="provisioning.finish-step.description-enable-previews">
                Adds an image preview of dashboard changes in pull requests. Images of your Grafana dashboards will be
                shared in your Git repository and visible to anyone with repository access.
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

      {!isPublic && (
        <Field label={t('provisioning.config-form-github-collapse.label-realtime-feedback', 'Realtime feedback')}>
          <Text variant="bodySmall" color={'secondary'}>
            <Trans i18nKey={'provisioning.config-form-github-collapse.description-realtime-feedback'}>
              <TextLink variant={'bodySmall'} href={GETTING_STARTED_URL}>
                Configure webhooks
              </TextLink>{' '}
              to get instant updates in Grafana as soon as changes are committed. Review and approve changes using pull
              requests before they go live.
            </Trans>
          </Text>
        </Field>
      )}
    </ControlledCollapse>
  );
}
