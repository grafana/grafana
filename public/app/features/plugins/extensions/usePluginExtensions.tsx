import { useObservable } from 'react-use';

import { PluginExtension } from '@grafana/data';
import { GetPluginExtensionsOptions, GetPluginExtensionsResult } from '@grafana/runtime';

import { getPluginExtensions } from './getPluginExtensions';
import { ReactivePluginExtensionsRegistry } from './reactivePluginExtensionRegistry';

export function createPluginExtensionsHook(extensionsRegistry: ReactivePluginExtensionsRegistry) {
  const observableRegistry = extensionsRegistry.asObservable();
  const cache: {
    id: string;
    extensions: Record<
      string,
      { context: GetPluginExtensionsOptions['context']; extensions: GetPluginExtensionsResult<PluginExtension> }
    >;
  } = {
    id: '',
    extensions: {},
  };

  return function usePluginExtensions(options: GetPluginExtensionsOptions): GetPluginExtensionsResult<PluginExtension> {
    const registry = useObservable(observableRegistry);

    if (!registry) {
      return { extensions: [] };
    }

    if (registry.id !== cache.id) {
      cache.id = registry.id;
      cache.extensions = {};
    }

    // `getPluginExtensions` will return a new array of objects even if it is called with the same options, as it always constructing a frozen objects.
    // Due to this we are caching the result of `getPluginExtensions` to avoid unnecessary re-renders for components that are using this hook.
    // (NOTE: we are only checking referential equality of `context` object, so it is important to not mutate the object passed to this hook.)
    const key = `${options.extensionPointId}-${options.limitPerPlugin}`;
    if (cache.extensions[key] && cache.extensions[key].context === options.context) {
      return cache.extensions[key].extensions;
    }

    const extensions = getPluginExtensions({ ...options, registry });

    cache.extensions[key] = {
      context: options.context,
      extensions,
    };

    return extensions;
  };
}
