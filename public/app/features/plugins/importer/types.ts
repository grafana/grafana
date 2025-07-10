import { GrafanaPlugin, PluginLoadingStrategy, PluginMeta } from '@grafana/data';

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
