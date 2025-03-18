import { AddedComponentsRegistry } from './AddedComponentsRegistry';
import { AddedLinksRegistry } from './AddedLinksRegistry';
import { ExposedComponentsRegistry } from './ExposedComponentsRegistry';

export type PluginExtensionRegistries = {
  addedComponentsRegistry: AddedComponentsRegistry;
  exposedComponentsRegistry: ExposedComponentsRegistry;
  addedLinksRegistry: AddedLinksRegistry;
};
