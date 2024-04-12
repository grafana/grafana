import { HttpResponse, RequestHandler, http } from 'msw';
import { SetupServerApi } from 'msw/lib/node';

import { PluginMeta, PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';
import * as pluginsSettings from 'app/features/plugins/pluginSettings';

export function setupPlugins(...plugins: PluginMeta[]): { apiHandlers: RequestHandler[] } {
  const pluginsRegistry = new Map<string, PluginMeta>();
  plugins.forEach((plugin) => pluginsRegistry.set(plugin.id, plugin));

  // jest.spyOn(pluginsSettings, 'getPluginSettings').mockImplementation((pluginId: string) => {
  //   const plugin = pluginsRegistry.get(pluginId);
  //   if (!plugin) {
  //     console.error(`Unknown plugin ${pluginId}`);
  //     return Promise.reject(new Error(`Unknown plugin ${pluginId}`));
  //   }

  //   return Promise.resolve(plugin);
  // });

  pluginsRegistry.forEach((plugin) => {
    config.apps[plugin.id] = {
      id: plugin.id,
      path: plugin.baseUrl,
      preload: true,
      version: plugin.info.version,
      angular: plugin.angular ?? { detected: false, hideDeprecation: false },
    };
  });

  return {
    apiHandlers: plugins.map((plugin) =>
      http.get(`/api/plugins/${plugin.id}/settings`, () => {
        return HttpResponse.json<PluginMeta>(plugin);
      })
    ),
  };
}

export const plugins: Record<string, PluginMeta> = {
  slo: {
    id: 'grafana-slo-app',
    name: 'SLO dashboard',
    type: PluginType.app,
    enabled: true,
    info: {
      author: {
        name: 'Grafana Labs',
        url: '',
      },
      description: 'Create and manage Service Level Objectives',
      links: [],
      logos: {
        small: 'public/plugins/grafana-slo-app/img/logo.svg',
        large: 'public/plugins/grafana-slo-app/img/logo.svg',
      },
      screenshots: [],
      version: 'local-dev',
      updated: '2024-04-09',
    },
    module: 'public/plugins/grafana-slo-app/module.js',
    baseUrl: 'public/plugins/grafana-slo-app',
  },
  incident: {
    id: 'grafana-incident-app',
    name: 'Incident management',
    type: PluginType.app,
    enabled: true,
    info: {
      author: {
        name: 'Grafana Labs',
        url: '',
      },
      description: 'Incident management',
      links: [],
      logos: {
        small: 'public/plugins/grafana-incident-app/img/logo.svg',
        large: 'public/plugins/grafana-incident-app/img/logo.svg',
      },
      screenshots: [],
      version: 'local-dev',
      updated: '2024-04-09',
    },
    module: 'public/plugins/grafana-incident-app/module.js',
    baseUrl: 'public/plugins/grafana-incident-app',
  },
};
