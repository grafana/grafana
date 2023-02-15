import { type PluginsExtensionLink, PluginsExtensionTypes, PluginsExtensionLinkConfigurer } from '@grafana/data';
import { type AppPluginConfig, type PluginsExtensionLinkConfig, type PluginsExtensionRegistry } from '@grafana/runtime';

import { getPreloadPluginConfig } from '../pluginPreloader';

export function createPluginExtensionsRegistry(apps: Record<string, AppPluginConfig> = {}): PluginsExtensionRegistry {
  const registry: PluginsExtensionRegistry = {};
  for (const [pluginId, config] of Object.entries(apps)) {
    const extensions = config.extensions;

    if (!Array.isArray(extensions)) {
      continue;
    }

    const counter: Record<string, number> = {};

    for (const extension of extensions) {
      const placement = extension.placement;
      counter[placement] = (counter[placement] ?? 0) + 1;
      const item = createRegistryItem(pluginId, extension);

      // If there was an issue initialising the plugin, skip adding its extensions to the registry
      // or if the plugin already have placed 2 items at the extension point.
      if (!item || counter[placement] > 2) {
        continue;
      }

      if (!Array.isArray(registry[placement])) {
        registry[placement] = [item];
        continue;
      }

      registry[placement].push(item);
    }
  }

  for (const key of Object.keys(registry)) {
    Object.freeze(registry[key]);
  }

  return Object.freeze(registry);
}

function createRegistryItem(pluginId: string, extension: PluginsExtensionLinkConfig): PluginsExtensionLink | undefined {
  const config = getPreloadPluginConfig(pluginId);

  if (config?.error) {
    return;
  }

  return Object.freeze({
    type: PluginsExtensionTypes.link,
    title: extension.title,
    description: extension.description,
    key: hashKey(`${extension.title}${extension.path}`),
    path: extension.path,
    configure: configureWithValidation(pluginId, config?.extensionConfigs?.[extension.id]),
  });
}

function hashKey(key: string): number {
  return Array.from(key).reduce((s, c) => (Math.imul(31, s) + c.charCodeAt(0)) | 0, 0);
}

// This should not live here. It should be moved to the AppPlugin
// to be applied as early in the pipeline as possible. But currently
// we don't have access to pluginId when preloading plugins.
function configureWithValidation(
  pluginId: string,
  configurer: PluginsExtensionLinkConfigurer | undefined
): PluginsExtensionLinkConfigurer | undefined {
  if (!configurer) {
    return;
  }

  const pathPrefix = `/a/${pluginId}/`;

  return function validateConfiguredLink(link, context) {
    const configured = configurer(link, context);
    const path = configured?.path;

    if (path && !path.startsWith(pathPrefix)) {
      return undefined;
    }

    return configured;
  };
}
