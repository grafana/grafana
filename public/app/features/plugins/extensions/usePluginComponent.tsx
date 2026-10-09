import { useMemo } from 'react';

import { usePluginContext } from '@grafana/data';
import { type UsePluginComponentResult } from '@grafana/runtime';

import * as errors from './errors';
import { isGrafanaDevMode } from './isGrafanaDevMode';
import { log } from './logs/log';
import { useExposedComponentRegistrySlice } from './registry/useRegistrySlice';
import { useLoadAppPlugins } from './useLoadAppPlugins';
import { getExposedComponentPluginDependencies, wrapWithPluginContext } from './utils';
import { isExposedComponentDependencyMissing } from './validators';

// Returns a component exposed by a plugin.
// (Exposed components can be defined in plugins by calling .exposeComponent() on the AppPlugin instance.)
export function usePluginComponent<Props extends object = {}>(id: string): UsePluginComponentResult<Props> {
  const registryItem = useExposedComponentRegistrySlice<Props>(id);
  const pluginContext = usePluginContext();
  const { isLoading: isLoadingAppPlugins } = useLoadAppPlugins(id, getExposedComponentPluginDependencies);

  // A fresh caller context must not create a new React component type and discard
  // the exposed component's local state. Only its registry entry owns that identity.
  const extension = useMemo(() => {
    if (!registryItem) {
      return null;
    }
    const componentLog = log.child({
      title: registryItem.title,
      description: registryItem.description ?? '',
      pluginId: registryItem.pluginId,
    });
    return {
      log: componentLog,
      component: wrapWithPluginContext({
        pluginId: registryItem.pluginId,
        extensionTitle: registryItem.title,
        Component: registryItem.component,
        log: componentLog,
      }),
    };
  }, [registryItem]);

  return useMemo(() => {
    // For backwards compatibility we don't enable restrictions in production or when the hook is used in core Grafana.
    const enableRestrictions = isGrafanaDevMode() && pluginContext;

    if (isLoadingAppPlugins) {
      return {
        isLoading: true,
        component: null,
      };
    }

    if (!extension) {
      return {
        isLoading: false,
        component: null,
      };
    }

    if (enableRestrictions && isExposedComponentDependencyMissing(id, pluginContext)) {
      extension.log.error(errors.EXPOSED_COMPONENT_DEPENDENCY_MISSING);
      return {
        isLoading: false,
        component: null,
      };
    }

    return {
      isLoading: false,
      component: extension.component,
    };
  }, [id, pluginContext, extension, isLoadingAppPlugins]);
}
