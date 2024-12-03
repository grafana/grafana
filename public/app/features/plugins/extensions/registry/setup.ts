import { getCoreExtensionConfigurations } from '../getCoreExtensionConfigurations';

import { AddedComponentsRegistry } from './AddedComponentsRegistry';
import { AddedHooksRegistry } from './AddedHooksRegistry';
import { AddedLinksRegistry } from './AddedLinksRegistry';
import { ExposedComponentsRegistry } from './ExposedComponentsRegistry';
import { PluginExtensionRegistries } from './types';

export const addedComponentsRegistry = new AddedComponentsRegistry();
export const exposedComponentsRegistry = new ExposedComponentsRegistry();
export const addedLinksRegistry = new AddedLinksRegistry();
export const addedHooksRegistry = new AddedHooksRegistry();
export const pluginExtensionRegistries: PluginExtensionRegistries = {
  addedComponentsRegistry,
  exposedComponentsRegistry,
  addedLinksRegistry,
  addedHooksRegistry,
};

// Registering core extensions
addedLinksRegistry.register({
  pluginId: 'grafana',
  configs: getCoreExtensionConfigurations(),
});
