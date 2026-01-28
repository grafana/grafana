/* eslint-disable @grafana/i18n/no-untranslated-strings */
import { AppPluginConfig, PluginExtensionExposedComponents } from '@grafana/data';
import { getAppPluginMetas } from '@grafana/runtime/internal';
import CentralAlertHistorySceneExposedComponent from 'app/features/alerting/unified/components/rules/central-state-history/CentralAlertHistorySceneExposedComponent';
import { CreateAlertFromPanelExposedComponent } from 'app/features/alerting/unified/extensions/CreateAlertFromPanelExposedComponent';
import { AddToDashboardFormExposedComponent } from 'app/features/dashboard-scene/addToDashboard/AddToDashboardFormExposedComponent';
import { OpenQueryLibraryExposedComponent } from 'app/features/explore/QueryLibrary/OpenQueryLibraryExposedComponent';

import { getCoreExtensionConfigurations } from '../getCoreExtensionConfigurations';
import { log } from '../logs/log';

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

function initRegistries(apps: AppPluginConfig[]): PluginExtensionRegistries {
  const addedComponentsRegistry = new AddedComponentsRegistry(apps);
  const exposedComponentsRegistry = new ExposedComponentsRegistry(apps);
  const addedLinksRegistry = new AddedLinksRegistry(apps);
  const addedFunctionsRegistry = new AddedFunctionsRegistry(apps);
  return { addedComponentsRegistry, addedFunctionsRegistry, addedLinksRegistry, exposedComponentsRegistry };
}

function registerCoreExtensions({ addedLinksRegistry, exposedComponentsRegistry }: PluginExtensionRegistries) {
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
      {
        id: PluginExtensionExposedComponents.CreateAlertFromPanelV1,
        title: 'Create alert from panel',
        description: 'Modal to create an alert rule from panel data',
        component: CreateAlertFromPanelExposedComponent,
      },
      {
        id: PluginExtensionExposedComponents.OpenQueryLibraryV1,
        title: 'Access to the Query Library',
        description: 'Access to the Query Library',
        component: OpenQueryLibraryExposedComponent,
      },
    ],
  });
}

async function initPluginExtensionRegistries(): Promise<PluginExtensionRegistries> {
  try {
    const apps = await getAppPluginMetas();
    const registries = initRegistries(apps);
    registerCoreExtensions(registries);

    return registries;
  } catch (err) {
    if (err instanceof Error) {
      log.error(`Failed to init plugin extension registries.`, { stack: err.stack ?? '', message: err.message });
    }

    // fetching plugin meta failed, so we clear the cached promise to allow a retry at a later point.
    pluginExtensionRegistries = undefined;
    return initRegistries([]);
  }
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
export function setPluginExtensionRegistries(overrides?: PluginExtensionRegistries) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('setPluginExtensionRegistries() function can only be called from tests.');
  }

  if (overrides) {
    pluginExtensionRegistries = Promise.resolve(overrides);
    return;
  }

  pluginExtensionRegistries = undefined;
}
