import { PanelPlugin, PanelPluginMeta } from '@grafana/data';
import config from 'app/core/config';

import { getPanelPluginLoadError } from '../panel/components/PanelPluginError';

import { importPluginModule } from './plugin_loader';

const promiseCache: Record<string, Promise<PanelPlugin>> = {};
const panelPluginCache: Record<string, PanelPlugin> = {};

export function importPanelPlugin(id: string): Promise<PanelPlugin> {
  const loaded = promiseCache[id];
  if (loaded) {
    return loaded;
  }

  const meta = config.panels[id];

  if (!meta) {
    throw new Error(`Plugin ${id} not found`);
  }

  promiseCache[id] = getPanelPlugin(meta);

  return promiseCache[id];
}

export function importPanelPluginFromMeta(meta: PanelPluginMeta): Promise<PanelPlugin> {
  return getPanelPlugin(meta);
}

export function syncGetPanelPlugin(id: string): PanelPlugin | undefined {
  return panelPluginCache[id];
}

function getPanelPlugin(meta: PanelPluginMeta): Promise<PanelPlugin> {
  return importPluginModule(meta.module, meta.info?.version)
    .then((pluginExports) => {
      if (pluginExports.plugin) {
        return pluginExports.plugin as PanelPlugin;
      } else if (pluginExports.PanelCtrl) {
        const plugin = new PanelPlugin(null);
        plugin.angularPanelCtrl = pluginExports.PanelCtrl;
        return plugin;
      }
      throw new Error('missing export: plugin or PanelCtrl');
    })
    .then((plugin) => {
      plugin.meta = meta;
      panelPluginCache[meta.id] = plugin;
      return plugin;
    })
    .catch((err) => {
      // TODO, maybe a different error plugin
      console.warn('Error loading panel plugin: ' + meta.id, err);
      return getPanelPluginLoadError(meta, err);
    });
}
