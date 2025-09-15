import { useMemo } from 'react';
import { useObservable } from 'react-use';

import { usePluginContext, PluginExtensionFunction, PluginExtensionTypes } from '@grafana/data';
import { UsePluginFunctionsOptions, UsePluginFunctionsResult } from '@grafana/runtime';

import { useAddedFunctionsRegistry } from './ExtensionRegistriesContext';
import { useLoadAppPlugins } from './useLoadAppPlugins';
import { generateExtensionId, getExtensionPointPluginDependencies } from './utils';
import { validateExtensionPoint } from './validateExtensionPoint';

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
    const { result } = validateExtensionPoint({ extensionPointId, pluginContext, isLoadingAppPlugins });

    if (result) {
      return {
        isLoading: result.isLoading,
        functions: [],
      };
    }

    const results: Array<PluginExtensionFunction<Signature>> = [];
    const extensionsByPlugin: Record<string, number> = {};

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
