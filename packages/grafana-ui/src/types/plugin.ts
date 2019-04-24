export enum PluginState {
  alpha = 'alpha', // Only included it `enable_alpha` is true
  beta = 'beta', // Will show a warning banner
}

export enum PluginType {
  panel = 'panel',
  datasource = 'datasource',
  app = 'app',
}

export interface PluginMeta {
  id: string;
  name: string;
  type: PluginType;
  info: PluginMetaInfo;
  includes?: PluginInclude[];
  state?: PluginState;

  // System.load & relative URLS
  module: string;
  baseUrl: string;

  // Filled in by the backend
  jsonData?: { [str: string]: any };
  enabled?: boolean;

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

export enum PluginIncludeType {
  dashboard = 'dashboard',
  page = 'page',

  // Only valid for apps
  panel = 'panel',
  datasource = 'datasource',
}

export interface PluginInclude {
  type: PluginIncludeType;
  name: string;
  path?: string;
  icon?: string;
  // Angular app pages
  component?: string;
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

export class AppPlugin {
  meta: PluginMeta;

  angular?: {
    ConfigCtrl?: any;
    pages: { [component: string]: any };
  };

  constructor(meta: PluginMeta, pluginExports: any) {
    this.meta = meta;
    const legacy = {
      ConfigCtrl: undefined,
      pages: {} as any,
    };

    if (pluginExports.ConfigCtrl) {
      legacy.ConfigCtrl = pluginExports.ConfigCtrl;
      this.angular = legacy;
    }

    if (meta.includes) {
      for (const include of meta.includes) {
        const { type, component } = include;
        if (type === PluginIncludeType.page && component) {
          const exp = pluginExports[component];
          if (!exp) {
            console.warn('App Page uses unknown component: ', component, meta);
            continue;
          }
          legacy.pages[component] = exp;
          this.angular = legacy;
        }
      }
    }
  }
}
