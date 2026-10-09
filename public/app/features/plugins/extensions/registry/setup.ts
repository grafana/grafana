/* eslint-disable @grafana/i18n/no-untranslated-strings */
import { type AppPluginConfig, PluginExtensionExposedComponents } from '@grafana/data';
import { provisioning } from '@grafana/runtime';
import { getAppPluginMetas, getCachedPromise } from '@grafana/runtime/internal';
import CentralAlertHistorySceneExposedComponent from 'app/features/alerting/unified/components/rules/central-state-history/CentralAlertHistorySceneExposedComponent';
import { CreateAlertFromPanelExposedComponentLazy } from 'app/features/alerting/unified/extensions/CreateAlertFromPanelExposedComponentLazy';
import { AddToDashboardFormExposedComponent } from 'app/features/dashboard-scene/addToDashboard/AddToDashboardFormExposedComponent';
import { OpenQueryLibraryExposedComponent } from 'app/features/explore/QueryLibrary/OpenQueryLibraryExposedComponent';
import { PrometheusQueryResultsContainer } from 'app/features/explore/RawPrometheus/PrometheusQueryResultsContainer';
import { NotebookViewLazy } from 'app/features/notebook/embed/NotebookViewLazy';
import { ManagedBadgeExposedComponent } from 'app/features/provisioning/components/ManagedBadgeExposedComponent';
import { ProvisionedResourceDrawerExposedComponent } from 'app/features/provisioning/components/Shared/ProvisionedResourceDrawerExposedComponent';
import { addResourceKinds } from 'app/features/provisioning/utils/resourceKinds';

import { getCoreExtensionConfigurations } from '../getCoreExtensionConfigurations';

import { AddedComponentsRegistry } from './AddedComponentsRegistry';
import { AddedFunctionsRegistry } from './AddedFunctionsRegistry';
import { AddedLinksRegistry } from './AddedLinksRegistry';
import { ExposedComponentsRegistry } from './ExposedComponentsRegistry';
import { type PluginExtensionRegistries } from './types';

export function initRegistries(apps: AppPluginConfig[]): PluginExtensionRegistries {
  const addedComponentsRegistry = new AddedComponentsRegistry(apps);
  const exposedComponentsRegistry = new ExposedComponentsRegistry(apps);
  const addedLinksRegistry = new AddedLinksRegistry(apps);
  const addedFunctionsRegistry = new AddedFunctionsRegistry(apps);
  return { addedComponentsRegistry, addedFunctionsRegistry, addedLinksRegistry, exposedComponentsRegistry };
}

function registerCoreExtensions({ addedLinksRegistry, exposedComponentsRegistry }: PluginExtensionRegistries) {
  provisioning.setRegisterResourceKinds(addResourceKinds);

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
        id: PluginExtensionExposedComponents.PrometheusQueryResultsV1,
        title: 'Prometheus query results',
        description: 'Display Prometheus query results with Table/Raw toggle',
        component: PrometheusQueryResultsContainer,
      },
      {
        id: PluginExtensionExposedComponents.CreateAlertFromPanelV1,
        title: 'Create alert from panel',
        description: 'Modal to create an alert rule from panel data',
        component: CreateAlertFromPanelExposedComponentLazy,
      },
      {
        id: PluginExtensionExposedComponents.OpenQueryLibraryV1,
        title: 'Access to the Query Library',
        description: 'Access to the Query Library',
        component: OpenQueryLibraryExposedComponent,
      },
      {
        id: PluginExtensionExposedComponents.NotebookViewV1,
        title: 'Notebook',
        description: 'An editable notebook, for a host rendering one outside the notebooks route',
        component: NotebookViewLazy,
      },
      {
        id: provisioning.SaveResourceDrawerComponent,
        title: 'Save provisioned resource drawer',
        description: 'Commits a resource to a Git Sync repository',
        component: ProvisionedResourceDrawerExposedComponent,
      },
      {
        id: provisioning.ManagedBadgeComponent,
        title: 'Managed badge',
        description: 'Shows which system manages a resource',
        component: ManagedBadgeExposedComponent,
      },
    ],
  });
}

async function initPluginExtensionRegistries(): Promise<PluginExtensionRegistries> {
  const apps = await getAppPluginMetas();
  const registries = initRegistries(apps);
  registerCoreExtensions(registries);

  return registries;
}

/**
 * Gets the plugin extension registries, initializing them on first call.
 * This function is safe to call concurrently - multiple simultaneous calls will
 * all receive the same Promise instance, ensuring only one initialization.
 * If initialization (including getAppPluginMetas) fails, the error is logged and
 * empty plugin extension registries are returned as a fallback.
 * @returns Promise resolving to the plugin extension registries
 */
export async function getPluginExtensionRegistries(): Promise<PluginExtensionRegistries> {
  return getCachedPromise(initPluginExtensionRegistries, { defaultValue: initRegistries([]) });
}
