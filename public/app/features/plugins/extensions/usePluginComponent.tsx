import { useMemo } from 'react';
import { useObservable } from 'react-use';

import { usePluginContext } from '@grafana/data';
import { UsePluginComponentResult } from '@grafana/runtime';

import { useExposedComponentsRegistry } from './ExtensionRegistriesContext';
import { log } from './logs/log';
import { isExposedComponentDependencyMissing, isGrafanaDevMode, wrapWithPluginContext } from './utils';

// Returns a component exposed by a plugin.
// (Exposed components can be defined in plugins by calling .exposeComponent() on the AppPlugin instance.)
export function usePluginComponent<Props extends object = {}>(id: string): UsePluginComponentResult<Props> {
  const registry = useExposedComponentsRegistry();
  const registryState = useObservable(registry.asObservable());
  const pluginContext = usePluginContext();

  return useMemo(() => {
    // For backwards compatibility we don't enable restrictions in production or when the hook is used in core Grafana.
    const enableRestrictions = isGrafanaDevMode() && pluginContext;

    if (!registryState?.[id]) {
      return {
        isLoading: false,
        component: null,
      };
    }

    const registryItem = registryState[id];
    const componentLog = log.child({
      title: registryItem.title,
      description: registryItem.description ?? '',
      pluginId: registryItem.pluginId,
    });

    if (enableRestrictions && isExposedComponentDependencyMissing(id, pluginContext, componentLog)) {
      componentLog.warning(
        `usePluginComponent("${id}") - The exposed component ("${id}") is missing from the dependencies[] in the "plugin.json" file.`
      );
      return {
        isLoading: false,
        component: null,
      };
    }

    return {
      isLoading: false,
      component: wrapWithPluginContext(registryItem.pluginId, registryItem.component, componentLog),
    };
  }, [id, pluginContext, registryState]);
}
