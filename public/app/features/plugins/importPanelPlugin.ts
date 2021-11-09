import config from 'app/core/config';
import * as grafanaData from '@grafana/data';
import { getPanelPluginLoadError } from '../panel/components/PanelPluginError';
import { importPluginModule } from './plugin_loader';
interface PanelCache {
  [key: string]: Promise<grafanaData.PanelPlugin>;
}
const panelCache: PanelCache = {};

export function importPanelPlugin(id: string): Promise<grafanaData.PanelPlugin> {
  const loaded = panelCache[id];
  if (loaded) {
    return loaded;
  }

  const meta = config.panels[id];

  if (!meta) {
    throw new Error(`Plugin ${id} not found`);
  }

  panelCache[id] = getPanelPlugin(meta);

  return panelCache[id];
}

export function importPanelPluginFromMeta(meta: grafanaData.PanelPluginMeta): Promise<grafanaData.PanelPlugin> {
  return getPanelPlugin(meta);
}

function getPanelPlugin(meta: grafanaData.PanelPluginMeta): Promise<grafanaData.PanelPlugin> {
  return importPluginModule(meta.module, meta.info?.version)
    .then((pluginExports) => {
      if (pluginExports.plugin) {
        return pluginExports.plugin as grafanaData.PanelPlugin;
      } else if (pluginExports.PanelCtrl) {
        const plugin = new grafanaData.PanelPlugin(null);
        plugin.angularPanelCtrl = pluginExports.PanelCtrl;
        return plugin;
      }
      throw new Error('missing export: plugin or PanelCtrl');
    })
    .then((plugin) => {
      plugin.meta = meta;
      return plugin;
    })
    .catch((err) => {
      // TODO, maybe a different error plugin
      console.warn('Error loading panel plugin: ' + meta.id, err);
      return getPanelPluginLoadError(meta, err);
    });
}
