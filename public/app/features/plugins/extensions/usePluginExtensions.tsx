import { useMemo } from 'react';
import { useObservable } from 'react-use';

import { PluginExtension, usePluginContext } from '@grafana/data';
import { GetPluginExtensionsOptions, UsePluginExtensionsResult } from '@grafana/runtime';
import { useSidecar } from 'app/core/context/SidecarContext';

import { getPluginExtensions } from './getPluginExtensions';
import { PluginExtensionRegistries } from './registry/types';
import { isExtensionPointMetaInfoMissing, isGrafanaDevMode, logWarning } from './utils';
import { isExtensionPointIdValid } from './validators';

export function createUsePluginExtensions(registries: PluginExtensionRegistries) {
  const observableAddedComponentsRegistry = registries.addedComponentsRegistry.asObservable();
  const observableAddedLinksRegistry = registries.addedLinksRegistry.asObservable();

  return function usePluginExtensions(options: GetPluginExtensionsOptions): UsePluginExtensionsResult<PluginExtension> {
    const pluginContext = usePluginContext();
    const addedComponentsRegistry = useObservable(observableAddedComponentsRegistry);
    const addedLinksRegistry = useObservable(observableAddedLinksRegistry);
    const { activePluginId } = useSidecar();
    const { extensionPointId, context, limitPerPlugin } = options;

    const { extensions } = useMemo(() => {
      // For backwards compatibility we don't enable restrictions in production or when the hook is used in core Grafana.
      const enableRestrictions = isGrafanaDevMode() && pluginContext !== null;
      const pluginId = pluginContext?.meta.id ?? '';

      if (!addedLinksRegistry && !addedComponentsRegistry) {
        return { extensions: [], isLoading: false };
      }

      if (enableRestrictions && !isExtensionPointIdValid({ extensionPointId, pluginId })) {
        logWarning(
          `Extension point usePluginExtensions("${extensionPointId}") - the id should be prefixed with your plugin id ("${pluginId}/").`
        );
        return {
          isLoading: false,
          extensions: [],
        };
      }

      if (enableRestrictions && isExtensionPointMetaInfoMissing(extensionPointId, pluginContext)) {
        logWarning(
          `Invalid extension point. Reason: The extension point is not declared in the "plugin.json" file. ExtensionPointId: "${extensionPointId}"`
        );
        return {
          isLoading: false,
          extensions: [],
        };
      }

      return getPluginExtensions({
        extensionPointId,
        context,
        limitPerPlugin,
        addedComponentsRegistry,
        addedLinksRegistry,
      });
      // Doing the deps like this instead of just `option` because users probably aren't going to memoize the
      // options object so we are checking it's simple value attributes.
      // The context though still has to be memoized though and not mutated.
      // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO: refactor `getPluginExtensions` to accept service dependencies as arguments instead of relying on the sidecar singleton under the hood
    }, [
      addedLinksRegistry,
      addedComponentsRegistry,
      extensionPointId,
      context,
      limitPerPlugin,
      activePluginId,
      pluginContext,
    ]);

    return { extensions, isLoading: false };
  };
}
