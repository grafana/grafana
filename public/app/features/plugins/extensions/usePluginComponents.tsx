import { useMemo } from 'react';
import { useObservable } from 'react-use';

import {
  type ComponentTypeWithExtensionMeta,
  type PluginExtensionComponentMeta,
  PluginExtensionTypes,
  usePluginContext,
} from '@grafana/data';
import { UsePluginComponentsOptions, UsePluginComponentsResult } from '@grafana/runtime';

import { useAddedComponentsRegistry } from './ExtensionRegistriesContext';
import { getExtensionValidationResults } from './getExtensionValidationResults';
import { AddedComponentRegistryItem } from './registry/AddedComponentsRegistry';
import { useLoadAppPlugins } from './useLoadAppPlugins';
import { generateExtensionId, getExtensionPointPluginDependencies } from './utils';

// Returns an array of component extensions for the given extension point
export function usePluginComponents<Props extends object = {}>({
  limitPerPlugin,
  extensionPointId,
}: UsePluginComponentsOptions): UsePluginComponentsResult<Props> {
  const registry = useAddedComponentsRegistry();
  const registryState = useObservable(registry.asObservable());
  const pluginContext = usePluginContext();
  const { isLoading: isLoadingAppPlugins } = useLoadAppPlugins(getExtensionPointPluginDependencies(extensionPointId));

  return useMemo(() => {
    const { result } = getExtensionValidationResults({ extensionPointId, pluginContext, isLoadingAppPlugins });

    if (result) {
      return {
        isLoading: result.isLoading,
        components: result.results,
      };
    }

    const components: Array<ComponentTypeWithExtensionMeta<Props>> = [];
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

      const component = createComponentWithMeta<Props>(
        registryItem as AddedComponentRegistryItem<Props>,
        extensionPointId
      );

      components.push(component);
      extensionsByPlugin[pluginId] += 1;
    }

    return {
      isLoading: false,
      components,
    };
  }, [extensionPointId, limitPerPlugin, pluginContext, registryState, isLoadingAppPlugins]);
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
