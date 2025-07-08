import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { gt, valid } from 'semver';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { Badge, Button, ConfirmModal, Icon, Spinner, useStyles2 } from '@grafana/ui';

import { isPreinstalledPlugin } from '../helpers';
import { useInstall } from '../state/hooks';
import { PluginStatus, Version } from '../types';

const PLUGINS_VERSION_PAGE_UPGRADE_INTERACTION_EVENT_NAME = 'plugins_upgrade_clicked';
const PLUGINS_VERSION_PAGE_CHANGE_INTERACTION_EVENT_NAME = 'plugins_downgrade_clicked';
interface Props {
  pluginId: string;
  version: Version;
  latestCompatibleVersion?: string;
  installedVersion?: string;
  disabled: boolean;
  tooltip?: string;
  onConfirmInstallation: () => void;
}

export const VersionInstallButton = ({
  pluginId,
  version,
  latestCompatibleVersion,
  installedVersion,
  disabled,
  tooltip,
  onConfirmInstallation,
}: Props) => {
  const install = useInstall();
  const [isInstalling, setIsInstalling] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const styles = useStyles2(getStyles);

  const installState = getInstallState(installedVersion, version.version);

  useEffect(() => {
    if (installedVersion === version.version) {
      setIsInstalling(false);
      setIsModalOpen(false);
    }
  }, [installedVersion, version.version]);

  if (version.version === installedVersion) {
    return (
      <Badge
        className={styles.badge}
        text={t('plugins.version-install-button.text-installed', 'Installed')}
        icon="check"
        color="green"
      />
    );
  }

  const performInstallation = () => {
    const trackProps = {
      path: window.location.pathname,
      plugin_id: pluginId,
      version: version.version,
      is_latest: latestCompatibleVersion === version.version,
      creator_team: 'grafana_plugins_catalog',
      schema_version: '1.0.0',
    };

    if (installState === PluginStatus.UPDATE) {
      reportInteraction(PLUGINS_VERSION_PAGE_UPGRADE_INTERACTION_EVENT_NAME, trackProps);
    } else {
      reportInteraction(PLUGINS_VERSION_PAGE_CHANGE_INTERACTION_EVENT_NAME, {
        ...trackProps,
        previous_version: installedVersion,
      });
    }

    install(pluginId, version.version, installState);
    setIsInstalling(true);
    onConfirmInstallation();
  };

  const onInstallClick = () => {
    if (installState === PluginStatus.DOWNGRADE) {
      setIsModalOpen(true);
    } else {
      performInstallation();
    }
  };

  const onConfirm = () => {
    performInstallation();
  };

  const onDismiss = () => {
    setIsModalOpen(false);
  };

  const isPreinstalled = isPreinstalledPlugin(pluginId);

  const hidden = getButtonHiddenState(installState, isPreinstalled);

  return (
    <>
      <Button
        fill="solid"
        disabled={disabled || isInstalling}
        fullWidth
        size="sm"
        variant={latestCompatibleVersion === version.version ? 'primary' : 'secondary'}
        onClick={onInstallClick}
        className={styles.button}
        hidden={hidden}
        tooltip={tooltip}
        tooltipPlacement="bottom-start"
      >
        {getLabel(installState)}{' '}
        {isInstalling ? <Spinner className={styles.spinner} inline size="sm" /> : getIcon(installState)}
      </Button>
      <ConfirmModal
        isOpen={isModalOpen}
        title={t('plugins.catalog.versions.downgrade-title', 'Downgrade plugin version')}
        body={t(
          'plugins.catalog.versions.confirmation-text',
          'Are you really sure you want to downgrade to version {{version}}? You should normally not be doing this',
          { version: version.version }
        )}
        confirmText={t('plugins.catalog.versions.downgrade-confirm', 'Downgrade')}
        onConfirm={onConfirm}
        onDismiss={onDismiss}
        disabled={isInstalling}
        confirmButtonVariant="primary"
      />
    </>
  );
};

function getLabel(installState: PluginStatus) {
  switch (installState) {
    case PluginStatus.INSTALL:
      return 'Install';
    case PluginStatus.UPDATE:
      return 'Upgrade';
    case PluginStatus.DOWNGRADE:
      return 'Downgrade';
    default:
      return '';
  }
}

function getIcon(installState: PluginStatus) {
  if (installState === PluginStatus.DOWNGRADE) {
    return <Icon name="arrow-down" />;
  }
  if (installState === PluginStatus.UPDATE) {
    return <Icon name="arrow-up" />;
  }
  return '';
}

function getInstallState(installedVersion?: string, version?: string): PluginStatus {
  if (!installedVersion || !version || !valid(installedVersion) || !valid(version)) {
    return PluginStatus.INSTALL;
  }
  return gt(installedVersion, version) ? PluginStatus.DOWNGRADE : PluginStatus.UPDATE;
}

function getButtonHiddenState(installState: PluginStatus, isPreinstalled: { found: boolean; withVersion: boolean }) {
  // Default state for initial install
  if (installState === PluginStatus.INSTALL) {
    return false;
  }

  // Handle downgrade case
  if (installState === PluginStatus.DOWNGRADE) {
    return isPreinstalled.found && Boolean(config.featureToggles.preinstallAutoUpdate);
  }

  // Handle upgrade case
  return isPreinstalled.withVersion;
}

const getStyles = (theme: GrafanaTheme2) => ({
  spinner: css({
    marginLeft: theme.spacing(1),
  }),
  successIcon: css({
    color: theme.colors.success.main,
  }),
  button: css({
    width: theme.spacing(13),
  }),
  badge: css({
    width: theme.spacing(13),
    justifyContent: 'center',
  }),
});
