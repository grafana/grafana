/* eslint-disable @grafana/i18n/no-untranslated-strings */
import { type AppPluginConfig, PluginExtensionExposedComponents, PluginExtensionPoints } from '@grafana/data';
import { getAppPluginMetas, getCachedPromise } from '@grafana/runtime/internal';
import CentralAlertHistorySceneExposedComponent from 'app/features/alerting/unified/components/rules/central-state-history/CentralAlertHistorySceneExposedComponent';
import { CreateAlertFromPanelExposedComponentLazy } from 'app/features/alerting/unified/extensions/CreateAlertFromPanelExposedComponentLazy';
import { AddToDashboardFormExposedComponent } from 'app/features/dashboard-scene/addToDashboard/AddToDashboardFormExposedComponent';
import { OpenQueryLibraryExposedComponent } from 'app/features/explore/QueryLibrary/OpenQueryLibraryExposedComponent';
import { PrometheusQueryResultsContainer } from 'app/features/explore/RawPrometheus/PrometheusQueryResultsContainer';
import { NotebookViewLazy } from 'app/features/notebook/embed/NotebookViewLazy';
import { NotebookCaptureSidebarLazy } from 'app/features/notebook/sidebar/NotebookCaptureSidebarLazy';
import { NOTEBOOK_CAPTURE_SIDEBAR_TITLE } from 'app/features/notebook/sidebar/getNotebookCaptureSidebarExtension';

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

function registerCoreExtensions({
  addedComponentsRegistry,
  addedLinksRegistry,
  exposedComponentsRegistry,
}: PluginExtensionRegistries) {
  // Registering core extension links
  addedLinksRegistry.register({
    pluginId: 'grafana',
    configs: getCoreExtensionConfigurations(),
  });

  addedComponentsRegistry.register({
    pluginId: 'grafana',
    configs: [
      {
        targets: [PluginExtensionPoints.ExtensionSidebar],
        title: NOTEBOOK_CAPTURE_SIDEBAR_TITLE,
        description: 'Capture notes in a notebook without leaving your current view',
        component: NotebookCaptureSidebarLazy,
      },
    ],
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
