import type { AppPluginConfig, PanelPluginMeta } from '@grafana/data';

import type { Meta } from './types/meta_object_gen';

export type AppPluginMetas = Record<string, AppPluginConfig>;
export type PanelPluginMetas = Record<string, PanelPluginMeta>;

export type AppPluginMetasMapper<T> = (response: T) => AppPluginMetas;
export type PanelPluginMetasMapper<T> = (response: T) => PanelPluginMetas;

export interface PluginMetasResponse {
  items: Meta[];
}
