import { useMemo } from 'react';
import { useObservable } from 'react-use';

import {
  UsePluginComponentOptions,
  UsePluginComponentsResult,
} from '@grafana/runtime/src/services/pluginExtensions/getPluginExtensions';

import { AddedComponentsRegistry } from './registry/AddedComponentsRegistry';

// Returns an array of component extensions for the given extension point
export function createUsePluginComponents(registry: AddedComponentsRegistry) {
  const observableRegistry = registry.asObservable();

  return function usePluginComponents<Props extends object = {}>({
    limitPerPlugin,
    extensionPointId,
  }: UsePluginComponentOptions): UsePluginComponentsResult<Props> {
    const registry = useObservable(observableRegistry);

    return useMemo(() => {
      if (!registry || !registry[extensionPointId]) {
        return {
          isLoading: false,
          components: [],
        };
      }
      const components: Array<React.ComponentType<Props>> = [];
      const registryItems = registry[extensionPointId];
      const extensionsByPlugin: Record<string, number> = {};
      for (const registryItem of registryItems) {
        const { pluginId } = registryItem;

        // Only limit if the `limitPerPlugin` is set
        if (limitPerPlugin && extensionsByPlugin[pluginId] >= limitPerPlugin) {
          continue;
        }

        if (extensionsByPlugin[pluginId] === undefined) {
          extensionsByPlugin[pluginId] = 0;
        }

        components.push(registryItem.component as React.ComponentType<Props>);
        extensionsByPlugin[pluginId] += 1;
      }

      return {
        isLoading: false,
        components,
      };
    }, [extensionPointId, limitPerPlugin, registry]);
  };
}
