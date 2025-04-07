import { PanelPlugin, PanelPluginMeta, PluginLoadingStrategy, throwIfAngular } from '@grafana/data';
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
  return panelPluginCache[id];
}

function getPanelPlugin(meta: PanelPluginMeta): Promise<PanelPlugin> {
  throwIfAngular(meta);

  const fallbackLoadingStrategy = meta.loadingStrategy ?? PluginLoadingStrategy.fetch;
  return importPluginModule({
    path: meta.module,
    version: meta.info?.version,
    loadingStrategy: fallbackLoadingStrategy,
    pluginId: meta.id,
    moduleHash: meta.moduleHash,
    translations: meta.translations,
  })
    .then((pluginExports) => {
      if (pluginExports.plugin) {
        return pluginExports.plugin;
      }

      throwIfAngular(pluginExports);
      throw new Error('missing export: plugin');
    })
    .then((plugin: PanelPlugin) => {
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
