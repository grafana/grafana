import { PanelPlugin, PanelPluginMeta } from '@grafana/data';
import config from 'app/core/config';

import { pluginImporter } from './importer/pluginImporter';

const promiseCache: Record<string, Promise<PanelPlugin>> = {};

export function importPanelPlugin(id: string): Promise<PanelPlugin> {
  const loaded = promiseCache[id];
  if (loaded) {
    return loaded;
  }

  const meta = getPanelPluginMeta(id);

  if (!meta) {
    throw new Error(`Plugin ${id} not found`);
  }

  promiseCache[id] = getPanelPlugin(meta);
  if (id !== meta.type) {
    promiseCache[meta.type] = promiseCache[id];
  }

  return promiseCache[id];
}

export function hasPanelPlugin(id: string): boolean {
  return !!getPanelPluginMeta(id);
}

export function getPanelPluginMeta(id: string): PanelPluginMeta {
  const v = config.panels[id];
  if (!v) {
    // Check alias values before failing
    for (const p of Object.values(config.panels)) {
      if (p.aliasIDs?.includes(id)) {
        return p;
      }
    }
  }
  return v;
}

export function importPanelPluginFromMeta(meta: PanelPluginMeta): Promise<PanelPlugin> {
  return getPanelPlugin(meta);
}

export function syncGetPanelPlugin(id: string): PanelPlugin | undefined {
  return pluginImporter.getPanel(id);
}

function getPanelPlugin(meta: PanelPluginMeta): Promise<PanelPlugin> {
  return pluginImporter.importPanel(meta);
}
