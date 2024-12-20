import { getCoreExtensionConfigurations } from '../getCoreExtensionConfigurations';

import { AddedComponentsRegistry } from './AddedComponentsRegistry';
import { AddedLinksRegistry } from './AddedLinksRegistry';
import { ExposedComponentsRegistry } from './ExposedComponentsRegistry';
import { PluginExtensionRegistries } from './types';

export const addedComponentsRegistry = new AddedComponentsRegistry();
export const exposedComponentsRegistry = new ExposedComponentsRegistry();
export const addedLinksRegistry = new AddedLinksRegistry();
export const pluginExtensionRegistries: PluginExtensionRegistries = {
  addedComponentsRegistry,
  exposedComponentsRegistry,
  addedLinksRegistry,
};

// Registering core extensions
addedLinksRegistry.register({
  pluginId: 'grafana',
  configs: getCoreExtensionConfigurations(),
});
