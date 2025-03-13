import type { PluginExtension } from '@grafana/data';

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
