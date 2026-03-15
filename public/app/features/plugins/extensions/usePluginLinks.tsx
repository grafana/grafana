import { useMemo } from 'react';

import { PluginExtensionLink, usePluginContext } from '@grafana/data';
import { UsePluginLinksOptions, UsePluginLinksResult } from '@grafana/runtime';

import { useAddedLinksRegistrySlice } from './registry/useRegistrySlice';
import { useLoadAppPlugins } from './useLoadAppPlugins';
import {
  addedLinkToExtensionLink,
  getExtensionPointPluginDependencies,
  getLinkExtensionOverrides,
  getReadOnlyProxy,
} from './utils';
import { validateExtensionPoint } from './validateExtensionPoint';

// Returns an array of component extensions for the given extension point
export function usePluginLinks({
  limitPerPlugin,
  extensionPointId,
  context,
}: UsePluginLinksOptions): UsePluginLinksResult {
  const registryItems = useAddedLinksRegistrySlice(extensionPointId);
  const pluginContext = usePluginContext();
  const { isLoading: isLoadingAppPlugins } = useLoadAppPlugins(extensionPointId, getExtensionPointPluginDependencies);

  return useMemo(() => {
    const { result, pointLog } = validateExtensionPoint({
      extensionPointId,
      pluginContext,
      isLoadingAppPlugins,
    });

    if (result) {
      return {
        isLoading: result.isLoading,
        links: [],
      };
    }

    const frozenContext = context ? getReadOnlyProxy(context) : {};
    const extensions: PluginExtensionLink[] = [];
    const extensionsByPlugin: Record<string, number> = {};

    for (const addedLink of registryItems ?? []) {
      const { pluginId } = addedLink;
      const linkLog = pointLog.child({
        path: addedLink.path ?? '',
        title: addedLink.title,
        description: addedLink.description ?? '',
        onClick: typeof addedLink.onClick,
        openInNewTab: addedLink.openInNewTab ? 'true' : 'false',
      });

      // Only limit if the `limitPerPlugin` is set
      if (limitPerPlugin && extensionsByPlugin[pluginId] >= limitPerPlugin) {
        linkLog.debug(`Skipping link extension from plugin "${pluginId}". Reason: Limit reached.`);
        continue;
      }

      if (extensionsByPlugin[pluginId] === undefined) {
        extensionsByPlugin[pluginId] = 0;
      }

      // Run the configure() function with the current context, and apply the ovverides
      const overrides = getLinkExtensionOverrides(pluginId, addedLink, linkLog, frozenContext);

      // configure() returned an `undefined` -> hide the extension
      if (addedLink.configure && overrides === undefined) {
        continue;
      }

      const extension = addedLinkToExtensionLink(
        pluginId,
        extensionPointId,
        addedLink,
        overrides,
        linkLog,
        frozenContext
      );
      extensions.push(extension);
      extensionsByPlugin[pluginId] += 1;
    }

    return {
      isLoading: false,
      links: extensions,
    };
  }, [context, extensionPointId, limitPerPlugin, registryItems, pluginContext, isLoadingAppPlugins]);
}
