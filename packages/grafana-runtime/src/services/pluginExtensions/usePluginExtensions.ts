import { useMemo } from 'react';

import { PluginExtensionComponent, PluginExtensionLink } from '@grafana/data';

import { GetPluginExtensions, GetPluginExtensionsOptions, GetPluginExtensionsResult } from './getPluginExtensions';
import { isPluginExtensionComponent, isPluginExtensionLink } from './utils';

let singleton: GetPluginExtensions | undefined;

export function setPluginExtensionsHook(hook: GetPluginExtensions): void {
  // We allow overriding the registry in tests
  if (singleton && process.env.NODE_ENV !== 'test') {
    throw new Error('setPluginExtensionsHook() function should only be called once, when Grafana is starting.');
  }
  singleton = hook;
}

export function usePluginExtensions(options: GetPluginExtensionsOptions): GetPluginExtensionsResult {
  if (!singleton) {
    throw new Error('usePluginExtensions(options) can only be used after the Grafana instance has started.');
  }
  return singleton(options);
}

export function usePluginLinkExtensions(
  options: GetPluginExtensionsOptions
): GetPluginExtensionsResult<PluginExtensionLink> {
  const { extensions } = usePluginExtensions(options);

  return useMemo(() => {
    return {
      extensions: extensions.filter(isPluginExtensionLink),
    };
  }, [extensions]);
}

export function usePluginComponentExtensions<Props = {}>(
  options: GetPluginExtensionsOptions
): { extensions: Array<PluginExtensionComponent<Props>> } {
  const { extensions } = usePluginExtensions(options);

  return useMemo(
    () => ({
      extensions: extensions.filter(isPluginExtensionComponent) as Array<PluginExtensionComponent<Props>>,
    }),
    [extensions]
  );
}
