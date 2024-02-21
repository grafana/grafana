import { useObservable } from 'react-use';

import { PluginExtension } from '@grafana/data';
import { GetPluginExtensionsOptions, GetPluginExtensionsResult } from '@grafana/runtime';
import { useGrafana } from 'app/core/context/GrafanaContext';

import { getPluginExtensions } from './getPluginExtensions';

// We should probably also provide hooks to fetch specific types of extensions
export function usePluginExtensions(options: GetPluginExtensionsOptions): GetPluginExtensionsResult<PluginExtension> {
  const { extensionsRegistry } = useGrafana();
  const registry = useObservable(extensionsRegistry.asObservable());

  if (!registry) {
    return { extensions: [] };
  }

  return getPluginExtensions({ ...options, registry });
}
