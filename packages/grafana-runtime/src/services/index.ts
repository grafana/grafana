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

//dashboard service exports
export { getDashboardSrv, setDashboardSrv } from './dashboardSrv/DashboardSrv';
export type { PluginsAPIDashboardSrv, PluginsAPIPanelModel } from './dashboardSrv/types';

export {
  setPluginExtensionGetter,
  getPluginExtensions,
  getPluginLinkExtensions,
  getPluginComponentExtensions,
  type GetPluginExtensions,
} from './pluginExtensions/getPluginExtensions';
export { isPluginExtensionLink, isPluginExtensionComponent } from './pluginExtensions/utils';
