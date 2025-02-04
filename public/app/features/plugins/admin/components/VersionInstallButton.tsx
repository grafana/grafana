import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { gt } from 'semver';

import { GrafanaTheme2 } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { Badge, Button, ConfirmModal, Icon, Spinner, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { isPreinstalledPlugin } from '../helpers';
import { useInstall } from '../state/hooks';
import { Version } from '../types';

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

  const isDowngrade = installedVersion && gt(installedVersion, version.version);

  useEffect(() => {
    if (installedVersion === version.version) {
      setIsInstalling(false);
      setIsModalOpen(false);
    }
  }, [installedVersion, version.version]);

  if (version.version === installedVersion) {
    return <Badge className={styles.badge} text="Installed" icon="check" color="green" />;
  }

  const performInstallation = () => {
    const trackProps = {
      path: location.pathname,
      plugin_id: pluginId,
      version: version.version,
      is_latest: latestCompatibleVersion === version.version,
      creator_team: 'grafana_plugins_catalog',
      schema_version: '1.0.0',
    };

    if (!installedVersion || gt(version.version, installedVersion)) {
      reportInteraction(PLUGINS_VERSION_PAGE_UPGRADE_INTERACTION_EVENT_NAME, trackProps);
    } else {
      reportInteraction(PLUGINS_VERSION_PAGE_CHANGE_INTERACTION_EVENT_NAME, {
        ...trackProps,
        previous_version: installedVersion,
      });
    }

    install(pluginId, version.version, true);
    setIsInstalling(true);
    onConfirmInstallation();
  };

  const onInstallClick = () => {
    if (isDowngrade) {
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

  let label = 'Downgrade';
  let hidden = false;
  const isPreinstalled = isPreinstalledPlugin(pluginId);

  if (!installedVersion) {
    label = 'Install';
  } else if (gt(version.version, installedVersion)) {
    label = 'Upgrade';
    if (isPreinstalled.withVersion) {
      // Hide button if the plugin is preinstalled with a specific version
      hidden = true;
    }
  } else {
    if (isPreinstalled.found && Boolean(config.featureToggles.preinstallAutoUpdate)) {
      // Hide the downgrade button if the plugin is preinstalled since it will be auto-updated
      hidden = true;
    }
  }

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
        {label} {isInstalling ? <Spinner className={styles.spinner} inline size="sm" /> : getIcon(label)}
      </Button>
      <ConfirmModal
        isOpen={isModalOpen}
        title={t('plugins.catalog.versions.downgrade-title', 'Downgrade plugin version')}
        body={`${t('plugins.catalog.versions.confirmation-text-1', 'Are you really sure you want to downgrade to version')} ${version.version}? ${t('plugins.catalog.versions.confirmation-text-2', 'You should normally not be doing this')}`}
        confirmText={t('plugins.catalog.versions.downgrade-confirm', 'Downgrade')}
        onConfirm={onConfirm}
        onDismiss={onDismiss}
        disabled={isInstalling}
        confirmButtonVariant="primary"
      />
    </>
  );
};

function getIcon(label: string) {
  if (label === 'Downgrade') {
    return <Icon name="arrow-down" />;
  }
  if (label === 'Upgrade') {
    return <Icon name="arrow-up" />;
  }
  return '';
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
