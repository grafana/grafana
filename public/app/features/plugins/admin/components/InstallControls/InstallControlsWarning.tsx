import { css } from '@emotion/css';

import { GrafanaTheme2, PluginType } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { Trans, t } from '@grafana/i18n';
import { config, featureEnabled } from '@grafana/runtime';
import { LinkButton, useStyles2, Alert, TextLink, Stack } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types/accessControl';

import { getExternalManageLink } from '../../helpers';
import { useIsRemotePluginsAvailable } from '../../state/hooks';
import { CatalogPlugin, PluginStatus, Version } from '../../types';

interface Props {
  plugin: CatalogPlugin;
  pluginStatus: PluginStatus;
  latestCompatibleVersion?: Version;
}

export const InstallControlsWarning = ({ plugin, pluginStatus, latestCompatibleVersion }: Props) => {
  const styles = useStyles2(getStyles);
  const isExternallyManaged = config.pluginAdminExternalManageEnabled;
  const hasPermission = contextSrv.hasPermission(AccessControlAction.PluginsInstall);
  const isRemotePluginsAvailable = useIsRemotePluginsAvailable();

  const isCompatible = Boolean(latestCompatibleVersion);

  if (plugin.type === PluginType.renderer) {
    return (
      <Alert
        severity="warning"
        title={t(
          'plugins.install-controls-warning.title-renderer-plugins-cannot-managed-plugin-catalog',
          'Renderer plugins cannot be managed by the Plugin Catalog.'
        )}
        className={styles.alert}
      />
    );
  }

  const isOpenSource = config.buildInfo.edition === GrafanaEdition.OpenSource;
  const isEnterprise = config.buildInfo.edition === GrafanaEdition.Enterprise;

  if (plugin.isEnterprise && !featureEnabled('enterprise.plugins')) {
    const severity = isOpenSource ? 'info' : 'warning';

    return (
      <Alert severity={severity} title="" className={styles.alert}>
        <Stack direction="row" alignItems="center">
          <span>
            {isOpenSource && (
              <Trans i18nKey="plugins.install-controls-warning.enterprise-plugin-info">
                This plugin is only available in Grafana Cloud and Grafana Enterprise.
              </Trans>
            )}
            {isEnterprise && (
              <Trans i18nKey="plugins.install-controls-warning.no-valid-grafana-enterprise-license-detected">
                No valid Grafana Enterprise license detected.
              </Trans>
            )}
          </span>
          <LinkButton
            href={`${getExternalManageLink(plugin.id)}?utm_source=grafana_catalog_learn_more`}
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
            fill="text"
            icon="external-link-alt"
          >
            <Trans i18nKey="plugins.install-controls-warning.learn-more">Learn more</Trans>
          </LinkButton>
        </Stack>
      </Alert>
    );
  }

  if (plugin.isDev) {
    return (
      <Alert
        severity="warning"
        title={t(
          'plugins.install-controls-warning.title-dev-alert',
          "This is a development build of the plugin and can't be uninstalled."
        )}
        className={styles.alert}
      />
    );
  }

  if (!hasPermission && !isExternallyManaged) {
    return <Alert severity="warning" title={statusToMessage(pluginStatus)} className={styles.alert} />;
  }

  if (!plugin.isPublished) {
    return (
      <Alert severity="warning" title="" className={styles.alert}>
        <div>
          <Trans i18nKey="plugins.install-controls-warning.body-not-published">
            This plugin is not published to{' '}
            <TextLink href="https://www.grafana.com/plugins" external>
              grafana.com/plugins
            </TextLink>{' '}
            and can't be managed via the catalog.
          </Trans>
        </div>
      </Alert>
    );
  }

  if (!isCompatible) {
    return (
      <Alert
        severity="warning"
        title={t(
          'plugins.install-controls-warning.title-plugin-doesnt-support-version-grafana',
          "This plugin doesn't support your version of Grafana."
        )}
        className={styles.alert}
      />
    );
  }

  if (!isRemotePluginsAvailable) {
    return (
      <Alert
        severity="warning"
        title={t(
          'plugins.install-controls-warning.title-remote-plugins-unavailable',
          'The install controls have been disabled because the Grafana server cannot access grafana.com.'
        )}
        className={styles.alert}
      />
    );
  }

  return null;
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    alert: css({
      marginTop: `${theme.spacing(2)}`,
    }),
  };
};

function statusToMessage(status: PluginStatus): string {
  switch (status) {
    case PluginStatus.INSTALL:
    case PluginStatus.REINSTALL:
      return `You do not have permission to install this plugin.`;
    case PluginStatus.UNINSTALL:
      return `You do not have permission to uninstall this plugin.`;
    case PluginStatus.UPDATE:
      return `You do not have permission to update this plugin.`;
    default:
      return `You do not have permission to manage this plugin.`;
  }
}
