import { PluginExtensionExposedComponents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getAppPluginMetas } from '@grafana/runtime/internal';
import CentralAlertHistorySceneExposedComponent from 'app/features/alerting/unified/components/rules/central-state-history/CentralAlertHistorySceneExposedComponent';
import { AddToDashboardFormExposedComponent } from 'app/features/dashboard-scene/addToDashboard/AddToDashboardFormExposedComponent';

import { getCoreExtensionConfigurations } from '../getCoreExtensionConfigurations';

import { AddedComponentsRegistry } from './AddedComponentsRegistry';
import { AddedFunctionsRegistry } from './AddedFunctionsRegistry';
import { AddedLinksRegistry } from './AddedLinksRegistry';
import { ExposedComponentsRegistry } from './ExposedComponentsRegistry';
import { PluginExtensionRegistries } from './types';

/**
 * Lazy-initialized singleton for plugin extension registries.
 * The Promise is stored immediately on first call, making this safe from race conditions.
 */
let pluginExtensionRegistries: Promise<PluginExtensionRegistries> | undefined;

async function initPluginExtensionRegistries(): Promise<PluginExtensionRegistries> {
  const apps = await getAppPluginMetas();
  const addedComponentsRegistry = new AddedComponentsRegistry(apps);
  const exposedComponentsRegistry = new ExposedComponentsRegistry(apps);
  const addedLinksRegistry = new AddedLinksRegistry(apps);
  const addedFunctionsRegistry = new AddedFunctionsRegistry(apps);
  const pluginExtensionRegistries = {
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
        title: t(
          'plugins.get-plugin-extension-registries.title.central-alert-history-scene',
          'Central alert history scene'
        ),
        description: t(
          'plugins.get-plugin-extension-registries.description.central-alert-history-scene',
          'Central alert history scene'
        ),
        component: CentralAlertHistorySceneExposedComponent,
      },
      {
        id: PluginExtensionExposedComponents.AddToDashboardFormV1,
        title: t('plugins.get-plugin-extension-registries.title.add-to-dashboard-form', 'Add to dashboard form'),
        description: t(
          'plugins.get-plugin-extension-registries.description.add-to-dashboard-form',
          'Add to dashboard form'
        ),
        component: AddToDashboardFormExposedComponent,
      },
    ],
  });

  return pluginExtensionRegistries;
}

/**
 * Gets the plugin extension registries, initializing them on first call.
 * This function is safe to call concurrently - multiple simultaneous calls will
 * all receive the same Promise instance, ensuring only one initialization.
 * @returns Promise resolving to the plugin extension registries
 * @throws Error if getAppPluginMetas() fails during initialization
 */
export async function getPluginExtensionRegistries(): Promise<PluginExtensionRegistries> {
  // Return cached promise if already initialized or in progress
  if (pluginExtensionRegistries) {
    return pluginExtensionRegistries;
  }

  // Store promise immediately (before any await) to prevent race conditions
  pluginExtensionRegistries = initPluginExtensionRegistries();
  return pluginExtensionRegistries;
}

/**
 * Sets the plugin extension registries.
 * This function is intended for use in tests only, allowing injection of mock registries.
 * @param overrides Plugin extension registries to set
 * @throws Error if called outside of a test environment
 */
export function setPluginExtensionRegistries(overrides: PluginExtensionRegistries) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('setPluginExtensionRegistries() function can only be called from tests.');
  }

  pluginExtensionRegistries = Promise.resolve(overrides);
}
