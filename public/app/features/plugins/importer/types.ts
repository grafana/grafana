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
  importPanelPlugin: (meta: PanelPluginMeta) => Promise<PanelPlugin>;
  importDatasourcePlugin: (meta: DataSourcePluginMeta) => Promise<GenericDataSourcePlugin>;
  importAppPlugin: (meta: AppPluginMeta) => Promise<AppPlugin>;
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
