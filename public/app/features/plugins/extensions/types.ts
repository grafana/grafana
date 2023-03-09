import type { AppPluginExtensionCommandConfig, PluginExtensionContext } from '@grafana/data';

export type CommandHandlerFunc = AppPluginExtensionCommandConfig['handler'];
export type ConfigureFunc<T> = (extension: T, context?: PluginExtensionContext) => Partial<T> | undefined;
