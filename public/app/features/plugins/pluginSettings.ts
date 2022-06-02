import { PluginMeta } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';

type PluginCache = {
  [key: string]: PluginMeta;
};

const pluginInfoCache: PluginCache = {};

export function getPluginSettings(pluginId: string): Promise<PluginMeta> {
  const v = pluginInfoCache[pluginId];
  if (v) {
    return Promise.resolve(v);
  }
  return getBackendSrv()
    .get(`/api/plugins/${pluginId}/settings`)
    .then((settings: any) => {
      pluginInfoCache[pluginId] = settings;
      return settings;
    })
    .catch((err: any) => {
      return Promise.reject(new Error('Unknown Plugin'));
    });
}

export const clearPluginSettingsCache = (pluginId?: string) => {
  if (pluginId) {
    return delete pluginInfoCache[pluginId];
  }
  // clear all
  return Object.keys(pluginInfoCache).forEach((key) => delete pluginInfoCache[key]);
};
