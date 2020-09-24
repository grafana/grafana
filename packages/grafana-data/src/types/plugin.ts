import { ComponentClass } from 'react';
import { KeyValue } from './data';
import { LiveChannelSupport } from './live';

export enum PluginState {
  alpha = 'alpha', // Only included it `enable_alpha` is true
  beta = 'beta', // Will show a warning banner
  deprecated = 'deprecated', // Will continue to work -- but not show up in the options to add
}

export enum PluginType {
  panel = 'panel',
  datasource = 'datasource',
  app = 'app',
  renderer = 'renderer',
}

export enum PluginSignatureStatus {
  internal = 'internal', // core plugin, no signature
  valid = 'valid', // signed and accurate MANIFEST
  invalid = 'invalid', // invalid signature
  modified = 'modified', // valid signature, but content mismatch
  unsigned = 'unsigned', // no MANIFEST file
}

export interface PluginMeta<T extends KeyValue = {}> {
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
  enterprise?: boolean;
  latestVersion?: string;
  pinned?: boolean;
  signature?: PluginSignatureStatus;
  live?: boolean;
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

export interface PluginBuildInfo {
  time?: number;
  repo?: string;
  branch?: string;
  hash?: string;
  number?: number;
  pr?: number;
}

export interface ScreenshotInfo {
  name: string;
  path: string;
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
  build?: PluginBuildInfo;
  screenshots: ScreenshotInfo[];
  updated: string;
  version: string;
}

export interface PluginConfigPageProps<T extends PluginMeta> {
  plugin: GrafanaPlugin<T>;
  query: KeyValue; // The URL query parameters
}

export interface PluginConfigPage<T extends PluginMeta> {
  title: string; // Display
  icon?: string;
  id: string; // Unique, in URL

  body: ComponentClass<PluginConfigPageProps<T>>;
}

export class GrafanaPlugin<T extends PluginMeta = PluginMeta> {
  // Meta is filled in by the plugin loading system
  meta: T;

  // This is set if the plugin system had errors loading the plugin
  loadError?: boolean;

  /**
   * Live streaming support
   *
   * Note: `plugin.json` must also define `live: true`
   */
  channelSupport?: LiveChannelSupport;

  // Config control (app/datasource)
  angularConfigCtrl?: any;

  // Show configuration tabs on the plugin page
  configPages?: Array<PluginConfigPage<T>>;

  // Tabs on the plugin page
  addConfigPage(tab: PluginConfigPage<T>) {
    if (!this.configPages) {
      this.configPages = [];
    }
    this.configPages.push(tab);
    return this;
  }

  /**
   * Specify how the plugin should support paths within the live streaming environment
   */
  setChannelSupport(support: LiveChannelSupport) {
    this.channelSupport = support;
    return this;
  }

  constructor() {
    this.meta = {} as T;
  }
}
