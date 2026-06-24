import { type AddedComponentsRegistry } from './AddedComponentsRegistry';
import { type AddedFunctionsRegistry } from './AddedFunctionsRegistry';
import { type AddedLinksRegistry } from './AddedLinksRegistry';
import { type ExposedComponentsRegistry } from './ExposedComponentsRegistry';

export type PluginExtensionRegistries = {
  addedComponentsRegistry: AddedComponentsRegistry;
  exposedComponentsRegistry: ExposedComponentsRegistry;
  addedFunctionsRegistry: AddedFunctionsRegistry;
  addedLinksRegistry: AddedLinksRegistry;
};
