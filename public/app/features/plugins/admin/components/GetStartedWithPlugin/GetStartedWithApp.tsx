import * as React from 'react';

import { PluginMeta } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types/accessControl';

import { updatePluginSettings } from '../../api';
import { usePluginConfig } from '../../hooks/usePluginConfig';
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
  if (!contextSrv.hasPermission(AccessControlAction.PluginsWrite)) {
    return null;
  }

  const { enabled, autoEnabled, jsonData } = pluginConfig?.meta;

  const enable = () => {
    reportInteraction('plugins_detail_enable_clicked', {
      path: window.location.pathname,
      plugin_id: plugin.id,
      creator_team: 'grafana_plugins_catalog',
      schema_version: '1.0.0',
    });
    updatePluginSettingsAndReload(plugin.id, {
      enabled: true,
      pinned: true,
      jsonData,
    });
  };

  const disable = () => {
    reportInteraction('plugins_detail_disable_clicked', {
      path: window.location.pathname,
      plugin_id: plugin.id,
      creator_team: 'grafana_plugins_catalog',
      schema_version: '1.0.0',
    });
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
          <Trans i18nKey="plugins.get-started-with-app.enable">Enable</Trans>
        </Button>
      )}

      {enabled && !autoEnabled && (
        <Button variant="destructive" onClick={disable}>
          <Trans i18nKey="plugins.get-started-with-app.disable">Disable</Trans>
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
