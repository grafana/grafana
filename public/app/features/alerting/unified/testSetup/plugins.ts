import { RequestHandler } from 'msw';

import { PluginMeta, PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';

import { pluginsHandler } from '../mocks/plugins';

export function setupPlugins(plugins: Record<string, PluginMeta>): { apiHandlers: RequestHandler[] } {
  const pluginsArray = Object.values(plugins);
  console.log(pluginsArray);

  pluginsArray.forEach((plugin) => {
    console.log(plugin);
    config.apps[plugin.id] = {
      id: plugin.id,
      path: plugin.baseUrl,
      preload: true,
      version: plugin.info.version,
      angular: plugin.angular ?? { detected: false, hideDeprecation: false },
    };
  });

  return {
    apiHandlers: [pluginsHandler(plugins)],
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
  asserts: {
    id: 'grafana-asserts-app',
    name: 'Asserts',
    type: PluginType.app,
    enabled: true,
    info: {
      author: {
        name: 'Grafana Labs',
        url: '',
      },
      description: 'Asserts',
      links: [],
      logos: {
        small: 'public/plugins/grafana-asserts-app/img/logo.svg',
        large: 'public/plugins/grafana-asserts-app/img/logo.svg',
      },
      screenshots: [],
      version: 'local-dev',
      updated: '2024-04-09',
    },
    module: 'public/plugins/grafana-asserts-app/module.js',
    baseUrl: 'public/plugins/grafana-asserts-app',
  },
};
