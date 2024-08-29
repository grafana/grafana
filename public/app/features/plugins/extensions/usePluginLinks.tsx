import { useMemo } from 'react';
import { useObservable } from 'react-use';
import { isString } from 'util';

import { PluginExtensionLink, PluginExtensionTypes } from '@grafana/data';
import {
  UsePluginLinksOptions,
  UsePluginLinksResult,
} from '@grafana/runtime/src/services/pluginExtensions/getPluginExtensions';

import { AddedLinksRegistry } from './registry/AddedLinksRegistry';
import {
  generateExtensionId,
  getLinkExtensionOnClick,
  getLinkExtensionOverrides,
  getLinkExtensionPathWithTracking,
  getReadOnlyProxy,
  logWarning,
} from './utils';

// Returns an array of component extensions for the given extension point
export function createUsePluginLinks(registry: AddedLinksRegistry) {
  const observableRegistry = registry.asObservable();

  return function usePluginLinks({
    limitPerPlugin,
    extensionPointId,
    context,
  }: UsePluginLinksOptions): UsePluginLinksResult {
    const registry = useObservable(observableRegistry);

    return useMemo(() => {
      if (!registry || !registry[extensionPointId]) {
        return {
          isLoading: false,
          links: [],
        };
      }
      const frozenContext = context ? getReadOnlyProxy(context) : {};
      // We don't return the extensions separated by type, because in that case it would be much harder to define a sort-order for them.
      const extensions: PluginExtensionLink[] = [];
      const extensionsByPlugin: Record<string, number> = {};

      for (const addedLink of registry[extensionPointId] ?? []) {
        try {
          const { pluginId } = addedLink;
          // Only limit if the `limitPerPlugin` is set
          if (limitPerPlugin && extensionsByPlugin[pluginId] >= limitPerPlugin) {
            continue;
          }

          if (extensionsByPlugin[pluginId] === undefined) {
            extensionsByPlugin[pluginId] = 0;
          }

          // Run the configure() function with the current context, and apply the ovverides
          const overrides = getLinkExtensionOverrides(pluginId, addedLink, frozenContext);

          // configure() returned an `undefined` -> hide the extension
          if (addedLink.configure && overrides === undefined) {
            continue;
          }

          const path = overrides?.path || addedLink.path;
          const extension: PluginExtensionLink = {
            id: generateExtensionId(pluginId, {
              ...addedLink,
              extensionPointId,
              type: PluginExtensionTypes.link,
            }),
            type: PluginExtensionTypes.link,
            pluginId: pluginId,
            onClick: getLinkExtensionOnClick(pluginId, extensionPointId, addedLink, frozenContext),

            // Configurable properties
            icon: overrides?.icon || addedLink.icon,
            title: overrides?.title || addedLink.title,
            description: overrides?.description || addedLink.description,
            path: isString(path) ? getLinkExtensionPathWithTracking(pluginId, path, extensionPointId) : undefined,
            category: overrides?.category || addedLink.category,
          };

          extensions.push(extension);
          extensionsByPlugin[pluginId] += 1;
        } catch (error) {
          if (error instanceof Error) {
            logWarning(error.message);
          }
        }
      }

      return {
        isLoading: false,
        links: extensions,
      };
    }, [context, extensionPointId, limitPerPlugin, registry]);
  };
}
