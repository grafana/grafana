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
export * from './SidecarService_EXPERIMENTAL';
export * from './SidecarContext_EXPERIMENTAL';

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
} from './pluginExtensions/getPluginExtensions';
export {
  setPluginExtensionsHook,
  usePluginExtensions,
  usePluginLinkExtensions,
  usePluginComponentExtensions,
} from './pluginExtensions/usePluginExtensions';

export {
  setPluginComponentHook,
  usePluginComponent,
  type UsePluginComponentResult,
} from './pluginExtensions/usePluginComponent';
export {
  setPluginComponentsHook,
  usePluginComponents,
  type UsePluginComponentsResult,
  type UsePluginComponentsOptions,
} from './pluginExtensions/usePluginComponents';
export {
  setPluginLinksHook,
  usePluginLinks,
  type UsePluginLinksOptions,
  type UsePluginLinksResult,
} from './pluginExtensions/usePluginLinks';
export {
  setPluginFunctionsHook,
  usePluginFunctions,
  type UsePluginFunctionsOptions,
  type UsePluginFunctionsResult,
} from './pluginExtensions/usePluginFunctions';

export { isPluginExtensionLink, isPluginExtensionComponent } from './pluginExtensions/utils';
export { setCurrentUser } from './user';
export { RuntimeDataSource } from './RuntimeDataSource';
export { ScopesContext, type ScopesContextValueState, type ScopesContextValue, useScopes } from './ScopesContext';
