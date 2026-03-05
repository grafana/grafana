import { useAsync } from 'react-use';

import { config } from '@grafana/runtime';

import { loadPlugin } from '../../utils';
import { CatalogPlugin } from '../types';

export const usePluginConfig = (plugin?: CatalogPlugin) => {
  return useAsync(async () => {
    if (!plugin) {
      return null;
    }

    // When pluginAdminExternalManageEnabled is true, only check isFullyInstalled to avoid loading a plugin that was requested for
    // install but isn't locally available yet (external installs are async).
    const isPluginInstalled = config.pluginAdminExternalManageEnabled ? plugin.isFullyInstalled : plugin.isInstalled;

    if (isPluginInstalled && !plugin.isDisabled) {
      return loadPlugin(plugin.id);
    }
    return null;
  }, [plugin?.id, plugin?.isInstalled, plugin?.isDisabled, plugin?.isFullyInstalled]);
};
