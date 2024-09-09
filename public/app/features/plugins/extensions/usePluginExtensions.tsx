import { useMemo } from 'react';
import { useObservable } from 'react-use';

import { PluginExtension } from '@grafana/data';
import { GetPluginExtensionsOptions, UsePluginExtensionsResult } from '@grafana/runtime';
import { useSidecar } from 'app/core/context/SidecarContext';

import { getPluginExtensions } from './getPluginExtensions';
import { PluginExtensionRegistries } from './registry/types';

export function createUsePluginExtensions(registries: PluginExtensionRegistries) {
  const observableAddedComponentsRegistry = registries.addedComponentsRegistry.asObservable();
  const observableAddedLinksRegistry = registries.addedLinksRegistry.asObservable();

  return function usePluginExtensions(options: GetPluginExtensionsOptions): UsePluginExtensionsResult<PluginExtension> {
    const addedComponentsRegistry = useObservable(observableAddedComponentsRegistry);
    const addedLinksRegistry = useObservable(observableAddedLinksRegistry);
    const { activePluginId } = useSidecar();

    const { extensions } = useMemo(() => {
      if (!addedLinksRegistry && !addedComponentsRegistry) {
        return { extensions: [], isLoading: false };
      }

      return getPluginExtensions({
        extensionPointId: options.extensionPointId,
        context: options.context,
        limitPerPlugin: options.limitPerPlugin,
        addedComponentsRegistry,
        addedLinksRegistry,
      });
      // Doing the deps like this instead of just `option` because users probably aren't going to memoize the
      // options object so we are checking it's simple value attributes.
      // The context though still has to be memoized though and not mutated.
      // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO: refactor `getPluginExtensions` to accept service dependencies as arguments instead of relying on the sidecar singleton under the hood
    }, [
      addedLinksRegistry,
      addedComponentsRegistry,
      options.extensionPointId,
      options.context,
      options.limitPerPlugin,
      activePluginId,
    ]);

    return { extensions, isLoading: false };
  };
}
