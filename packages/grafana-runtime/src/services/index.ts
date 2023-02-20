export * from './backendSrv';
export * from './AngularLoader';
export * from './dataSourceSrv';
export * from './LocationSrv';
export * from './EchoSrv';
export * from './templateSrv';
export * from './legacyAngularInjector';
export * from './live';
export * from './LocationService';
export * from './appEvents';
export { setPluginsExtensionRegistry } from './pluginExtensions/registry';
export type { PluginsExtensionRegistry, PluginsExtensionLink, PluginsExtension } from './pluginExtensions/registry';
export {
  type GetPluginExtensionsOptions,
  type PluginExtensionsResult,
  getPluginExtensions,
} from './pluginExtensions/extensions';
