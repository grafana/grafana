import { useObservable } from 'react-use';

import { PluginExtension } from '@grafana/data';
import { GetPluginExtensionsOptions, GetPluginExtensionsResult } from '@grafana/runtime';

import { getPluginExtensions } from './getPluginExtensions';
import { ReactivePluginExtensionsRegistry } from './reactivePluginExtensionRegistry';

export function createPluginExtensionsHook(extensionsRegistry: ReactivePluginExtensionsRegistry) {
  return function usePluginExtensions(options: GetPluginExtensionsOptions): GetPluginExtensionsResult<PluginExtension> {
    const registry = useObservable(extensionsRegistry.asObservable());

    if (!registry) {
      return { extensions: [] };
    }

    return getPluginExtensions({ ...options, registry });
  };
}
