import type { AppPluginConfig, DataSourcePluginMeta, PanelPluginMeta } from '@grafana/data/types';

import type { Meta } from './types/meta/meta_object_gen';

export type AppPluginMetas = Record<string, AppPluginConfig>;
export type DatasourcePluginMetas = Record<string, DataSourcePluginMeta>;
export type PanelPluginMetas = Record<string, PanelPluginMeta>;

export type AppPluginMetasMapper<T> = (response: T) => AppPluginMetas;
export type DatasourcePluginMetasMapper<T> = (response: T) => DatasourcePluginMetas;
export type PanelPluginMetasMapper<T> = (response: T) => PanelPluginMetas;

export interface PluginMetasResponse {
  items: Meta[];
}

export type FrontendSettings = {
  datasources: Record<string, { type: string; meta: DataSourcePluginMeta }>;
};
