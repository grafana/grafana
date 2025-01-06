import { isString } from 'lodash';

import {
  type PluginExtension,
  PluginExtensionTypes,
  type PluginExtensionLink,
  type PluginExtensionComponent,
} from '@grafana/data';
import { GetPluginExtensions } from '@grafana/runtime';

import { log } from './logs/log';
import { AddedComponentRegistryItem } from './registry/AddedComponentsRegistry';
import { AddedLinkRegistryItem } from './registry/AddedLinksRegistry';
import { RegistryType } from './registry/Registry';
import type { PluginExtensionRegistries } from './registry/types';
import {
  getReadOnlyProxy,
  generateExtensionId,
  wrapWithPluginContext,
  getLinkExtensionOnClick,
  getLinkExtensionOverrides,
  getLinkExtensionPathWithTracking,
} from './utils';

type GetExtensions = ({
  context,
  extensionPointId,
  limitPerPlugin,
  addedLinksRegistry,
  addedComponentsRegistry,
}: {
  context?: object | Record<string | symbol, unknown>;
  extensionPointId: string;
  limitPerPlugin?: number;
  addedComponentsRegistry: RegistryType<AddedComponentRegistryItem[]> | undefined;
  addedLinksRegistry: RegistryType<AddedLinkRegistryItem[]> | undefined;
}) => { extensions: PluginExtension[] };

export function createPluginExtensionsGetter(registries: PluginExtensionRegistries): GetPluginExtensions {
  let addedComponentsRegistry: RegistryType<AddedComponentRegistryItem[]>;
  let addedLinksRegistry: RegistryType<Array<AddedLinkRegistryItem<object>>>;

  // Create registry subscriptions to keep an copy of the registry state for use in the non-async
  // plugin extensions getter.
  registries.addedComponentsRegistry.asObservable().subscribe((componentsRegistry) => {
    addedComponentsRegistry = componentsRegistry;
  });

  registries.addedLinksRegistry.asObservable().subscribe((linksRegistry) => {
    addedLinksRegistry = linksRegistry;
  });

  return (options) => getPluginExtensions({ ...options, addedComponentsRegistry, addedLinksRegistry });
}

// Returns with a list of plugin extensions for the given extension point
export const getPluginExtensions: GetExtensions = ({
  context,
  extensionPointId,
  limitPerPlugin,
  addedLinksRegistry,
  addedComponentsRegistry,
}) => {
  const frozenContext = context ? getReadOnlyProxy(context) : {};
  // We don't return the extensions separated by type, because in that case it would be much harder to define a sort-order for them.
  const extensions: PluginExtension[] = [];
  const extensionsByPlugin: Record<string, number> = {};

  for (const addedLink of addedLinksRegistry?.[extensionPointId] ?? []) {
    try {
      const { pluginId } = addedLink;
      // Only limit if the `limitPerPlugin` is set
      if (limitPerPlugin && extensionsByPlugin[pluginId] >= limitPerPlugin) {
        continue;
      }

      if (extensionsByPlugin[pluginId] === undefined) {
        extensionsByPlugin[pluginId] = 0;
      }

      const linkLog = log.child({
        pluginId,
        extensionPointId,
        path: addedLink.path ?? '',
        title: addedLink.title,
        description: addedLink.description ?? '',
        onClick: typeof addedLink.onClick,
      });
      // Run the configure() function with the current context, and apply the ovverides
      const overrides = getLinkExtensionOverrides(pluginId, addedLink, linkLog, frozenContext);

      // configure() returned an `undefined` -> hide the extension
      if (addedLink.configure && overrides === undefined) {
        continue;
      }

      const path = overrides?.path || addedLink.path;
      const extension: PluginExtensionLink = {
        id: generateExtensionId(pluginId, extensionPointId, addedLink.title),
        type: PluginExtensionTypes.link,
        pluginId: pluginId,
        onClick: getLinkExtensionOnClick(pluginId, extensionPointId, addedLink, linkLog, frozenContext),

        // Configurable properties
        icon: overrides?.icon || addedLink.icon,
        title: overrides?.title || addedLink.title,
        description: overrides?.description || addedLink.description || '',
        path: isString(path) ? getLinkExtensionPathWithTracking(pluginId, path, extensionPointId) : undefined,
        category: overrides?.category || addedLink.category,
      };

      extensions.push(extension);
      extensionsByPlugin[pluginId] += 1;
    } catch (error) {
      if (error instanceof Error) {
        log.error(error.message, {
          stack: error.stack ?? '',
          message: error.message,
        });
      }
    }
  }

  const addedComponents = addedComponentsRegistry?.[extensionPointId] ?? [];
  for (const addedComponent of addedComponents) {
    // Only limit if the `limitPerPlugin` is set
    if (limitPerPlugin && extensionsByPlugin[addedComponent.pluginId] >= limitPerPlugin) {
      continue;
    }

    if (extensionsByPlugin[addedComponent.pluginId] === undefined) {
      extensionsByPlugin[addedComponent.pluginId] = 0;
    }

    const componentLog = log.child({
      title: addedComponent.title,
      description: addedComponent.description ?? '',
      pluginId: addedComponent.pluginId,
    });

    const extension: PluginExtensionComponent = {
      id: generateExtensionId(addedComponent.pluginId, extensionPointId, addedComponent.title),
      type: PluginExtensionTypes.component,
      pluginId: addedComponent.pluginId,
      title: addedComponent.title,
      description: addedComponent.description ?? '',
      component: wrapWithPluginContext(addedComponent.pluginId, addedComponent.component, componentLog),
    };

    extensions.push(extension);
    extensionsByPlugin[addedComponent.pluginId] += 1;
  }

  return { extensions };
};
