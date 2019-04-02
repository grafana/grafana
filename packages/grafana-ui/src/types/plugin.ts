import { ReactPanelPlugin } from './panel';
import { DataSourcePlugin } from './datasource';

export interface PluginExports {
  // used  by app plugins
  ConfigCtrl: any;
  // used by angular panels
  PanelCtrl?: any;

  dsPlugin?: DataSourcePlugin;
  reactPanel?: ReactPanelPlugin;
}

export interface PluginMeta {
  id: string;
  name: string;
  info: PluginMetaInfo;
  includes: PluginInclude[];
  module: string;

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
