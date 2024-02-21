import { useObservable } from 'react-use';

import { PluginExtension } from '@grafana/data';
import { GetPluginExtensionsOptions, GetPluginExtensionsResult } from '@grafana/runtime';

import { getPluginExtensions } from './getPluginExtensions';
import { ReactivePluginExtenionRegistry } from './reactivePluginExtensionRegistry';

// We need to figure out a way to share the registry to the hook.
// Alternatives:
// - ProviderContext
// - Hoc
const reactiveRegistry = new ReactivePluginExtenionRegistry();

// We should probably also provide hooks to fetch specific types of extensions
export function usePluginExtensions(options: GetPluginExtensionsOptions): GetPluginExtensionsResult<PluginExtension> {
  const registry = useObservable(reactiveRegistry.asObservable());

  if (!registry) {
    return { extensions: [] };
  }

  return getPluginExtensions({ ...options, registry });
}
