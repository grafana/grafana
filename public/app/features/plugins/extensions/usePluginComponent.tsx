import { useMemo } from 'react';
import { useObservable } from 'react-use';

import { usePluginContext } from '@grafana/data';
import { UsePluginComponentResult } from '@grafana/runtime';

import { useExposedComponentsRegistry } from './ExtensionRegistriesContext';
import * as errors from './errors';
import { log } from './logs/log';
import { useLoadAppPlugins } from './useLoadAppPlugins';
import { getExposedComponentPluginDependencies, isGrafanaDevMode, wrapWithPluginContext } from './utils';
import { isExposedComponentDependencyMissing } from './validators';

// Returns a component exposed by a plugin.
// (Exposed components can be defined in plugins by calling .exposeComponent() on the AppPlugin instance.)
export function usePluginComponent<Props extends object = {}>(id: string): UsePluginComponentResult<Props> {
  const registry = useExposedComponentsRegistry();
  const registryState = useObservable(registry.asObservable());
  const pluginContext = usePluginContext();
  const { isLoading: isLoadingAppPlugins } = useLoadAppPlugins(getExposedComponentPluginDependencies(id));

  return useMemo(() => {
    // For backwards compatibility we don't enable restrictions in production or when the hook is used in core Grafana.
    const enableRestrictions = isGrafanaDevMode() && pluginContext;

    if (isLoadingAppPlugins) {
      return {
        isLoading: true,
        component: null,
      };
    }

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

    if (enableRestrictions && isExposedComponentDependencyMissing(id, pluginContext)) {
      componentLog.error(errors.EXPOSED_COMPONENT_DEPENDENCY_MISSING);
      return {
        isLoading: false,
        component: null,
      };
    }

    return {
      isLoading: false,
      component: wrapWithPluginContext(registryItem.pluginId, registryItem.component, componentLog),
    };
  }, [id, pluginContext, registryState, isLoadingAppPlugins]);
}
