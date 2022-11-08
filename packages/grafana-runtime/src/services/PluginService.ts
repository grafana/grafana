import { PluginMeta } from '@grafana/data';

import { SupportedPlugin } from '../components/PluginBridge';

import { BackendSrvRequest, getBackendSrv } from './backendSrv';

type PluginId = SupportedPlugin | string;

const pluginCache = new Map<string, PluginMeta>();

export function getPluginSettings(pluginId: PluginId, options?: Partial<BackendSrvRequest>): Promise<PluginMeta> {
  const pluginMetadata = pluginCache.get(pluginId);

  if (pluginMetadata) {
    return Promise.resolve(pluginMetadata);
  }

  return (
    getBackendSrv()
      .get(`/api/plugins/${pluginId}/settings`, undefined, undefined, options)
      .then((settings: PluginMeta) => {
        pluginCache.set(pluginId, settings);
        return settings;
      })
      // TODO this error handling could be better
      .catch((err: unknown) => {
        return Promise.reject(new Error('Unknown Plugin'));
      })
  );
}
