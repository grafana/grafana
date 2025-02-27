import type { PluginExtension, PluginExtensionLink, PluginExtensionComponent } from '@grafana/data';

import { isPluginExtensionComponent, isPluginExtensionLink } from './utils';

export type GetPluginExtensions<T = PluginExtension> = (
  options: GetPluginExtensionsOptions
) => GetPluginExtensionsResult<T>;

export type UsePluginExtensions<T = PluginExtension> = (
  options: GetPluginExtensionsOptions
) => UsePluginExtensionsResult<T>;

export type GetPluginExtensionsOptions = {
  extensionPointId: string;
  // Make sure this object is properly memoized and not mutated.
  context?: object | Record<string | symbol, unknown>;
  limitPerPlugin?: number;
};

export type GetPluginExtensionsResult<T = PluginExtension> = {
  extensions: T[];
};

export type UsePluginExtensionsResult<T = PluginExtension> = {
  extensions: T[];
  isLoading: boolean;
};

let singleton: GetPluginExtensions | undefined;

export function setPluginExtensionGetter(instance: GetPluginExtensions): void {
  // We allow overriding the registry in tests
  if (singleton && process.env.NODE_ENV !== 'test') {
    throw new Error('setPluginExtensionGetter() function should only be called once, when Grafana is starting.');
  }
  singleton = instance;
}

function getPluginExtensionGetter(): GetPluginExtensions {
  if (!singleton) {
    throw new Error('getPluginExtensionGetter() can only be used after the Grafana instance has started.');
  }
  return singleton;
}

export const getPluginExtensions: GetPluginExtensions = (options) => getPluginExtensionGetter()(options);

export const getPluginLinkExtensions: GetPluginExtensions<PluginExtensionLink> = (options) => {
  const { extensions } = getPluginExtensions(options);

  return {
    extensions: extensions.filter(isPluginExtensionLink),
  };
};

// This getter doesn't support the `context` option (contextual information can be passed in as component props)
export const getPluginComponentExtensions = <Props = {}>(options: {
  extensionPointId: string;
  limitPerPlugin?: number;
}): { extensions: Array<PluginExtensionComponent<Props>> } => {
  const { extensions } = getPluginExtensions(options);
  const componentExtensions = extensions.filter(isPluginExtensionComponent) as Array<PluginExtensionComponent<Props>>;

  return {
    extensions: componentExtensions,
  };
};
