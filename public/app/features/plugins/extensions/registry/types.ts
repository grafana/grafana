import { AddedComponentsRegistry } from './AddedComponentsRegistry';
import { AddedFunctionsRegistry } from './AddedFunctionsRegistry';
import { AddedLinksRegistry } from './AddedLinksRegistry';
import { CommandPaletteDynamicRegistry } from './CommandPaletteDynamicRegistry';
import { ExposedComponentsRegistry } from './ExposedComponentsRegistry';

export type PluginExtensionRegistries = {
  addedComponentsRegistry: AddedComponentsRegistry;
  exposedComponentsRegistry: ExposedComponentsRegistry;
  addedFunctionsRegistry: AddedFunctionsRegistry;
  addedLinksRegistry: AddedLinksRegistry;
  commandPaletteDynamicRegistry: CommandPaletteDynamicRegistry;
};
