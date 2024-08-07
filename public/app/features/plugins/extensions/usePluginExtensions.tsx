import { useMemo } from 'react';
import { useObservable } from 'react-use';

import { PluginExtension } from '@grafana/data';
import { GetPluginExtensionsOptions, useLocationService, UsePluginExtensionsResult } from '@grafana/runtime';

import { useDispatch, useSelector } from '../../../types';

import { getPluginExtensions, getSidecarHelpers } from './getPluginExtensions';
import { ReactivePluginExtensionsRegistry } from './reactivePluginExtensionRegistry';

export function createUsePluginExtensions(extensionsRegistry: ReactivePluginExtensionsRegistry) {
  const observableRegistry = extensionsRegistry.asObservable();

  return function usePluginExtensions(options: GetPluginExtensionsOptions): UsePluginExtensionsResult<PluginExtension> {
    const registry = useObservable(observableRegistry);
    const dispatch = useDispatch();
    const locationService = useLocationService();
    const sidecarAppId = useSelector((state) => state.appSidecar.appId);
    // Memoize this so that the functions do not change everytime and the getSidecarHelpers is also used in non react
    // context so cannot use useCallback inside.
    const sidecarHelpers = useMemo(
      () => getSidecarHelpers(dispatch, () => sidecarAppId, locationService),
      [dispatch, locationService, sidecarAppId]
    );

    const { extensions } = useMemo(() => {
      if (!registry) {
        return { extensions: [] };
      }
      return getPluginExtensions({
        extensionPointId: options.extensionPointId,
        context: options.context,
        limitPerPlugin: options.limitPerPlugin,
        registry,
        ...sidecarHelpers,
      });
    }, [options.extensionPointId, options.context, options.limitPerPlugin, registry, sidecarHelpers]);

    return {
      extensions,
      isLoading: false,
    };
  };
}
