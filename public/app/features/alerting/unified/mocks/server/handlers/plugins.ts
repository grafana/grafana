import { HttpResponse, http } from 'msw';

import { PluginLoadingStrategy, PluginMeta } from '@grafana/data';
import { config } from '@grafana/runtime';
import { plugins } from 'app/features/alerting/unified/testSetup/plugins';

const PLUGIN_NOT_FOUND_RESPONSE = { message: 'Plugin not found, no installed plugin with that id' };

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
      loadingStrategy: PluginLoadingStrategy.script,
      extensions: {
        addedLinks: [],
        addedComponents: [],
        extensionPoints: [],
        exposedComponents: [],
        addedFunctions: [],
      },
      dependencies: {
        grafanaVersion: '',
        plugins: [],
        extensions: {
          exposedComponents: [],
        },
      },
    };
  });

  return http.get<{ pluginId: string }>(`/api/plugins/:pluginId/settings`, ({ params: { pluginId } }) => {
    const matchingPlugin = pluginsArray.find((plugin) => plugin.id === pluginId);
    return matchingPlugin
      ? HttpResponse.json<PluginMeta>(matchingPlugin)
      : HttpResponse.json(PLUGIN_NOT_FOUND_RESPONSE, { status: 404 });
  });
};

export const getDisabledPluginHandler = (pluginIdToDisable: string) => {
  return http.get<{ pluginId: string }>(`/api/plugins/${pluginIdToDisable}/settings`, ({ params: { pluginId } }) => {
    const matchingPlugin = plugins.find((plugin) => plugin.id === pluginId);
    return matchingPlugin
      ? HttpResponse.json<PluginMeta>({ ...matchingPlugin, enabled: false })
      : HttpResponse.json(PLUGIN_NOT_FOUND_RESPONSE, { status: 404 });
  });
};

export const getPluginMissingHandler = (pluginIdToRemove: string) =>
  http.get(`/api/plugins/${pluginIdToRemove}/settings`, () =>
    HttpResponse.json(PLUGIN_NOT_FOUND_RESPONSE, { status: 404 })
  );

const handlers = [getPluginsHandler()];
export default handlers;
