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
import * as errors from './errors';
import { log } from './logs/log';
import { AddedComponentRegistryItem } from './registry/AddedComponentsRegistry';
import { useLoadAppPlugins } from './useLoadAppPlugins';
import { generateExtensionId, getExtensionPointPluginDependencies, isGrafanaDevMode } from './utils';
import { isExtensionPointIdValid, isExtensionPointMetaInfoMissing } from './validators';

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
    // For backwards compatibility we don't enable restrictions in production or when the hook is used in core Grafana.
    const enableRestrictions = isGrafanaDevMode() && pluginContext;
    const components: Array<ComponentTypeWithExtensionMeta<Props>> = [];
    const extensionsByPlugin: Record<string, number> = {};
    const pluginId = pluginContext?.meta.id ?? '';
    const pointLog = log.child({
      pluginId,
      extensionPointId,
    });

    if (enableRestrictions && !isExtensionPointIdValid({ extensionPointId, pluginId })) {
      pointLog.error(errors.INVALID_EXTENSION_POINT_ID);
    }

    if (enableRestrictions && isExtensionPointMetaInfoMissing(extensionPointId, pluginContext)) {
      pointLog.error(errors.EXTENSION_POINT_META_INFO_MISSING);
      return {
        isLoading: false,
        components: [],
      };
    }

    if (isLoadingAppPlugins) {
      return {
        isLoading: true,
        components: [],
      };
    }

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

// exported so it can be used in tests
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
