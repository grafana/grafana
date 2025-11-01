import { PluginExtensionExposedComponents } from '@grafana/data';
import CentralAlertHistorySceneExposedComponent from 'app/features/alerting/unified/components/rules/central-state-history/CentralAlertHistorySceneExposedComponent';
import { AddToDashboardFormExposedComponent } from 'app/features/dashboard-scene/addToDashboard/AddToDashboardFormExposedComponent';

import { getCoreExtensionConfigurations } from '../getCoreExtensionConfigurations';

import { AddedComponentsRegistry } from './AddedComponentsRegistry';
import { AddedFunctionsRegistry } from './AddedFunctionsRegistry';
import { AddedLinksRegistry } from './AddedLinksRegistry';
import { CommandPaletteDynamicRegistry } from './CommandPaletteDynamicRegistry';
import { ExposedComponentsRegistry } from './ExposedComponentsRegistry';
import { PluginExtensionRegistries } from './types';

export const addedComponentsRegistry = new AddedComponentsRegistry();
export const exposedComponentsRegistry = new ExposedComponentsRegistry();
export const addedLinksRegistry = new AddedLinksRegistry();
export const addedFunctionsRegistry = new AddedFunctionsRegistry();
export const commandPaletteDynamicRegistry = new CommandPaletteDynamicRegistry();
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
      id: PluginExtensionExposedComponents.CentralAlertHistorySceneV1,
      title: 'Central alert history scene',
      description: 'Central alert history scene',
      component: CentralAlertHistorySceneExposedComponent,
    },
    {
      id: PluginExtensionExposedComponents.AddToDashboardFormV1,
      title: 'Add to dashboard form',
      description: 'Add to dashboard form',
      component: AddToDashboardFormExposedComponent,
    },
  ],
});
