import { getCoreExtensionConfigurations } from '../getCoreExtensionConfigurations';
import { getDefaultUrlRecognizers } from '../getDefaultUrlRecognizers';

import { AddedComponentsRegistry } from './AddedComponentsRegistry';
import { AddedFunctionsRegistry } from './AddedFunctionsRegistry';
import { AddedLinksRegistry } from './AddedLinksRegistry';
import { ExposedComponentsRegistry } from './ExposedComponentsRegistry';
import { UrlRecognizersRegistry } from './UrlRecognizersRegistry';
import { PluginExtensionRegistries } from './types';

export const addedComponentsRegistry = new AddedComponentsRegistry();
export const exposedComponentsRegistry = new ExposedComponentsRegistry();
export const addedLinksRegistry = new AddedLinksRegistry();
export const addedFunctionsRegistry = new AddedFunctionsRegistry();
export const urlRecognizersRegistry = new UrlRecognizersRegistry();
export const pluginExtensionRegistries: PluginExtensionRegistries = {
  addedComponentsRegistry,
  exposedComponentsRegistry,
  addedLinksRegistry,
  addedFunctionsRegistry,
  urlRecognizersRegistry,
};

// Registering core extensions
addedLinksRegistry.register({
  pluginId: 'grafana',
  configs: getCoreExtensionConfigurations(),
});

// Registering default URL recognizers
urlRecognizersRegistry.register({
  pluginId: 'grafana',
  configs: getDefaultUrlRecognizers(),
});
