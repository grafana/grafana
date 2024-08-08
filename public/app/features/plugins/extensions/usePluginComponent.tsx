import { useMemo } from 'react';
import { useObservable } from 'react-use';

import { UsePluginComponentResult } from '@grafana/runtime';

import { ExposedComponentRegistry } from './registry/ExposedComponentRegistry';
import { wrapWithPluginContext } from './utils';

// Returns a component exposed by a plugin.
// (Exposed components can be defined in plugins by calling .exposeComponent() on the AppPlugin instance.)
export function createUsePluginComponent(registry: ExposedComponentRegistry) {
  const observableRegistry = registry.asObservable();

  return function usePluginComponent<Props extends object = {}>(id: string): UsePluginComponentResult<Props> {
    const registry = useObservable(observableRegistry);

    return useMemo(() => {
      if (!registry) {
        return {
          isLoading: false,
          component: null,
        };
      }

      const registryItem = registry[id];

      return {
        isLoading: false,
        component: wrapWithPluginContext(registryItem.pluginId, registryItem.component),
      };
    }, [id, registry]);
  };
}
