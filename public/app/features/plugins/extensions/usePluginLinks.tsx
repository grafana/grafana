import { isString } from 'lodash';
import { useMemo } from 'react';
import { useObservable } from 'react-use';

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
      const extensions: PluginExtensionLink[] = [];
      const extensionsByPlugin: Record<string, number> = {};

      for (const addedLink of registry[extensionPointId] ?? []) {
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
          id: generateExtensionId(pluginId, extensionPointId, addedLink.title),
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
      }

      return {
        isLoading: false,
        links: extensions,
      };
    }, [context, extensionPointId, limitPerPlugin, registry]);
  };
}
