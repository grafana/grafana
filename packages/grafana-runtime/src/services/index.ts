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

export {
  setPluginExtensionGetter,
  getPluginExtensions,
  getPluginLinkExtensions,
  getPluginComponentExtensions,
  type GetPluginExtensions,
  type GetPluginExtensionsOptions,
  type GetPluginExtensionsResult,
  type UsePluginExtensions,
  type UsePluginExtensionsResult,
  type UsePluginComponentResult,
} from './pluginExtensions/getPluginExtensions';
export {
  setPluginExtensionsHook,
  usePluginExtensions,
  usePluginLinkExtensions,
  usePluginComponentExtensions,
} from './pluginExtensions/usePluginExtensions';

export { setPluginComponentHook, usePluginComponent } from './pluginExtensions/usePluginComponent';
export { setPluginComponentsHook, usePluginComponents } from './pluginExtensions/usePluginComponents';
export { setPluginLinksHook, usePluginLinks } from './pluginExtensions/usePluginLinks';

export { isPluginExtensionLink, isPluginExtensionComponent } from './pluginExtensions/utils';
export { setCurrentUser } from './user';
