import { useAsync } from 'react-use';

import { loadPlugin } from '../../utils';
import { pluginRequiresRestartForInstall } from '../helpers';
import { CatalogPlugin } from '../types';

export const usePluginConfig = (plugin?: CatalogPlugin) => {
  return useAsync(async () => {
    if (!plugin) {
      return null;
    }

    const isPluginInstalled = pluginRequiresRestartForInstall(plugin) ? plugin.isFullyInstalled : plugin.isInstalled;

    if (isPluginInstalled && !plugin.isDisabled) {
      return loadPlugin(plugin.id);
    }
    return null;
  }, [plugin?.id, plugin?.isInstalled, plugin?.isDisabled]);
};
