import { useMemo } from 'react';
import { useObservable } from 'react-use';

import { usePluginContext, PluginExtensionFunction, PluginExtensionTypes } from '@grafana/data';
import { UsePluginFunctionsOptions, UsePluginFunctionsResult } from '@grafana/runtime';

import { useAddedFunctionsRegistry } from './ExtensionRegistriesContext';
import * as errors from './errors';
import { log } from './logs/log';
import { useLoadAppPlugins } from './useLoadAppPlugins';
import { generateExtensionId, getExtensionPointPluginDependencies, isGrafanaDevMode } from './utils';
import { isExtensionPointIdValid, isExtensionPointMetaInfoMissing } from './validators';

// Returns an array of component extensions for the given extension point
export function usePluginFunctions<Signature>({
  limitPerPlugin,
  extensionPointId,
}: UsePluginFunctionsOptions): UsePluginFunctionsResult<Signature> {
  const registry = useAddedFunctionsRegistry();
  const registryState = useObservable(registry.asObservable());
  const pluginContext = usePluginContext();
  const deps = getExtensionPointPluginDependencies(extensionPointId);
  const { isLoading: isLoadingAppPlugins } = useLoadAppPlugins(deps);

  return useMemo(() => {
    const isInsidePlugin = Boolean(pluginContext);
    const isCoreGrafanaPlugin = pluginContext?.meta.module.startsWith('core:') ?? false;
    const results: Array<PluginExtensionFunction<Signature>> = [];
    const extensionsByPlugin: Record<string, number> = {};
    const pluginId = pluginContext?.meta.id ?? '';
    const pointLog = log.child({
      pluginId,
      extensionPointId,
    });

    if (
      isGrafanaDevMode() &&
      !isExtensionPointIdValid({ extensionPointId, pluginId, isInsidePlugin, isCoreGrafanaPlugin, log: pointLog })
    ) {
      return {
        isLoading: false,
        functions: [],
      };
    }

    if (isGrafanaDevMode() && pluginContext && isExtensionPointMetaInfoMissing(extensionPointId, pluginContext)) {
      pointLog.error(errors.EXTENSION_POINT_META_INFO_MISSING);
      return {
        isLoading: false,
        functions: [],
      };
    }

    if (isLoadingAppPlugins) {
      return {
        isLoading: true,
        functions: [],
      };
    }

    for (const registryItem of registryState?.[extensionPointId] ?? []) {
      const { pluginId } = registryItem;

      // Only limit if the `limitPerPlugin` is set
      if (limitPerPlugin && extensionsByPlugin[pluginId] >= limitPerPlugin) {
        continue;
      }

      if (extensionsByPlugin[pluginId] === undefined) {
        extensionsByPlugin[pluginId] = 0;
      }

      results.push({
        id: generateExtensionId(pluginId, extensionPointId, registryItem.title),
        type: PluginExtensionTypes.function,
        title: registryItem.title,
        description: registryItem.description ?? '',
        pluginId: pluginId,
        fn: registryItem.fn as Signature,
      });
      extensionsByPlugin[pluginId] += 1;
    }

    return {
      isLoading: false,
      functions: results,
    };
  }, [extensionPointId, limitPerPlugin, pluginContext, registryState, isLoadingAppPlugins]);
}
