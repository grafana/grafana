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

export interface PluginMetaJsonData {
  [str: string]: any;
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
  jsonData?: PluginMetaJsonData;
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

export interface PluginConfigSaveOptions<TData extends PluginMetaJsonData = PluginMetaJsonData> {
  jsonData?: TData;
  enable?: boolean; // App enable/disable flag

  /**
   * called after saving but before reloading the application
   */
  onAfterSave?: () => void;
}

export interface PluginConfigTabProps<TMeta, TData> {
  meta: TMeta;
  query: { [s: string]: any }; // The URL query parameters

  /**
   * Save the configs
   */
  onConfigSave: (options: PluginConfigSaveOptions<TData>) => void;
}

export interface PluginConfigTab<TMeta, TData> {
  title: string; // Display
  subTitle?: string;
  icon?: string;
  id: string; // Unique, in URL

  body: ComponentClass<PluginConfigTabProps<TMeta, TData>>;
}

export class PluginWithConfig<
  TMeta extends PluginMeta = PluginMeta,
  TData extends PluginMetaJsonData = PluginMetaJsonData
> {
  meta?: TMeta; // Set by the system

  configTabs?: Array<PluginConfigTab<TMeta, TData>>;

  // Legacy Angular based configs
  angular?: {
    ConfigCtrl?: any;
    pages: { [component: string]: any };
  };

  addConfigTab(tab: PluginConfigTab<TMeta, TData>) {
    if (!this.configTabs) {
      this.configTabs = [];
    }
    this.configTabs.push(tab);
    return this;
  }
}
