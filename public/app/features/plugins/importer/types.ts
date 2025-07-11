import {
  AppPlugin,
  AppPluginMeta,
  DataSourcePluginMeta,
  GrafanaPlugin,
  PanelPlugin,
  PanelPluginMeta,
  PluginLoadingStrategy,
  PluginMeta,
} from '@grafana/data';
import { GenericDataSourcePlugin } from 'app/features/datasources/types';

export interface PluginImporter {
  /**
   * Imports a panel plugin from module.js
   * @param meta - The plugin meta
   * @returns a Promise<PanelPlugin>
   */
  importPanelPlugin: (meta: PanelPluginMeta) => Promise<PanelPlugin>;
  /**
   * Imports a datasource plugin from module.js
   * @param meta - The plugin meta
   * @returns a Promise<GenericDataSourcePlugin>
   */
  importDatasourcePlugin: (meta: DataSourcePluginMeta) => Promise<GenericDataSourcePlugin>;
  /**
   * Imports an app plugin from module.js
   * @param meta - The plugin meta
   * @returns a Promise<AppPlugin>
   */
  importAppPlugin: (meta: AppPluginMeta) => Promise<AppPlugin>;
  /**
   * Retrieves a panel plugin from the cache, if it doesn't exist in the cache it returns undefined
   * @param id - The plugin id
   * @returns a PanelPlugin or undefined
   */
  getPanelPlugin: (id: string) => PanelPlugin | undefined;
}

export interface PluginImportInfo {
  path: string;
  pluginId: string;
  loadingStrategy: PluginLoadingStrategy;
  version?: string;
  moduleHash?: string;
  translations?: Record<string, string>;
}

export type PreImportStrategy<M extends PluginMeta = PluginMeta> = (meta: M) => PluginImportInfo;

export type PostImportStrategy<M extends PluginMeta = PluginMeta, P extends GrafanaPlugin<M> = GrafanaPlugin<M>> = (
  meta: M,
  module: Promise<System.Module>
) => Promise<P>;
