import { isEqual, isString } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';

import { PluginExtensionLink, PluginExtensionLinkUpdate, PluginExtensionTypes, usePluginContext } from '@grafana/data';
import { UsePluginLinksOptions, UsePluginLinksResult } from '@grafana/runtime';

import { useAddedLinksRegistrySlice } from './registry/useRegistrySlice';
import { useLoadAppPlugins } from './useLoadAppPlugins';
import {
  createAddedLinkLog,
  generateExtensionId,
  getExtensionPointPluginDependencies,
  getLinkExtensionOnClick,
  getLinkExtensionOverrides,
  getLinkExtensionPathWithTracking,
  getReadOnlyProxy,
  useExtensionPointLog,
} from './utils';
import { validateExtensionPoint } from './validateExtensionPoint';

type LinkOverrides = Record<string, Partial<PluginExtensionLinkUpdate<object>> | undefined>;

// Returns an array of component extensions for the given extension point
export function usePluginLinks({
  limitPerPlugin,
  extensionPointId,
  context: contextProp,
}: UsePluginLinksOptions): UsePluginLinksResult {
  const registryItems = useAddedLinksRegistrySlice(extensionPointId);
  // Context:
  // - protecting against inline object definitions at the call-site
  // - protecting against mutating the common context object by freezing it
  const pluginContext = usePluginContext();
  const prevContext = useRef<typeof context>();
  const [context, setContext] = useState<typeof contextProp>();
  // Preloding app plugins that register links to this extension point
  const { isLoading: isLoadingAppPlugins } = useLoadAppPlugins(getExtensionPointPluginDependencies(extensionPointId));
  const extensionPointLog = useExtensionPointLog(extensionPointId);
  // Link overrides (implemented in the .configure() method) can be async as well.
  const [linkOverrides, setLinkOverrides] = useState<LinkOverrides>({});
  const linkOverridesRef = useRef<LinkOverrides>();
  const [isLoadingLinkOverrides, setIsLoadingLinkOverrides] = useState(false);

  // Context object equality check
  // (Ideally the callsite passes in a memoized object, or an object that doesn't change between rerenders.)
  useEffect(() => {
    if (prevContext.current === undefined || !isEqual(prevContext.current, contextProp)) {
      prevContext.current = contextProp;
      setContext(getReadOnlyProxy(contextProp ?? {}));
    }
  }, [contextProp]);

  // Extension point validation
  const { result: validationResult } = useMemo(
    () =>
      validateExtensionPoint({
        extensionPointId,
        pluginContext,
        isLoadingAppPlugins,
        extensionPointLog,
      }),
    [extensionPointId, extensionPointLog, pluginContext, isLoadingAppPlugins]
  );

  // Link overrides
  // (Links can implement a sync / async configure() function to update the links metadata whenever the `context` object changes.)
  useEffect(() => {
    if (validationResult) {
      return;
    }

    setIsLoadingLinkOverrides(true);

    Promise.all(
      (registryItems ?? [])
        .filter((addedLink) => addedLink.configure)
        .map(async (addedLink) => {
          const id = generateExtensionId(addedLink.pluginId, extensionPointId, addedLink.title);
          const overrides = await getLinkExtensionOverrides(
            addedLink,
            createAddedLinkLog(addedLink, extensionPointLog),
            context
          );
          const updatedLinkOverrides = {
            ...(linkOverridesRef.current ?? {}),
            [id]: overrides,
          };

          setLinkOverrides(updatedLinkOverrides);
          linkOverridesRef.current = updatedLinkOverrides;
        })
    ).then(() => {
      setIsLoadingLinkOverrides(false);
    });
  }, [registryItems, extensionPointId, context, extensionPointLog, validationResult, setLinkOverrides]);

  // Compute links
  return useMemo(() => {
    const extensions: PluginExtensionLink[] = [];
    const extensionsByPlugin: Record<string, number> = {};

    if (validationResult) {
      return {
        isLoading: validationResult.isLoading,
        links: [],
      };
    }

    for (const addedLink of registryItems ?? []) {
      const { pluginId } = addedLink;
      const linkLog = createAddedLinkLog(addedLink, extensionPointLog);

      // Only limit if the `limitPerPlugin` is set
      if (limitPerPlugin && extensionsByPlugin[pluginId] >= limitPerPlugin) {
        linkLog.debug(`Skipping link extension from plugin "${pluginId}". Reason: Limit reached.`);
        continue;
      }

      if (extensionsByPlugin[pluginId] === undefined) {
        extensionsByPlugin[pluginId] = 0;
      }

      const id = generateExtensionId(pluginId, extensionPointId, addedLink.title);
      const hasOverride = Object.hasOwn(linkOverrides, id);
      const override = linkOverrides[id];

      // configure() returned an `undefined` -> hide the extension
      if (addedLink.configure && hasOverride && override === undefined) {
        continue;
      }

      const path = override?.path || addedLink.path;
      const extension: PluginExtensionLink = {
        id,
        type: PluginExtensionTypes.link,
        pluginId: pluginId,
        onClick: getLinkExtensionOnClick(pluginId, extensionPointId, addedLink, linkLog, context),

        // Configurable properties
        icon: override?.icon || addedLink.icon,
        title: override?.title || addedLink.title,
        description: override?.description || addedLink.description || '',
        path: isString(path) ? getLinkExtensionPathWithTracking(pluginId, path, extensionPointId) : undefined,
        category: override?.category || addedLink.category,
      };

      extensions.push(extension);
      extensionsByPlugin[pluginId] += 1;
    }

    return {
      isLoading: isLoadingLinkOverrides || isLoadingAppPlugins,
      links: extensions,
    };
  }, [
    extensionPointId,
    limitPerPlugin,
    registryItems,
    extensionPointLog,
    context,
    isLoadingAppPlugins,
    isLoadingLinkOverrides,
    linkOverrides,
    validationResult,
  ]);
}
