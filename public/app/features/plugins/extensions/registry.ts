import { AppPlugin, PluginsExtensionLink } from '@grafana/data';
import {
  AppPluginConfig,
  PluginExtensionTypes,
  PluginsExtensionLinkConfig,
  PluginsExtensionRegistry,
} from '@grafana/runtime';

const registry: PluginsExtensionRegistry = {};

export function createPluginExtensionsRegistry(apps: Record<string, AppPluginConfig> = {}): PluginsExtensionRegistry {
  for (const [pluginId, config] of Object.entries(apps)) {
    const extensions = config.extensions;

    if (!Array.isArray(extensions)) {
      continue;
    }

    for (const extension of extensions) {
      const placement = extension.placement;
      const item = createRegistryItem(pluginId, extension);

      if (!Array.isArray(registry[placement])) {
        registry[placement] = [item];
        continue;
      }

      registry[placement].push(item);
      continue;
    }
  }

  for (const key of Object.keys(registry)) {
    Object.freeze(registry[key]);
  }

  return Object.freeze(registry);
}

export function setExtensionItemCallback(pluginId: string, app: AppPlugin) {
  console.log('all overrides', app.extensionOverrides);

  for (const overrideId of Object.keys(app.extensionOverrides)) {
    const item = Object.values(registry).reduce<PluginsExtensionLink | undefined>(
      (theone: PluginsExtensionLink | undefined, items: PluginsExtensionLink[]) => {
        if (theone) {
          return theone;
        }
        return items.find((i) => i.id === overrideId && i.pluginId === pluginId);
      },
      undefined
    );

    if (item) {
      console.log('item found', item);
      item.override = app.extensionOverrides[overrideId];
    }
  }
}

function createRegistryItem(pluginId: string, extension: PluginsExtensionLinkConfig): PluginsExtensionLink {
  const path = `/a/${pluginId}${extension.path}`;

  return {
    id: extension.id,
    pluginId: pluginId,
    type: PluginExtensionTypes.link,
    title: extension.title,
    description: extension.description,
    path: path,
    key: hashKey(`${extension.title}${path}`),
  };
}

function hashKey(key: string): number {
  return Array.from(key).reduce((s, c) => (Math.imul(31, s) + c.charCodeAt(0)) | 0, 0);
}
