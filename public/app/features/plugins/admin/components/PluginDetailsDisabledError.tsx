import { ReactElement } from 'react';

import { PluginErrorCode } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Alert, Stack } from '@grafana/ui';

import { getLatestCompatibleVersion, isDisabledAngularPlugin, isNonAngularVersion } from '../helpers';
import { CatalogPlugin } from '../types';

type Props = {
  className?: string;
  plugin: CatalogPlugin;
};

export function PluginDetailsDisabledError({ className, plugin }: Props): ReactElement | null {
  if (!plugin.isDisabled) {
    return null;
  }

  const title = t('plugins.details.disabled-error.title', 'Plugin disabled');
  const isLatestCompatibleNotAngular = isNonAngularVersion(getLatestCompatibleVersion(plugin?.details?.versions));

  return (
    <Alert severity="error" title={title} className={className} data-testid={selectors.pages.PluginPage.disabledInfo}>
      {renderDescriptionFromError(plugin.error, plugin.id, isLatestCompatibleNotAngular)}
      {!isDisabledAngularPlugin(plugin) && (
        <p>
          <Trans i18nKey="plugins.details.disabled-error.contact-server-admin">
            Please contact your server administrator to get this resolved.
          </Trans>
        </p>
      )}
      <Stack direction="column" gap={1}>
        <a
          href="https://grafana.com/docs/grafana/latest/administration/cli/#plugins-commands"
          className="external-link"
          target="_blank"
          rel="noreferrer"
        >
          <Trans i18nKey="plugins.details.disabled-error.manage-plugins-link">Read more about managing plugins</Trans>
        </a>
        {plugin.error === PluginErrorCode.angular && (
          <a
            href="https://grafana.com/docs/grafana/latest/developers/angular_deprecation/"
            className="external-link"
            target="_blank"
            rel="noreferrer"
          >
            <Trans i18nKey="plugins.details.disabled-error.angular-deprecation-link">
              Read more about angular deprecation
            </Trans>
          </a>
        )}
      </Stack>
    </Alert>
  );
}

function renderDescriptionFromError(
  error?: PluginErrorCode,
  id?: string,
  isLatestCompatibleNotAngular?: boolean
): ReactElement {
  switch (error) {
    case PluginErrorCode.modifiedSignature:
      return (
        <p>
          <Trans i18nKey="plugins.details.disabled-error.modified-signature-text">
            Grafana Labs checks each plugin to verify that it has a valid digital signature. While doing this, we
            discovered that the content of this plugin does not match its signature. We can not guarantee the
            trustworthy of this plugin and have therefore disabled it. We recommend you to reinstall the plugin to make
            sure you are running a verified version of this plugin.
          </Trans>
        </p>
      );
    case PluginErrorCode.invalidSignature:
      return (
        <p>
          <Trans i18nKey="plugins.details.disabled-error.invalid-signature-text">
            Grafana Labs checks each plugin to verify that it has a valid digital signature. While doing this, we
            discovered that it was invalid. We can not guarantee the trustworthy of this plugin and have therefore
            disabled it. We recommend you to reinstall the plugin to make sure you are running a verified version of
            this plugin.
          </Trans>
        </p>
      );
    case PluginErrorCode.missingSignature:
      return (
        <p>
          <Trans i18nKey="plugins.details.disabled-error.missing-signature-text">
            Grafana Labs checks each plugin to verify that it has a valid digital signature. While doing this, we
            discovered that there is no signature for this plugin. We can not guarantee the trustworthy of this plugin
            and have therefore disabled it. We recommend you to reinstall the plugin to make sure you are running a
            verified version of this plugin.
          </Trans>
        </p>
      );
    case PluginErrorCode.failedBackendStart:
      return (
        <p>
          <Trans i18nKey="plugins.details.disabled-error.failed-backend-start-text">
            This plugin failed to start. Server logs can provide more information.
          </Trans>
        </p>
      );
    case PluginErrorCode.angular:
      if (isLatestCompatibleNotAngular) {
        return (
          <p>
            <Trans i18nKey="plugins.details.disabled-error.angular-error-text">
              This plugin has been disabled as Grafana no longer supports Angular based plugins. You can try updating
              the plugin to the latest version to resolve this issue. You should then test to confirm it works as
              expected.
            </Trans>
          </p>
        );
      }

      return (
        <p>
          <Trans i18nKey="plugins.details.disabled-error.angular-error-text-no-non-angular-version">
            This plugin has been disabled as Grafana no longer supports Angular based plugins. Unfortunately, the latest
            version of this plugin still uses Angular so you need to wait for the plugin author to migrate to continue
            using this plugin.
          </Trans>
        </p>
      );

    default:
      return (
        <p>
          <Trans i18nKey="plugins.details.disabled-error.unknown-error-text">
            We failed to run this plugin due to an unkown reason and have therefore disabled it. We recommend you to
            reinstall the plugin to make sure you are running a working version of this plugin.
          </Trans>
        </p>
      );
  }
}
