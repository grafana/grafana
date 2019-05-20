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

export type KeyValue<T = any> = { [s: string]: T };

export interface PluginMeta<T extends {} = KeyValue> {
  id: string;
  name: string;
  type: PluginType;
  info: PluginMetaInfo;
  includes?: PluginInclude[];
  state?: PluginState;

  // System.load & relative URLS
  module: string;
  baseUrl: string;

  // Define plugin requirements
  dependencies?: PluginDependencies;

  // Filled in by the backend
  jsonData?: T;
  secureJsonData?: KeyValue;
  enabled?: boolean;
  defaultNavUrl?: string;
  hasUpdate?: boolean;
  latestVersion?: string;
  pinned?: boolean;
}

interface PluginDependencyInfo {
  id: string;
  name: string;
  version: string;
  type: PluginType;
}

export interface PluginDependencies {
  grafanaVersion: string;
  plugins: PluginDependencyInfo[];
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

  role?: string; // "Viewer", Admin, editor???
  addToNav?: boolean; // Show in the sidebar... only if type=page?

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

export interface PluginConfigPageProps<T extends GrafanaPlugin> {
  plugin: T;
  query: KeyValue; // The URL query parameters
}

export interface PluginConfigPage<T extends GrafanaPlugin> {
  title: string; // Display
  icon?: string;
  id: string; // Unique, in URL

  body: ComponentClass<PluginConfigPageProps<T>>;
}

export class GrafanaPlugin<T extends PluginMeta = PluginMeta> {
  // Meta is filled in by the plugin loading system
  meta?: T;

  // Config control (app/datasource)
  angularConfigCtrl?: any;

  // Show configuration tabs on the plugin page
  configPages?: Array<PluginConfigPage<GrafanaPlugin>>;

  // Tabs on the plugin page
  addConfigPage(tab: PluginConfigPage<GrafanaPlugin>) {
    if (!this.configPages) {
      this.configPages = [];
    }
    this.configPages.push(tab);
    return this;
  }
}
