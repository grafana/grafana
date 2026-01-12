import type { AppPluginConfig } from '@grafana/data';

import type { Meta } from './types/meta_object_gen';

export type AppPluginMetas = Record<string, AppPluginConfig>;

export type AppPluginMetasMapper<T> = (response: T) => AppPluginMetas;
export interface PluginMetasResponse {
  items: Meta[];
}
