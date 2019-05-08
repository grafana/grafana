import { getBackendSrv } from 'app/core/services/backend_srv';
import { PluginMeta } from '@grafana/ui';

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
    .then(settings => {
      pluginInfoCache[pluginId] = settings;
      return settings;
    })
    .catch(err => {
      // err.isHandled = true;
      return Promise.reject('Unknown Plugin');
    });
}
