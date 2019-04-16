import { ComponentClass } from 'react';

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

export interface AppPagePlugin {
  getPageNav: () => any;
}

export interface PluginConfigPage<TPlugin> {
  title: string; // Name of the table
  subTitle?: string;
  icon?: string;

  body: ComponentClass<PluginConfigPageProps<TPlugin>>;
}

export interface PluginConfigPageProps<T> {
  plugin: T;

  onConfigSave: () => void; //
  beforeConfigSaved: () => void;
  afterConfigSaved: () => void;
}

export class PluginWithConfig<TPlugin> {
  meta?: PluginMeta;

  configPage?: PluginConfigPage<TPlugin>;
  configTabs?: Array<PluginConfigPage<TPlugin>>;

  // Legacy Angular based configs
  angular?: {
    ConfigCtrl?: any;
    pages: { [component: string]: any };
  };

  /**
   * Use PluginMeta to find relevant configs in include
   */
  initLegacyComponents(meta: PluginMeta, pluginExports: any) {
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
            console.warn('Plugin references unknown component: ', component, meta);
            continue;
          }
          legacy.pages[component] = exp;
          this.angular = legacy;
        }
      }
    }
  }

  setConfigPage(page: PluginConfigPage<TPlugin>): TPlugin {
    this.configPage = page;
    return (this as unknown) as TPlugin;
  }

  addConfigTab(tab: PluginConfigPage<TPlugin>): TPlugin {
    if (!this.configTabs) {
      this.configTabs = [];
    }
    this.configTabs.push(tab);
    return (this as unknown) as TPlugin;
  }
}

export interface AppPluginPageProps<T> {
  plugin: T;
  path?: string; // The path (everythign after the configured pathPrefix)
}

export interface AppPluginPage<T> {
  pathPrefix: string; //
  plugin: T;
  getPageNav: () => void;
  body: AppPluginPageProps<T>;
}

export class AppPlugin extends PluginWithConfig<AppPlugin> {
  pages?: Array<AppPluginPage<AppPlugin>>;

  /**
   * Add a page that is rendered under:
   *  /a/${plugin-id}/
   *
   * The first matching page will be used.
   */
  addPage(page: AppPluginPage<AppPlugin>): AppPlugin {
    if (!this.pages) {
      this.pages = [];
    }
    this.pages.push(page);
    return this;
  }
}
