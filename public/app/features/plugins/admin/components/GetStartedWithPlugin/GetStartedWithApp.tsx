import React from 'react';

import { PluginMeta } from '@grafana/data';
import { Button } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';

import { updatePluginSettings } from '../../api';
import { usePluginConfig } from '../../hooks/usePluginConfig';
import { isOrgAdmin } from '../../permissions';
import { CatalogPlugin } from '../../types';

type Props = {
  plugin: CatalogPlugin;
};

export function GetStartedWithApp({ plugin }: Props): React.ReactElement | null {
  const { value: pluginConfig } = usePluginConfig(plugin);

  if (!pluginConfig) {
    return null;
  }

  // Enforce RBAC
  if (!contextSrv.hasAccessInMetadata(AccessControlAction.PluginsWrite, plugin, isOrgAdmin())) {
    return null;
  }

  const { enabled, jsonData } = pluginConfig?.meta;

  const enable = () =>
    updatePluginSettingsAndReload(plugin.id, {
      enabled: true,
      pinned: true,
      jsonData,
    });

  const disable = () => {
    updatePluginSettingsAndReload(plugin.id, {
      enabled: false,
      pinned: false,
      jsonData,
    });
  };

  return (
    <>
      {!enabled && (
        <Button variant="primary" onClick={enable}>
          Enable
        </Button>
      )}

      {enabled && (
        <Button variant="destructive" onClick={disable}>
          Disable
        </Button>
      )}
    </>
  );
}

const updatePluginSettingsAndReload = async (id: string, data: Partial<PluginMeta>) => {
  try {
    await updatePluginSettings(id, data);

    // Reloading the page as the plugin meta changes made here wouldn't be propagated throughout the app.
    window.location.reload();
  } catch (e) {
    console.error('Error while updating the plugin', e);
  }
};
