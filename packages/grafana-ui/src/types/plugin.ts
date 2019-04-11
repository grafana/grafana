export enum PluginState {
  alpha = 'alpha',
  beta = 'beta',
}

export interface PluginMeta {
  id: string;
  name: string;
  info: PluginMetaInfo;
  module: string;
  includes?: PluginInclude[];
  baseUrl?: string;

  type: string; // panel|app|datasource
  enabled?: boolean;
  state?: PluginState;

  // Datasource-specific
  builtIn?: boolean;
  metrics?: boolean;
  tables?: boolean;
  logs?: boolean;
  explore?: boolean;
  annotations?: boolean;
  mixed?: boolean;
  hasQueryHelp?: boolean;
  queryOptions?: PluginMetaQueryOptions;
}

interface PluginMetaQueryOptions {
  cacheTimeout?: boolean;
  maxDataPoints?: boolean;
  minInterval?: boolean;
}

export interface PluginInclude {
  type: string;
  name: string;
  path: string;
}

interface PluginMetaInfoLink {
  name: string;
  url: string;
}

export interface PluginMetaInfo {
  author: {
    name: string;
    url?: string;
  };
  description: string;
  links: PluginMetaInfoLink[];
  logos: {
    large: string;
    small: string;
  };
  screenshots: any[];
  updated: string;
  version: string;
}
