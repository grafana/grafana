import { useMemo } from 'react';
import { useObservable } from 'react-use';

import { usePluginContext } from '@grafana/data';
import {
  UsePluginHooksOptions,
  UsePluginHooksResult,
} from '@grafana/runtime/src/services/pluginExtensions/getPluginExtensions';

import { useAddedHooksRegistry } from './ExtensionRegistriesContext';
import * as errors from './errors';
import { log } from './logs/log';
import { getExtensionPointPluginDependencies, isGrafanaDevMode } from './utils';
import { isExtensionPointIdValid, isExtensionPointMetaInfoMissing } from './validators';
import { useLoadPlugins } from './useLoadPlugins';

// Returns an array of component extensions for the given extension point
export function usePluginHooks<Signature>({
  limitPerPlugin,
  extensionPointId,
}: UsePluginHooksOptions): UsePluginHooksResult<Signature> {
  const registry = useAddedHooksRegistry();
  const registryState = useObservable(registry.asObservable());
  const pluginContext = usePluginContext();
  const deps = getExtensionPointPluginDependencies(extensionPointId);
  const { isLoading: isLoadingAppPlugins } = useLoadPlugins(deps);

  return useMemo(() => {
    // For backwards compatibility we don't enable restrictions in production or when the hook is used in core Grafana.
    const enableRestrictions = isGrafanaDevMode() && pluginContext;
    const hooks: Array<Signature> = [];
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
        hooks: [],
      };
    }

    if (isLoadingAppPlugins) {
      return {
        isLoading: true,
        hooks: [],
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

      hooks.push(registryItem.hook);
      extensionsByPlugin[pluginId] += 1;
    }

    return {
      isLoading: false,
      hooks,
    };
  }, [extensionPointId, limitPerPlugin, pluginContext, registryState, isLoadingAppPlugins]);
}
