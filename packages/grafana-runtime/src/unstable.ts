/**
 * THESE APIS MUST NOT BE USED IN COMMUNITY PLUGINS.
 *
 * Unstable APIs are still in development and are subject to breaking changes
 * at any point, like feature flags but for APIS. They must only be used in
 * Grafana core and internal plugins where we can coordinate changes.
 *
 * Once mature, they will be moved to the main export, be available to plugins via the standard import path,
 * and be subject to the standard policies
 */

export { clearLoggerRegistry, getLogger, initializeLoggersRegistry, setLogger } from './services/logging/registry';
export { type LoggerSource } from './services/logging/loggers';
export { defineFeatureEvents } from './analyticsFramework/main';
export type { EventProperty, Event, EventVariants } from './analyticsFramework/types';
export { getPluginSettings } from './services/pluginSettings/getPluginSettings';
export { updateAppPluginSettings } from './services/pluginSettings/updateAppPluginSettings';
export { usePluginSettings } from './services/pluginSettings/hooks';
// The async data source APIs are stable and exported from `@grafana/runtime`. They stay here until
// @grafana/plugin-compat no longer supports hosts that only expose them on this entrypoint.
export {
  /** @deprecated Import from `@grafana/runtime` instead. */
  type GetDataSourceInstanceListFilters,
  /** @deprecated Import from `@grafana/runtime` instead. */
  getDataSourceInstanceSettings,
  /** @deprecated Import from `@grafana/runtime` instead. */
  getDataSourceInstanceList,
  /** @deprecated Import from `@grafana/runtime` instead. */
  getDefaultDataSourceInstanceListItem,
  /** @deprecated Import from `@grafana/runtime` instead. */
  hasDataSourceInstance,
  /** @deprecated Import from `@grafana/runtime` instead. */
  reloadDataSourceInstanceSettings,
} from './services/dataSource/settings';
export {
  /** @deprecated Import from `@grafana/runtime` instead. */
  getDataSourceInstance,
  /** @deprecated Import from `@grafana/runtime` instead. */
  registerRuntimeDataSourceInstance,
} from './services/dataSource/dataSource';
export {
  /** @deprecated Import from `@grafana/runtime` instead. */
  getDataSourceInstanceListItem,
} from './services/dataSource/listItem';
export {
  /** @deprecated Import from `@grafana/runtime` instead. */
  useDataSourceInstanceSettings,
  /** @deprecated Import from `@grafana/runtime` instead. */
  useDataSourceInstance,
  /** @deprecated Import from `@grafana/runtime` instead. */
  useDataSourceInstanceList,
  /** @deprecated Import from `@grafana/runtime` instead. */
  useDataSourceInstanceListItem,
  /** @deprecated Import from `@grafana/runtime` instead. */
  useDefaultDataSourceInstanceListItem,
  /** @deprecated Import from `@grafana/runtime` instead. */
  useHasDataSourceInstance,
  /** @deprecated Import from `@grafana/runtime` instead. */
  type UseDataSourceInstanceSettingsResult,
  /** @deprecated Import from `@grafana/runtime` instead. */
  type UseDataSourceInstanceResult,
  /** @deprecated Import from `@grafana/runtime` instead. */
  type UseDataSourceInstanceListResult,
  /** @deprecated Import from `@grafana/runtime` instead. */
  type UseDataSourceInstanceListItemResult,
  /** @deprecated Import from `@grafana/runtime` instead. */
  type UseDefaultDataSourceInstanceListItemResult,
  /** @deprecated Import from `@grafana/runtime` instead. */
  type UseHasDataSourceInstanceResult,
} from './services/dataSource/hooks';
