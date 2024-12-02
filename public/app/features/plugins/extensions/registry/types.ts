import { AddedComponentsRegistry } from './AddedComponentsRegistry';
import { AddedHooksRegistry } from './AddedHooksRegistry';
import { AddedLinksRegistry } from './AddedLinksRegistry';
import { ExposedComponentsRegistry } from './ExposedComponentsRegistry';

export type PluginExtensionRegistries = {
  addedComponentsRegistry: AddedComponentsRegistry;
  exposedComponentsRegistry: ExposedComponentsRegistry;
  addedHooksRegistry: AddedHooksRegistry;
  addedLinksRegistry: AddedLinksRegistry;
};
