import { useMemo } from 'react';

import { type ComponentDescriptor, usePluginContext } from '@grafana/data';
import { type UsePluginComponentResult } from '@grafana/runtime';

import { ExposedComponentOriginContext, useExposedComponentOriginPluginId } from './ExposedComponentOriginContext';
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
  return useResolvedComponent<Props>(id);
}

// Core-only: CatalogPreview passes a descriptor from the validated registry, never a caller-supplied owner.
export function useCatalogComponent<Props extends object>(entry: ComponentDescriptor) {
  return useResolvedComponent<Props>(entry.id, entry.pluginId);
}

function useResolvedComponent<Props extends object>(
  id: string,
  catalogOwner?: string
): UsePluginComponentResult<Props> {
  const registryItem = useExposedComponentRegistrySlice<Props>(id);
  const pluginContext = usePluginContext();
  const inheritedOrigin = useExposedComponentOriginPluginId();
  const originPluginId = pluginContext?.meta.id === 'grafana' ? inheritedOrigin : pluginContext?.meta.id;
  const { isLoading: isLoadingAppPlugins } = useLoadAppPlugins(id, getExposedComponentPluginDependencies);

  // Depend on the caller ID, not its context object, so metadata refreshes preserve local edits.
  const extension = useMemo(() => {
    if (!registryItem || (catalogOwner !== undefined && registryItem.pluginId !== catalogOwner)) {
      return null;
    }
    const componentLog = log.child({
      title: registryItem.title,
      description: registryItem.description ?? '',
      pluginId: registryItem.pluginId,
    });
    const Component = wrapWithPluginContext({
      pluginId: registryItem.pluginId,
      extensionTitle: registryItem.title,
      Component: registryItem.component,
      log: componentLog,
    });
    return {
      log: componentLog,
      component: (props: Props) => (
        <ExposedComponentOriginContext.Provider value={originPluginId}>
          <Component {...props} />
        </ExposedComponentOriginContext.Provider>
      ),
    };
  }, [registryItem, originPluginId, catalogOwner]);

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

    if (catalogOwner === undefined && enableRestrictions && isExposedComponentDependencyMissing(id, pluginContext)) {
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
  }, [id, pluginContext, extension, isLoadingAppPlugins, catalogOwner]);
}
