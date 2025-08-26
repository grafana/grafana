import { AddedComponentsRegistry } from './AddedComponentsRegistry';
import { AddedFunctionsRegistry } from './AddedFunctionsRegistry';
import { AddedLinksRegistry } from './AddedLinksRegistry';
import { ExposedComponentsRegistry } from './ExposedComponentsRegistry';

export type PluginExtensionRegistries = {
  addedComponentsRegistry: AddedComponentsRegistry;
  exposedComponentsRegistry: ExposedComponentsRegistry;
  addedFunctionsRegistry: AddedFunctionsRegistry;
  addedLinksRegistry: AddedLinksRegistry;
};
