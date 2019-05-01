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
  defaultNavUrl?: string;
  hasUpdate?: boolean;
  latestVersion?: string;
  pinned?: boolean;
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

export interface PluginConfigSaveOptions {
  jsonData?: { [str: string]: any };
  enable?: boolean; // App enable/disable flag

  /**
   * called after saving but before reloading the application
   */
  onAfterSave?: () => void;
}

export interface PluginConfigTabProps<T extends PluginMeta> {
  meta: T;
  query: { [s: string]: any }; // The URL query parameters

  /**
   * Save the configs
   */
  onConfigSave: (options: PluginConfigSaveOptions) => void;
}

export interface PluginConfigTab<T extends PluginMeta> {
  title: string; // Display
  icon?: string;
  id: string; // Unique, in URL

  body: ComponentClass<PluginConfigTabProps<T>>;
}

export class GrafanaPlugin<T extends PluginMeta = PluginMeta> {
  // Meta is filled in by the plugin loading system
  meta?: T;

  // Config control (app/datasource)
  angularConfigCtrl?: any;

  // Show configuration tabs on the plugin page
  configTabs?: Array<PluginConfigTab<T>>;

  // Tabs on the plugin page
  addConfigTab(tab: PluginConfigTab<T>) {
    if (!this.configTabs) {
      this.configTabs = [];
    }
    this.configTabs.push(tab);
    return this;
  }
}
