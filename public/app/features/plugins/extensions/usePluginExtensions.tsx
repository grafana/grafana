import { useMemo } from 'react';
import { useObservable } from 'react-use';

import { PluginExtension } from '@grafana/data';
import { GetPluginExtensionsOptions, UsePluginExtensionsResult } from '@grafana/runtime';

import { getPluginExtensions } from './getPluginExtensions';
import { PluginExtensionRegistries } from './registry/types';

export function createUsePluginExtensions(registries: PluginExtensionRegistries) {
  const observableAddedComponentsRegistry = registries.addedComponentsRegistry.asObservable();
  const observableAddedLinksRegistry = registries.addedLinksRegistry.asObservable();

  return function usePluginExtensions(options: GetPluginExtensionsOptions): UsePluginExtensionsResult<PluginExtension> {
    const addedComponentsRegistry = useObservable(observableAddedComponentsRegistry);
    const addedLinksRegistry = useObservable(observableAddedLinksRegistry);

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
    }, [
      addedLinksRegistry,
      addedComponentsRegistry,
      options.extensionPointId,
      options.context,
      options.limitPerPlugin,
    ]);

    return { extensions, isLoading: false };
  };
}
