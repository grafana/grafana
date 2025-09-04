import { PluginExtensionExposedComponents } from '@grafana/data';
import CentralAlertHistorySceneExposedComponent from 'app/features/alerting/unified/components/rules/central-state-history/CentralAlertHistorySceneExposedComponent';

import { getCoreExtensionConfigurations } from '../getCoreExtensionConfigurations';

import { AddedComponentsRegistry } from './AddedComponentsRegistry';
import { AddedFunctionsRegistry } from './AddedFunctionsRegistry';
import { AddedLinksRegistry } from './AddedLinksRegistry';
import { ExposedComponentsRegistry } from './ExposedComponentsRegistry';
import { PluginExtensionRegistries } from './types';

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

// Registering core extension links
addedLinksRegistry.register({
  pluginId: 'grafana',
  configs: getCoreExtensionConfigurations(),
});

// Registering core exposed components
exposedComponentsRegistry.register({
  pluginId: 'grafana',
  configs: [
    {
      id: PluginExtensionExposedComponents.AlertRuleHistory,
      title: 'Alert rule history for IRM',
      description: 'Alert rule history for IRM',
      component: CentralAlertHistorySceneExposedComponent,
    },
  ],
});
