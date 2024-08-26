import { AddedComponentRegistryItem, AddedComponentsRegistry } from './AddedComponentsRegistry';
import { AddedLinkRegistryItem, AddedLinksRegistry } from './AddedLinksRegistry';
import { ExposedComponentsRegistry } from './ExposedComponentsRegistry';
import { RegistryType } from './Registry';

export type PluginRegistryStates = {
  addedComponentsRegistry: RegistryType<Array<AddedComponentRegistryItem<{}>>>;
  addedLinksRegistry: RegistryType<AddedLinkRegistryItem[]>;
};

export type PluginExtensionRegistries = {
  addedComponentsRegistry: AddedComponentsRegistry;
  exposedComponentsRegistry: ExposedComponentsRegistry;
  addedLinksRegistry: AddedLinksRegistry;
};
