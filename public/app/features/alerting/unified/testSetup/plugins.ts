import { PluginLoadingStrategy, PluginMeta, PluginType } from '@grafana/data';
import { AppPluginConfig, setPluginComponentsHook, setPluginLinksHook } from '@grafana/runtime';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { mockPluginLinkExtension } from '../mocks';

export function setupPluginsExtensionsHook() {
  setPluginLinksHook(() => ({
    links: plugins.map((plugin) =>
      mockPluginLinkExtension({
        pluginId: plugin.id,
        title: plugin.name,
        path: `/a/${plugin.id}`,
      })
    ),
    isLoading: false,
  }));
  setPluginComponentsHook(() => ({
    components: [],
    isLoading: false,
  }));
}

export const pluginMeta = {
  [SupportedPlugin.Slo]: {
    id: SupportedPlugin.Slo,
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
  } satisfies PluginMeta,
  [SupportedPlugin.Irm]: {
    id: SupportedPlugin.Irm,
    name: 'Grafana IRM',
    type: PluginType.app,
    enabled: true,
    info: {
      author: { name: 'Grafana Labs', url: '' },
      description: 'Grafana IRM',
      links: [],
      logos: {
        small: 'public/plugins/grafana-irm-app/img/logo.svg',
        large: 'public/plugins/grafana-irm-app/img/logo.svg',
      },
      screenshots: [],
      version: 'local-dev',
      updated: '2024-04-09',
    },
    module: 'public/plugins/grafana-irm-app/module.js',
    baseUrl: 'public/plugins/grafana-irm-app',
  } satisfies PluginMeta,
  [SupportedPlugin.Incident]: {
    id: SupportedPlugin.Incident,
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
  } satisfies PluginMeta,
  [SupportedPlugin.OnCall]: {
    id: SupportedPlugin.OnCall,
    name: 'OnCall',
    type: PluginType.app,
    enabled: true,
    info: {
      author: {
        name: 'Grafana Labs',
        url: '',
      },
      description: 'OnCall',
      links: [],
      logos: {
        small: '',
        large: '',
      },
      screenshots: [],
      version: 'local-dev',
      updated: '2024-04-09',
    },
    module: 'public/plugins/grafana-oncall-app/module.js',
    baseUrl: 'public/plugins/grafana-oncall-app',
  } satisfies PluginMeta,
  ['grafana-asserts-app']: {
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
  } satisfies PluginMeta,
};

export const plugins: PluginMeta[] = [
  pluginMeta[SupportedPlugin.Slo],
  pluginMeta[SupportedPlugin.Incident],
  pluginMeta[SupportedPlugin.OnCall],
  pluginMeta['grafana-asserts-app'],
];

export function pluginMetaToPluginConfig(pluginMeta: PluginMeta): AppPluginConfig {
  return {
    id: pluginMeta.id,
    path: pluginMeta.baseUrl,
    preload: true,
    version: pluginMeta.info.version,
    angular: { detected: false, hideDeprecation: false },
    loadingStrategy: PluginLoadingStrategy.script,
    dependencies: {
      plugins: [],
      grafanaVersion: 'local-dev',
      extensions: {
        exposedComponents: [],
      },
    },
    extensions: {
      addedLinks: [],
      addedComponents: [],
      extensionPoints: [],
      exposedComponents: [],
      addedFunctions: [],
    },
  };
}
