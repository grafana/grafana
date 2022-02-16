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

async function getPanelPlugin(meta: grafanaData.PanelPluginMeta): Promise<grafanaData.PanelPlugin> {
  try {
    const pluginExports = await importPluginModule(meta.module, meta.info?.version);
    let plugin = pluginExports.plugin;

    if (!plugin && pluginExports.PanelCtrl) {
      plugin = new grafanaData.PanelPlugin(null);
      plugin.angularPanelCtrl = pluginExports.PanelCtrl;
    }

    plugin.meta = meta;

    return plugin;
  } catch (err) {
    // TODO, maybe a different error plugin
    console.warn('Error loading panel plugin: ' + meta.id, err);
    return getPanelPluginLoadError(meta, err);
  }
}
