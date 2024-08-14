import { useMemo } from 'react';
import { useObservable } from 'react-use';

import { PluginExtension } from '@grafana/data';
import { GetPluginExtensionsOptions, UsePluginExtensionsResult } from '@grafana/runtime';
import { useSidecar } from 'app/core/context/SidecarContext';

import { getPluginExtensions } from './getPluginExtensions';
import { ReactivePluginExtensionsRegistry } from './reactivePluginExtensionRegistry';

export function createUsePluginExtensions(extensionsRegistry: ReactivePluginExtensionsRegistry) {
  const observableRegistry = extensionsRegistry.asObservable();

  return function usePluginExtensions(options: GetPluginExtensionsOptions): UsePluginExtensionsResult<PluginExtension> {
    const registry = useObservable(observableRegistry);
    const { activePluginId } = useSidecar();

    const { extensions } = useMemo(() => {
      if (!registry) {
        return { extensions: [] };
      }
      return getPluginExtensions({
        extensionPointId: options.extensionPointId,
        context: options.context,
        limitPerPlugin: options.limitPerPlugin,
        registry,
      });
      // Doing the deps like this instead of just `option` because there is low chance users will also memoize the
      // options object. This way we don't have to count on it and just check the simple values.
      // The context though still has to be memoized though and not mutated.
      // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO: refactor `getPluginExtensions` to accept service dependencies as arguments instead of relying on the sidecar singleton under the hood
    }, [options.extensionPointId, options.context, options.limitPerPlugin, registry, activePluginId]);

    return {
      extensions,
      isLoading: false,
    };
  };
}
