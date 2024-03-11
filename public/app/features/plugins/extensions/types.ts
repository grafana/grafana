import type { PluginExtensionConfig } from '@grafana/data';

// The information that is stored in the registry
export type PluginExtensionRegistryItem = {
  pluginId: string; // The id of the plugin that registered the extension
  enabled?: boolean; // If the extension is enabled
  isDev?: boolean; // Set to true if the extension is added from the developer console

  config: PluginExtensionConfig;
};

// A map of placement names to a list of extensions
export type PluginExtensionRegistry = Record<string, PluginExtensionRegistryItem[]>;
