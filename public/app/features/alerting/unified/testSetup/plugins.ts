import { PluginLoadingStrategy, type PluginMeta, PluginType } from '@grafana/data';
import { type AppPluginConfig, setPluginComponentsHook, setPluginLinksHook } from '@grafana/runtime';
import { type AppPluginMetas, setAppPluginMetas } from '@grafana/runtime/internal';
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
  [SupportedPlugin.Labels]: {
    id: SupportedPlugin.Labels,
    name: 'Labels',
    type: PluginType.app,
    enabled: true,
    info: {
      author: {
        name: 'Grafana Labs',
        url: '',
      },
      description: 'Labels management for alerting',
      links: [],
      logos: {
        small: 'public/plugins/grafana-labels-app/img/logo.svg',
        large: 'public/plugins/grafana-labels-app/img/logo.svg',
      },
      screenshots: [],
      version: 'local-dev',
      updated: '2024-04-09',
    },
    module: 'public/plugins/grafana-labels-app/module.js',
    baseUrl: 'public/plugins/grafana-labels-app',
  } satisfies PluginMeta,
  [SupportedPlugin.Assistant]: {
    id: SupportedPlugin.Assistant,
    name: 'Grafana Assistant',
    type: PluginType.app,
    enabled: true,
    info: {
      author: {
        name: 'Grafana Labs',
        url: '',
      },
      description: 'Grafana Assistant',
      links: [],
      logos: {
        small: 'public/plugins/grafana-assistant-app/img/logo.svg',
        large: 'public/plugins/grafana-assistant-app/img/logo.svg',
      },
      screenshots: [],
      version: 'local-dev',
      updated: '2024-04-09',
    },
    module: 'public/plugins/grafana-assistant-app/module.js',
    baseUrl: 'public/plugins/grafana-assistant-app',
  } satisfies PluginMeta,
  [SupportedPlugin.MachineLearning]: {
    id: SupportedPlugin.MachineLearning,
    name: 'Machine Learning',
    type: PluginType.app,
    enabled: true,
    info: {
      author: {
        name: 'Grafana Labs',
        url: '',
      },
      description: 'Machine Learning',
      links: [],
      logos: {
        small: 'public/plugins/grafana-ml-app/img/logo.svg',
        large: 'public/plugins/grafana-ml-app/img/logo.svg',
      },
      screenshots: [],
      version: 'local-dev',
      updated: '2024-04-09',
    },
    module: 'public/plugins/grafana-ml-app/module.js',
    baseUrl: 'public/plugins/grafana-ml-app',
  } satisfies PluginMeta,
};

export const plugins: PluginMeta[] = [
  pluginMeta[SupportedPlugin.Slo],
  pluginMeta[SupportedPlugin.Incident],
  pluginMeta[SupportedPlugin.OnCall],
  pluginMeta['grafana-asserts-app'],
  pluginMeta[SupportedPlugin.Labels],
];

export function pluginMetaToPluginConfig(pluginMeta: PluginMeta): AppPluginConfig {
  return {
    id: pluginMeta.id,
    path: pluginMeta.baseUrl,
    preload: true,
    version: pluginMeta.info.version,
    angular: pluginMeta.angular ?? { detected: false, hideDeprecation: false },
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

/**
 * App plugin metas mirror bootdata's `config.apps`, which is what `isAppPluginInstalled` reads.
 * Hooks like `usePluginBridge` consult it before requesting plugin settings, so a plugin must be
 * registered here to be considered installed at all — a settings handler alone is not enough.
 *
 * `setAppPluginMetas` replaces the whole map, so we track the current set to support add / remove.
 */
const defaultAppPluginMetas: AppPluginMetas = Object.fromEntries(
  plugins.map((plugin) => [plugin.id, pluginMetaToPluginConfig(plugin)])
);

let currentAppPluginMetas: AppPluginMetas = {};

export function resetAppPluginMetas() {
  currentAppPluginMetas = { ...defaultAppPluginMetas };
  setAppPluginMetas(currentAppPluginMetas);
}

export function installAppPluginMeta(pluginMeta: PluginMeta) {
  currentAppPluginMetas = { ...currentAppPluginMetas, [pluginMeta.id]: pluginMetaToPluginConfig(pluginMeta) };
  setAppPluginMetas(currentAppPluginMetas);
}

export function uninstallAppPluginMeta(pluginId: string) {
  const { [pluginId]: _removed, ...rest } = currentAppPluginMetas;
  currentAppPluginMetas = rest;
  setAppPluginMetas(currentAppPluginMetas);
}
