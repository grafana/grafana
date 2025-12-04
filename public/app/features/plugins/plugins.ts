import {
  AppPluginConfig,
  PluginDependencies,
  PluginExtensions,
  PluginMetasResponse,
  PluginMetasSpec,
  PluginType,
} from '@grafana/data';
import { config, GrafanaBootConfig } from '@grafana/runtime';

import { getConfig, updateConfig } from '../../core/config';
import { backendSrv } from '../../core/services/backend_srv';
import { contextSrv } from '../../core/services/context_srv';

export function shouldPreloadAppPlugins(): boolean {
  // Do not pre-load apps if rendererDisableAppPluginsPreload is true and the request comes from the image renderer
  const skipAppPluginsPreload =
    config.featureToggles.rendererDisableAppPluginsPreload && contextSrv.user.authenticatedBy === 'render';

  if (contextSrv.user.orgRole === '' || skipAppPluginsPreload) {
    return false;
  }

  return true;
}

export interface AppPluginWrapper {
  id: string;
  preload: boolean;
  extensions: PluginExtensions;
  dependencies: PluginDependencies;
  path: string;
  version: string;
  moduleHash?: string;
}

export function getAppPlugins(): Record<string, AppPluginWrapper> {
  const wrappers: Record<string, AppPluginWrapper> = {};

  if (config.featureToggles.usePluginsMeta) {
    return Object.values(getConfig().plugins.apps).reduce((acc, curr) => {
      acc[curr.pluginJson.id] = withWrapper(curr);
      return acc;
    }, wrappers);
  }

  return Object.values(config.apps).reduce((acc, curr) => {
    acc[curr.id] = withWrapper(curr);
    return acc;
  }, wrappers);
}

function withWrapper(raw: AppPluginConfig | PluginMetasSpec): AppPluginWrapper {
  const extensions: PluginExtensions = {
    addedComponents: [],
    addedFunctions: [],
    addedLinks: [],
    exposedComponents: [],
    extensionPoints: [],
  };

  if (isPluginMetasSpec(raw)) {
    return {
      id: raw.pluginJson.id,
      preload: raw.pluginJson.preload || false,
      extensions: {
        ...raw.pluginJson.extensions,
        ...extensions,
      },
      dependencies: {
        grafanaVersion: raw.pluginJson.dependencies.grafanaVersion || '',
        plugins:
          raw.pluginJson.dependencies.plugins?.map((p) => ({
            id: p.id,
            name: p.name,
            type:
              p.type === 'app' ? PluginType.app : p.type === 'datasource' ? PluginType.datasource : PluginType.panel,
            version: '',
          })) || [],
        grafanaDependency: raw.pluginJson.dependencies.grafanaDependency,
        extensions: {
          exposedComponents: raw.pluginJson.dependencies.extensions?.exposedComponents || [],
        },
      },
      path: raw.module.path,
      version: raw.pluginJson.info.version,
    };
  }

  return raw;
}

function isPluginMetasSpec(data: AppPluginConfig | PluginMetasSpec): data is PluginMetasSpec {
  return 'pluginJson' in data && 'module' in data;
}

// export function throwIfUsesBootdata() {
//   if (!config.featureToggles.usePluginsMeta) {
//     throw new Error('This function should run with config.featureToggles.usePluginsMeta');
//   }
// }

// export function throwIfUsesPluginsMeta() {
//   if (config.featureToggles.usePluginsMeta) {
//     throw new Error('This function should not run with config.featureToggles.usePluginsMeta');
//   }
// }

export async function loadPluginsMeta() {
  if (!config.featureToggles.usePluginsMeta) {
    return;
  }

  const url = `/apis/plugins.grafana.app/v0alpha1/namespaces/${config.namespace}/pluginmetas`;
  const response = await backendSrv.get<PluginMetasResponse>(url);
  const plugins: GrafanaBootConfig['plugins'] = { apps: {}, panels: {}, datasources: {} };
  response.items.reduce((acc, curr) => {
    if (curr.spec.pluginJson.type === 'app') {
      acc.apps[curr.spec.pluginJson.id] = curr.spec;
    }

    if (curr.spec.pluginJson.type === 'panel') {
      acc.panels[curr.spec.pluginJson.id] = curr.spec;
    }

    if (curr.spec.pluginJson.type === 'datasource') {
      acc.datasources[curr.spec.pluginJson.id] = curr.spec;
    }

    return acc;
  }, plugins);

  updateConfig({ plugins });
}
