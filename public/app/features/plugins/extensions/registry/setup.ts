import { getCoreExtensionConfigurations } from '../getCoreExtensionConfigurations';

import { AddedComponentsRegistry } from './AddedComponentsRegistry';
import { AddedLinksRegistry } from './AddedLinksRegistry';
import { ExposedComponentsRegistry } from './ExposedComponentsRegistry';
import { PluginExtensionRegistries } from './types';

export function setupPluginExtensionRegistries(): PluginExtensionRegistries {
  const pluginExtensionsRegistries = {
    addedComponentsRegistry: new AddedComponentsRegistry(),
    exposedComponentsRegistry: new ExposedComponentsRegistry(),
    addedLinksRegistry: new AddedLinksRegistry(),
  };

  pluginExtensionsRegistries.addedLinksRegistry.register({
    pluginId: 'grafana',
    configs: getCoreExtensionConfigurations(),
  });

  return pluginExtensionsRegistries;
}
