import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { HorizontalGroup, Icon, useStyles2, VerticalGroup, Modal, Button } from '@grafana/ui';
import configCore from 'app/core/config';

import { GetStartedWithPlugin } from '../components/GetStartedWithPlugin';
import { InstallControlsButton } from '../components/InstallControls';
import { getLatestCompatibleVersion, isInstallControlsEnabled } from '../helpers';
import { CatalogPlugin, PluginStatus } from '../types';

import { ExternallyManagedButton } from './InstallControls/ExternallyManagedButton';

interface Props {
  plugin?: CatalogPlugin;
}

export const PluginActions = ({ plugin }: Props) => {
  const styles = useStyles2(getStyles);
  const latestCompatibleVersion = getLatestCompatibleVersion(plugin?.details?.versions);
  const [needReload, setNeedReload] = useState(false);
  const [showInstallationInfoModal, setShowInstallationInfoModal] = useState(false);

  if (!plugin) {
    return null;
  }

  const isExternallyManaged = config.pluginAdminExternalManageEnabled;
  const pluginStatus = plugin.isInstalled
    ? plugin.hasUpdate
      ? PluginStatus.UPDATE
      : PluginStatus.UNINSTALL
    : PluginStatus.INSTALL;
  const isInstallControlsDisabled = plugin.isCore || plugin.isDisabled || !isInstallControlsEnabled();
  return (
    <>
      <VerticalGroup>
      <HorizontalGroup>
        {!isInstallControlsDisabled && (
          <>
            {(isExternallyManaged && ! configCore.featureToggles.managedPluginsInstall) ? (
              <ExternallyManagedButton
                pluginId={plugin.id}
                pluginStatus={pluginStatus}
                angularDetected={plugin.angularDetected}
              />
            ) : (
              <InstallControlsButton
                plugin={plugin}
                latestCompatibleVersion={latestCompatibleVersion}
                pluginStatus={pluginStatus}
                setNeedReload={setNeedReload}
                isExternallyManaged={isExternallyManaged}
              />
            )}
          </>
        )}
        <GetStartedWithPlugin plugin={plugin} />
      </HorizontalGroup>
        {needReload && (
          <HorizontalGroup>
            <Icon name="exclamation-triangle" />
            <span className={styles.message}>Refresh the page to see the changes</span>
          </HorizontalGroup>
        )}
      </VerticalGroup>
      {showInstallationInfoModal && (
        <Modal title={'Please acknowledge'} isOpen={true} onDismiss={() => setShowInstallationInfoModal(false)}>
          <div>
            {
              'Please note, that installation can take a while, it can take from 30 sec to 5 minutes to plugin appears in the list.'
            }
          </div>
          <Button variant="primary" onClick={() => setShowInstallationInfoModal(false)}>
            OK
          </Button>
        </Modal>
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    message: css`
      color: ${theme.colors.text.secondary};
    `,
  };
};
