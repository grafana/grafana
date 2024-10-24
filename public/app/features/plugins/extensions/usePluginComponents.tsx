import { useMemo } from 'react';
import { useObservable } from 'react-use';

import { usePluginContext } from '@grafana/data';
import {
  UsePluginComponentOptions,
  UsePluginComponentsResult,
} from '@grafana/runtime/src/services/pluginExtensions/getPluginExtensions';

import { useAddedComponentsRegistry } from './ExtensionRegistriesContext';
import { log } from './logs/log';
import { useLoadAppPlugins } from './useLoadAppPlugins';
import { getExtensionPointPluginDependencies, isExtensionPointMetaInfoMissing, isGrafanaDevMode } from './utils';
import { isExtensionPointIdValid } from './validators';

// Returns an array of component extensions for the given extension point
export function usePluginComponents<Props extends object = {}>({
  limitPerPlugin,
  extensionPointId,
}: UsePluginComponentOptions): UsePluginComponentsResult<Props> {
  const registry = useAddedComponentsRegistry();
  const registryState = useObservable(registry.asObservable());
  const pluginContext = usePluginContext();
  const { isLoading: isLoadingAppPlugins } = useLoadAppPlugins(getExtensionPointPluginDependencies(extensionPointId));

  return useMemo(() => {
    // For backwards compatibility we don't enable restrictions in production or when the hook is used in core Grafana.
    const enableRestrictions = isGrafanaDevMode() && pluginContext;
    const components: Array<React.ComponentType<Props>> = [];
    const extensionsByPlugin: Record<string, number> = {};
    const pluginId = pluginContext?.meta.id ?? '';
    const pointLog = log.child({
      pluginId,
      extensionPointId,
    });

    if (enableRestrictions && !isExtensionPointIdValid({ extensionPointId, pluginId })) {
      pointLog.warning(
        `Extension point usePluginComponents("${extensionPointId}") - the id should be prefixed with your plugin id ("${pluginId}/").`
      );
      return {
        isLoading: false,
        components: [],
      };
    }

    if (enableRestrictions && isExtensionPointMetaInfoMissing(extensionPointId, pluginContext, pointLog)) {
      pointLog.warning(
        `usePluginComponents("${extensionPointId}") - The extension point is missing from the "plugin.json" file.`
      );
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

      components.push(registryItem.component as React.ComponentType<Props>);
      extensionsByPlugin[pluginId] += 1;
    }

    return {
      isLoading: false,
      components,
    };
  }, [extensionPointId, limitPerPlugin, pluginContext, registryState, isLoadingAppPlugins]);
}
