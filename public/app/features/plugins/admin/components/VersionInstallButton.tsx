import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { gt } from 'semver';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, ConfirmModal, Spinner, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { useInstall } from '../state/hooks';
import { Version } from '../types';

interface Props {
  pluginId: string;
  version: Version;
  latestCompatibleVersion?: string;
  installedVersion?: string;
  disabled: boolean;
  onClick: () => void;
}

export const VersionInstallButton = ({ pluginId, version, latestCompatibleVersion, installedVersion, disabled, onClick }: Props) => {
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

  const performInstallation = () => {
    install(pluginId, version.version, true);
    setIsInstalling(true);
    onClick();
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
  let isInstalled = false;

  if (!installedVersion) {
    label = 'Install';
  } else if (gt(version.version, installedVersion)) {
    label = 'Upgrade';
  } else if (version.version === installedVersion) {
    label = 'Installed';
    isInstalled = true;
  }

  return (
    <>
      <Button
        fill="text"
        disabled={disabled || isInstalled}
        fullWidth
        size="sm"
        variant={latestCompatibleVersion === version.version ? 'primary' : 'secondary'}
        onClick={onInstallClick}
      >
        {label} {isInstalling && <Spinner className={styles.spinner} inline size="sm" />}
      </Button>
      <ConfirmModal
        isOpen={isModalOpen}
        title={t('plugins.catalog.versions.downgrade-title', 'Downgrade plugin version')}
        body={`${t('plugins.catalog.versions.confirmation-text-1', 'Are you really sure you want to downgrade to version')} ${version.version}? ${t('plugins.catalog.versions.confirmation-text-2', 'You should normally not be doing this')}`}
        confirmText={t('plugins.catalog.versions.downgrade-confirm', 'Downgrade')}
        onConfirm={onConfirm}
        onDismiss={onDismiss}
        disabled={isInstalling}
        confirmButtonVariant='primary'
      />
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  spinner: css({
    marginLeft: theme.spacing(1),
  }),
  successIcon: css({
    color: theme.colors.success.main,
  }),
});
