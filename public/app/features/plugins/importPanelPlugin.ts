import { PanelPlugin } from '@grafana/data';
import { getPanelPluginMeta } from '@grafana/runtime/internal';

import { pluginImporter } from './importer/pluginImporter';

const promiseCache: Record<string, Promise<PanelPlugin>> = {};

export async function importPanelPlugin(id: string): Promise<PanelPlugin> {
  const loaded = promiseCache[id];
  if (loaded) {
    return loaded;
  }

  // we need to make sure this continues to handle concurrent calls
  promiseCache[id] = getPanelPluginMeta(id)
    .then((meta) => {
      if (!meta) {
        throw new Error(`Plugin ${id} not found`);
      }

      const promise = pluginImporter.importPanel(meta);
      if (id !== meta.type) {
        promiseCache[meta.type] = promise;
      }

      return promise;
    })
    .catch((error) => {
      // clear cache on error
      delete promiseCache[id];
      throw error;
    });

  return promiseCache[id];
}

export function syncGetPanelPlugin(id: string): PanelPlugin | undefined {
  return pluginImporter.getPanel(id);
}

export function clearPanelPluginCache(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('clearPanelPluginCache() function can only be called from tests.');
  }

  for (const key of Object.keys(promiseCache)) {
    delete promiseCache[key];
  }
}
