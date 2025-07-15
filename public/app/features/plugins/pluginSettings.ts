import { PluginMeta } from '@grafana/data';
import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';

type PluginCache = {
  [key: string]: PluginMeta;
};

const pluginInfoCache: PluginCache = {};

export function getPluginSettings(pluginId: string, options?: Partial<BackendSrvRequest>): Promise<PluginMeta> {
  const v = pluginInfoCache[pluginId];
  if (v) {
    return Promise.resolve(v);
  }
  return getBackendSrv()
    .get(`/api/plugins/${pluginId}/settings`, undefined, undefined, { ...options, validatePath: true })
    .then((settings) => {
      pluginInfoCache[pluginId] = settings;
      return settings;
    })
    .catch((e) => {
      // User does not have access to plugin
      if (typeof e === 'object' && e !== null && 'status' in e && e.status === 403) {
        e.isHandled = true;
        return Promise.reject(e);
      }

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
