import React from 'react';
import { AppEvents } from '@grafana/data';
import { Button, HorizontalGroup, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { api } from '../../api';
import { ActionTypes, CatalogPlugin } from '../../types';
import { getStyles } from '../InstallControls';

type InstallControlsButtonProps = {
  disabled: boolean;
  hasInstalledPanel: boolean;
  dispatch: React.Dispatch<any>;
  plugin: CatalogPlugin;
  pluginStatus: 'install' | 'update' | 'uninstall';
};

export function InstallControlsButton({
  disabled,
  dispatch,
  plugin,
  pluginStatus,
  hasInstalledPanel,
}: InstallControlsButtonProps) {
  const uninstallBtnText = disabled ? 'Uninstalling' : 'Uninstall';
  const updateBtnText = disabled ? 'Updating' : 'Update';
  const installBtnText = disabled ? 'Installing' : 'Install';
  const styles = useStyles2(getStyles);

  const onInstall = async () => {
    dispatch({ type: ActionTypes.INFLIGHT });
    try {
      await api.installPlugin(plugin.id, plugin.version);
      appEvents.emit(AppEvents.alertSuccess, [`Installed ${plugin.name}`]);
      dispatch({ type: ActionTypes.INSTALLED, payload: plugin.type === 'panel' });
    } catch (error) {
      dispatch({ type: ActionTypes.ERROR, payload: { error } });
    }
  };

  const onUninstall = async () => {
    dispatch({ type: ActionTypes.INFLIGHT });
    try {
      await api.uninstallPlugin(plugin.id);
      appEvents.emit(AppEvents.alertSuccess, [`Uninstalled ${plugin.name}`]);
      dispatch({ type: ActionTypes.UNINSTALLED });
    } catch (error) {
      dispatch({ type: ActionTypes.ERROR, payload: error });
    }
  };

  const onUpdate = async () => {
    dispatch({ type: ActionTypes.INFLIGHT });
    try {
      await api.installPlugin(plugin.id, plugin.version);
      appEvents.emit(AppEvents.alertSuccess, [`Updated ${plugin.name}`]);
      dispatch({ type: ActionTypes.UPDATED });
    } catch (error) {
      dispatch({ type: ActionTypes.ERROR, payload: error });
    }
  };

  if (pluginStatus === 'uninstall') {
    return (
      <HorizontalGroup height="auto">
        <Button variant="destructive" disabled={disabled} onClick={onUninstall}>
          {uninstallBtnText}
        </Button>
        {hasInstalledPanel && (
          <div className={styles.message}>Please refresh your browser window before using this plugin.</div>
        )}
      </HorizontalGroup>
    );
  }

  if (pluginStatus === 'update') {
    return (
      <HorizontalGroup height="auto">
        <Button disabled={disabled} onClick={onUpdate}>
          {updateBtnText}
        </Button>
        <Button variant="destructive" disabled={disabled} onClick={onUninstall}>
          {uninstallBtnText}
        </Button>
      </HorizontalGroup>
    );
  }

  return (
    <Button disabled={disabled} onClick={onInstall}>
      {installBtnText}
    </Button>
  );
}
