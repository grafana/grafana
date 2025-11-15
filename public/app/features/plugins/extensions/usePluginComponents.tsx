import { useMemo } from 'react';

import {
  type ComponentTypeWithExtensionMeta,
  type PluginExtensionComponentMeta,
  PluginExtensionTypes,
  usePluginContext,
} from '@grafana/data';
import { UsePluginComponentsOptions, UsePluginComponentsResult } from '@grafana/runtime';

import { AddedComponentRegistryItem } from './registry/AddedComponentsRegistry';
import { useAddedComponentsRegistrySlice } from './registry/useRegistrySlice';
import { useLoadAppPlugins } from './useLoadAppPlugins';
import { generateExtensionId, getExtensionPointPluginDependencies } from './utils';
import { validateExtensionPoint } from './validateExtensionPoint';

// Returns an array of component extensions for the given extension point
export function usePluginComponents<Props extends object = {}>({
  limitPerPlugin,
  extensionPointId,
}: UsePluginComponentsOptions): UsePluginComponentsResult<Props> {
  const registryItems = useAddedComponentsRegistrySlice<Props>(extensionPointId);
  const pluginContext = usePluginContext();
  const { isLoading: isLoadingAppPlugins } = useLoadAppPlugins(getExtensionPointPluginDependencies(extensionPointId));

  return useMemo(() => {
    const { result } = validateExtensionPoint({ extensionPointId, pluginContext, isLoadingAppPlugins });

    if (result) {
      return {
        isLoading: result.isLoading,
        components: [],
      };
    }

    const components: Array<ComponentTypeWithExtensionMeta<Props>> = [];
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

      const component = createComponentWithMeta<Props>(registryItem, extensionPointId);

      components.push(component);
      extensionsByPlugin[pluginId] += 1;
    }

    return {
      isLoading: false,
      components,
    };
  }, [extensionPointId, limitPerPlugin, pluginContext, registryItems, isLoadingAppPlugins]);
}

export function createComponentWithMeta<Props extends JSX.IntrinsicAttributes>(
  registryItem: AddedComponentRegistryItem<Props>,
  extensionPointId: string
): ComponentTypeWithExtensionMeta<Props> {
  const { component: Component, ...config } = registryItem;

  function ComponentWithMeta(props: Props) {
    return <Component {...props} />;
  }

  ComponentWithMeta.displayName = Component.displayName;
  ComponentWithMeta.defaultProps = Component.defaultProps;
  ComponentWithMeta.propTypes = Component.propTypes;
  ComponentWithMeta.contextTypes = Component.contextTypes;
  ComponentWithMeta.meta = {
    pluginId: config.pluginId,
    title: config.title ?? '',
    description: config.description ?? '',
    id: generateExtensionId(config.pluginId, extensionPointId, config.title),
    type: PluginExtensionTypes.component,
  } satisfies PluginExtensionComponentMeta;

  return ComponentWithMeta;
}
