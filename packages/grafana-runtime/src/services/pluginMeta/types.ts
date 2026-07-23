import type { AppPluginConfig, AppPluginMetaConfig, DataSourcePluginMeta, PanelPluginMeta } from '@grafana/data';

import type { Meta } from './types/meta/meta_object_gen';

export type AppPluginMetas = Record<string, AppPluginConfig>;
export type DatasourcePluginMetas = Record<string, DataSourcePluginMeta>;
export type PanelPluginMetas = Record<string, PanelPluginMeta>;

// Mappers translate metas API responses, which always carry the plugin's
// display and navigation fields, so they produce the richer config type.
export type AppPluginMetasMapper<T> = (response: T) => Record<string, AppPluginMetaConfig>;
export type DatasourcePluginMetasMapper<T> = (response: T) => DatasourcePluginMetas;
export type PanelPluginMetasMapper<T> = (response: T) => PanelPluginMetas;

export interface PluginMetasResponse {
  items: Meta[];
}

export type FrontendSettings = {
  datasources: Record<string, { type: string; meta: DataSourcePluginMeta }>;
};
