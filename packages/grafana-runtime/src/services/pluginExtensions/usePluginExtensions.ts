import { useMemo } from 'react';

import { PluginExtensionComponent, PluginExtensionLink } from '@grafana/data';

import { GetPluginExtensionsOptions, UsePluginExtensions, UsePluginExtensionsResult } from './getPluginExtensions';
import { isPluginExtensionComponent, isPluginExtensionLink } from './utils';

let singleton: UsePluginExtensions | undefined;

export function setPluginExtensionsHook(hook: UsePluginExtensions): void {
  // We allow overriding the registry in tests
  if (singleton && process.env.NODE_ENV !== 'test') {
    throw new Error('setPluginExtensionsHook() function should only be called once, when Grafana is starting.');
  }
  singleton = hook;
}

/**
 * @deprecated Use either usePluginLinks() or usePluginComponents() instead.
 */
export function usePluginExtensions(options: GetPluginExtensionsOptions): UsePluginExtensionsResult {
  if (!singleton) {
    throw new Error('usePluginExtensions(options) can only be used after the Grafana instance has started.');
  }
  return singleton(options);
}

/**
 * @deprecated Use usePluginLinks() instead.
 */
export function usePluginLinkExtensions(
  options: GetPluginExtensionsOptions
): UsePluginExtensionsResult<PluginExtensionLink> {
  const { extensions, isLoading } = usePluginExtensions(options);

  return useMemo(() => {
    return {
      extensions: extensions.filter(isPluginExtensionLink),
      isLoading,
    };
  }, [extensions, isLoading]);
}

/**
 * @deprecated Use usePluginComponents() instead.
 */
export function usePluginComponentExtensions<Props = {}>(
  options: GetPluginExtensionsOptions
): { extensions: Array<PluginExtensionComponent<Props>>; isLoading: boolean } {
  const { extensions, isLoading } = usePluginExtensions(options);

  return useMemo(
    () => ({
      extensions: extensions.filter(isPluginExtensionComponent) as Array<PluginExtensionComponent<Props>>,
      isLoading,
    }),
    [extensions, isLoading]
  );
}
