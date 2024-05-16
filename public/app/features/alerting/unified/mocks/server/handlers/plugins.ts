import { http, HttpResponse } from 'msw';

import { PluginMeta } from '@grafana/data';
import { config } from '@grafana/runtime';
import { plugins } from 'app/features/alerting/unified/testSetup/plugins';

/**
 * Returns a handler that maps from plugin ID to PluginMeta, and additionally sets up necessary
 * config side effects that are expected to come along with this API behaviour
 */
export const getPluginsHandler = (pluginsArray: PluginMeta[] = plugins) => {
  plugins.forEach(({ id, baseUrl, info, angular }) => {
    config.apps[id] = {
      id,
      path: baseUrl,
      preload: true,
      version: info.version,
      angular: angular ?? { detected: false, hideDeprecation: false },
    };
  });

  return http.get<{ pluginId: string }>(`/api/plugins/:pluginId/settings`, ({ params: { pluginId } }) => {
    const matchingPlugin = pluginsArray.find((plugin) => plugin.id === pluginId);
    return matchingPlugin
      ? HttpResponse.json<PluginMeta>(matchingPlugin)
      : HttpResponse.json({ message: 'Plugin not found, no installed plugin with that id' }, { status: 404 });
  });
};

const handlers = [getPluginsHandler()];
export default handlers;
