import { lazy } from 'react';

import { PluginExtensionPointsInPlugins } from '../../../../../../packages/grafana-data/src/types/pluginExtensions';
import { getCoreExtensionConfigurations } from '../getCoreExtensionConfigurations';

import { AddedComponentsRegistry } from './AddedComponentsRegistry';
import { AddedFunctionsRegistry } from './AddedFunctionsRegistry';
import { AddedLinksRegistry } from './AddedLinksRegistry';
import { ExposedComponentsRegistry } from './ExposedComponentsRegistry';
import { PluginExtensionRegistries } from './types';

const AlertRuleHistory = lazy(() => import('./AlertRule'));

export const addedComponentsRegistry = new AddedComponentsRegistry();
export const exposedComponentsRegistry = new ExposedComponentsRegistry();
export const addedLinksRegistry = new AddedLinksRegistry();
export const addedFunctionsRegistry = new AddedFunctionsRegistry();
export const pluginExtensionRegistries: PluginExtensionRegistries = {
  addedComponentsRegistry,
  exposedComponentsRegistry,
  addedLinksRegistry,
  addedFunctionsRegistry,
};

// Registering core extensions
addedLinksRegistry.register({
  pluginId: 'grafana',
  configs: getCoreExtensionConfigurations(),
});

// Registering core components
addedComponentsRegistry.register({
  pluginId: 'grafana',
  configs: [
    {
      title: 'Alert Rule for IRM',
      description: 'Alert Rule for IRM',
      targets: [PluginExtensionPointsInPlugins.IrmAlertRule],
      component: AlertRuleHistory,
    },
  ],
});
