import useAsync from 'react-use/lib/useAsync';

import { PluginType } from '@grafana/data';

import { getPluginSettings } from '../pluginSettings';
import { importAppPlugin } from '../plugin_loader';

export const useImportAppPlugin = (id: string) => {
  return useAsync(async () => {
    const pluginMeta = await getPluginSettings(id);

    if (!pluginMeta) {
      throw new Error(`Unknown plugin: "${id}"`);
    }

    if (pluginMeta.type !== PluginType.app) {
      throw new Error(`Plugin must be an app (currently "${pluginMeta.type}")`);
    }

    if (!pluginMeta.enabled) {
      throw new Error(`Application "${id}" is not enabled`);
    }

    return await importAppPlugin(pluginMeta);
  });
};
