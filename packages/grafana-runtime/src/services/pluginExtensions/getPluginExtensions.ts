import type {
  PluginExtension,
  PluginExtensionLink,
  PluginExtensionComponent,
  PluginExtensionFunction,
} from '@grafana/data';

import { isPluginExtensionComponent, isPluginExtensionFunction, isPluginExtensionLink } from './utils';

export type GetPluginExtensions<T = PluginExtension> = (
  options: GetPluginExtensionsOptions
) => GetPluginExtensionsResult<T>;

export type GetPluginExtensionsOptions = {
  extensionPointId: string;
  context?: object | Record<string | symbol, unknown>;
  limitPerPlugin?: number;
};

export type GetPluginExtensionsResult<T = PluginExtension> = {
  extensions: T[];
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

export const getPluginComponentExtensions: GetPluginExtensions<PluginExtensionComponent> = (options) => {
  const { extensions } = getPluginExtensions(options);

  return {
    extensions: extensions.filter(isPluginExtensionComponent),
  };
};

export const getPluginFunctionExtensions: GetPluginExtensions<PluginExtensionFunction> = (options) => {
  const { extensions } = getPluginExtensions(options);

  return {
    extensions: extensions.filter(isPluginExtensionFunction),
  };
};
