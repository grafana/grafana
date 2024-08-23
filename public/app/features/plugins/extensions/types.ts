import type { PluginExtensionConfig } from '@grafana/data';

import { AddedComponentRegistryItem, AddedComponentsRegistry } from './registry/AddedComponentsRegistry';
import { AddedLinkRegistryItem, AddedLinksRegistry } from './registry/AddedLinksRegistry';
import { ExposedComponentsRegistry } from './registry/ExposedComponentsRegistry';
import { RegistryType } from './registry/Registry';

// The information that is stored in the registry
export type PluginExtensionRegistryItem = {
  // Any additional meta information that we would like to store about the extension in the registry
  pluginId: string;

  config: PluginExtensionConfig;
};

// A map of placement names to a list of extensions
export type PluginExtensionRegistry = {
  id: string;
  extensions: Record<string, PluginExtensionRegistryItem[]>;
};

export type AddedComponentsRegistryState = RegistryType<Array<AddedComponentRegistryItem<{}>>>;

export type PluginRegistryStates = {
  addedComponentsRegistry: RegistryType<Array<AddedComponentRegistryItem<{}>>>;
  addedLinksRegistry: RegistryType<AddedLinkRegistryItem[]>;
};

export type PluginExtensionRegistries = {
  addedComponentsRegistry: AddedComponentsRegistry;
  exposedComponentsRegistry: ExposedComponentsRegistry;
  addedLinksRegistry: AddedLinksRegistry;
};
