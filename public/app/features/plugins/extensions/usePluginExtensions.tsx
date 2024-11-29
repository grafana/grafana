import { useMemo } from 'react';
import { useObservable } from 'react-use';

import { PluginExtension, usePluginContext } from '@grafana/data';
import { GetPluginExtensionsOptions, UsePluginExtensionsResult } from '@grafana/runtime';

import * as errors from './errors';
import { getPluginExtensions } from './getPluginExtensions';
import { log } from './logs/log';
import { PluginExtensionRegistries } from './registry/types';
import { useLoadAppPlugins } from './useLoadAppPlugins';
import { getExtensionPointPluginDependencies, isGrafanaDevMode } from './utils';
import { isExtensionPointIdValid, isExtensionPointMetaInfoMissing } from './validators';

export function createUsePluginExtensions(registries: PluginExtensionRegistries) {
  const observableAddedComponentsRegistry = registries.addedComponentsRegistry.asObservable();
  const observableAddedLinksRegistry = registries.addedLinksRegistry.asObservable();

  return function usePluginExtensions(options: GetPluginExtensionsOptions): UsePluginExtensionsResult<PluginExtension> {
    const pluginContext = usePluginContext();
    const addedComponentsRegistry = useObservable(observableAddedComponentsRegistry);
    const addedLinksRegistry = useObservable(observableAddedLinksRegistry);
    const { extensionPointId, context, limitPerPlugin } = options;
    const { isLoading: isLoadingAppPlugins } = useLoadAppPlugins(getExtensionPointPluginDependencies(extensionPointId));

    return useMemo(() => {
      // For backwards compatibility we don't enable restrictions in production or when the hook is used in core Grafana.
      const enableRestrictions = isGrafanaDevMode() && pluginContext !== null;
      const pluginId = pluginContext?.meta.id ?? '';
      const pointLog = log.child({
        pluginId,
        extensionPointId,
      });

      if (!addedLinksRegistry && !addedComponentsRegistry) {
        return { extensions: [], isLoading: false };
      }

      if (enableRestrictions && !isExtensionPointIdValid({ extensionPointId, pluginId })) {
        pointLog.error(errors.INVALID_EXTENSION_POINT_ID);
        return {
          isLoading: false,
          extensions: [],
        };
      }

      if (enableRestrictions && isExtensionPointMetaInfoMissing(extensionPointId, pluginContext)) {
        pointLog.error(errors.EXTENSION_POINT_META_INFO_MISSING);
        return {
          isLoading: false,
          extensions: [],
        };
      }

      if (isLoadingAppPlugins) {
        return {
          isLoading: true,
          extensions: [],
        };
      }

      const { extensions } = getPluginExtensions({
        extensionPointId,
        context,
        limitPerPlugin,
        addedComponentsRegistry,
        addedLinksRegistry,
      });

      return { extensions, isLoading: false };

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
      pluginContext,
      isLoadingAppPlugins,
    ]);
  };
}
