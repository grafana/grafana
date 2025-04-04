import { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { config } from '@grafana/runtime';
import { Alert, ControlledCollapse, Field } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { checkPublicAccess } from '../GettingStarted/features';
import { GETTING_STARTED_URL } from '../constants';

export interface ConfigFormGithubCollapseProps {
  previews: ReactElement;
}
export function ConfigFormGithubCollapse({ previews }: ConfigFormGithubCollapseProps) {
  const navigate = useNavigate();

  return (
    <ControlledCollapse
      label={t('provisioning.config-form-github-collapse.label-git-hub-features', 'GitHub features')}
      isOpen={true}
    >
      <h3>
        <Trans i18nKey="provisioning.config-form-github-collapse.realtime-feedback">Realtime feedback</Trans>
      </h3>
      {checkPublicAccess() ? (
        <div>
          <Alert
            title={t(
              'provisioning.config-form-github-collapse.title-webhook-will-be-created',
              'Webhook will be created'
            )}
            severity={'info'}
          >
            <Trans i18nKey="provisioning.config-form-github-collapse.text-changes-in-git-quick-pull">
              Changes in git will be quickly pulled into grafana. Pull requests can be processed.
            </Trans>
          </Alert>
        </div>
      ) : (
        <Alert
          title={t(
            'provisioning.config-form-github-collapse.title-public-url-not-configured',
            'Public URL not configured'
          )}
          severity={'warning'}
          buttonContent={<Trans i18nKey="provisioning.config-form-github-collapse.instructions">Instructions</Trans>}
          onRemove={() => navigate(GETTING_STARTED_URL)}
        >
          <Trans i18nKey="provisioning.config-form-github-collapse.text-changes-in-git-eventually-pulled">
            Changes in git will eventually be pulled depending on the synchronization interval. Pull requests will not
            be processed
          </Trans>
        </Alert>
      )}

      <h3>
        <Trans i18nKey="provisioning.config-form-github-collapse.pull-request-image-previews">
          Pull Request image previews
        </Trans>
      </h3>
      {!config.rendererAvailable && (
        <Alert
          title={t(
            'provisioning.config-form-github-collapse.title-image-renderer-not-configured',
            'Image renderer not configured'
          )}
          severity={'warning'}
          buttonContent={<Trans i18nKey="provisioning.config-form-github-collapse.instructions">Instructions</Trans>}
          onRemove={() => window.open('https://grafana.com/grafana/plugins/grafana-image-renderer/', '_blank')}
        >
          <Trans i18nKey="provisioning.config-form-github-collapse.text-when-image-renderer-configured">
            When the image renderer is configured, pull requests can see preview images
          </Trans>
        </Alert>
      )}

      <Field
        label={t(
          'provisioning.config-form-github-collapse.label-attach-dashboard-previews',
          'Attach dashboard previews to pull requests'
        )}
        description={
          <span>
            <Trans i18nKey="provisioning.config-form-github-collapse.description-attach-dashboard-previews">
              Render before/after images and link them to the pull request.
              <br />
              NOTE: This will render dashboards into an image that can be access by a public URL
            </Trans>
          </span>
        }
      >
        {previews}
      </Field>
    </ControlledCollapse>
  );
}
