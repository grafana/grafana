import { useMemo } from 'react';

import { usePluginContext, PluginExtensionFunction, PluginExtensionTypes } from '@grafana/data';
import { UsePluginFunctionsOptions, UsePluginFunctionsResult } from '@grafana/runtime';
import { evaluateBooleanFlag } from '@grafana/runtime/internal';

import { getExtensionPointPluginDependencies as getExtensionPointPluginDependenciesFromApps } from './appUtils';
import { useAddedFunctionsRegistrySlice } from './registry/useRegistrySlice';
import { useLoadAppPluginsWithPredicate } from './useLoadAppPluginsWithPredicate';
import { generateExtensionId, getExtensionPointPluginDependencies } from './utils';
import { validateExtensionPoint } from './validateExtensionPoint';

// Returns an array of component extensions for the given extension point
export function usePluginFunctions<Signature>({
  limitPerPlugin,
  extensionPointId,
}: UsePluginFunctionsOptions): UsePluginFunctionsResult<Signature> {
  const registryItems = useAddedFunctionsRegistrySlice<Signature>(extensionPointId);
  const pluginContext = usePluginContext();
  const predicate = evaluateBooleanFlag('useMTAppsLoading', false)
    ? getExtensionPointPluginDependenciesFromApps
    : getExtensionPointPluginDependencies;
  const { isLoading: isLoadingAppPlugins } = useLoadAppPluginsWithPredicate(extensionPointId, predicate);

  return useMemo(() => {
    const { result } = validateExtensionPoint({ extensionPointId, pluginContext, isLoadingAppPlugins });

    if (result) {
      return {
        isLoading: result.isLoading,
        functions: [],
      };
    }

    const results: Array<PluginExtensionFunction<Signature>> = [];
    const extensionsByPlugin: Record<string, number> = {};

    for (const registryItem of registryItems ?? []) {
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
        fn: registryItem.fn,
      });
      extensionsByPlugin[pluginId] += 1;
    }

    return {
      isLoading: false,
      functions: results,
    };
  }, [extensionPointId, limitPerPlugin, pluginContext, registryItems, isLoadingAppPlugins]);
}
