import { ComponentType } from 'react';

import { KeyValue } from './data';
import { IconName } from './icon';

/** Describes plugins life cycle status */
export enum PluginState {
  alpha = 'alpha', // Only included if `enable_alpha` config option is true
  beta = 'beta', // Will show a warning banner
  stable = 'stable', // Will not show anything
  deprecated = 'deprecated', // Will continue to work -- but not show up in the options to add
}

/** Describes {@link https://grafana.com/docs/grafana/latest/plugins | type of plugin} */
export enum PluginType {
  panel = 'panel',
  datasource = 'datasource',
  app = 'app',
  renderer = 'renderer',
  secretsmanager = 'secretsmanager',
}

/** Describes status of {@link https://grafana.com/docs/grafana/latest/plugins/plugin-signatures/ | plugin signature} */
export enum PluginSignatureStatus {
  internal = 'internal', // core plugin, no signature
  valid = 'valid', // signed and accurate MANIFEST
  invalid = 'invalid', // invalid signature
  modified = 'modified', // valid signature, but content mismatch
  missing = 'missing', // missing signature file
}

/** Describes level of {@link https://grafana.com/docs/grafana/latest/plugins/plugin-signatures/#plugin-signature-levels/ | plugin signature level} */
export enum PluginSignatureType {
  grafana = 'grafana',
  commercial = 'commercial',
  community = 'community',
  private = 'private',
  core = 'core',
}

/** Describes error code returned from Grafana plugins API call */
export enum PluginErrorCode {
  missingSignature = 'signatureMissing',
  invalidSignature = 'signatureInvalid',
  modifiedSignature = 'signatureModified',
  failedBackendStart = 'failedBackendStart',
  angular = 'angular',
}

/** Describes error returned from Grafana plugins API call */
export interface PluginError {
  errorCode: PluginErrorCode;
  pluginId: string;
  pluginType?: PluginType;
}

export interface AngularMeta {
  detected: boolean;
  hideDeprecation: boolean;
}

// Signals to SystemJS how to load frontend js assets.
export enum PluginLoadingStrategy {
  fetch = 'fetch',
  script = 'script',
}

export interface PluginMeta<T extends KeyValue = {}> {
  id: string;
  name: string;
  type: PluginType;
  info: PluginMetaInfo;
  includes?: PluginInclude[];
  state?: PluginState;
  aliasIDs?: string[];

  // System.load & relative URLS
  module: string;
  baseUrl: string;

  // Define plugin requirements
  dependencies?: PluginDependencies;

  // Filled in by the backend
  jsonData?: T;
  secureJsonData?: KeyValue;
  secureJsonFields?: KeyValue<boolean>;
  enabled?: boolean;
  autoEnabled?: boolean;
  defaultNavUrl?: string;
  hasUpdate?: boolean;
  enterprise?: boolean;
  latestVersion?: string;
  pinned?: boolean;
  signature?: PluginSignatureStatus;
  signatureType?: PluginSignatureType;
  signatureOrg?: string;
  live?: boolean;
  angular?: AngularMeta;
  angularDetected?: boolean;
  loadingStrategy?: PluginLoadingStrategy;
  extensions?: PluginExtensions;
  moduleHash?: string;
}

interface PluginDependencyInfo {
  id: string;
  name: string;
  version: string;
  type: PluginType;
}

export interface PluginDependencies {
  grafanaDependency?: string;
  grafanaVersion: string;
  plugins: PluginDependencyInfo[];
  extensions: {
    // A list of exposed component IDs
    exposedComponents: string[];
  };
}

export type ExtensionInfo = {
  targets: string | string[];
  title: string;
  description?: string;
};

export interface PluginExtensions {
  // The component extensions that the plugin registers
  addedComponents: ExtensionInfo[];

  // The link extensions that the plugin registers
  addedLinks: ExtensionInfo[];

  // The React components that the plugin exposes
  exposedComponents: Array<{
    id: string;
    title: string;
    description?: string;
  }>;

  // The extension points that the plugin provides
  extensionPoints: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
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

  // "Admin", "Editor" or "Viewer". If set then the include will only show up in the navigation if the user has the required roles.
  role?: string;

  // if action is set then the include will only show up in the navigation if the user has the required permission.
  // The action will take precedence over the role.
  action?: string;

  // Adds the "page" or "dashboard" type includes to the navigation if set to `true`.
  addToNav?: boolean;

  // Angular app pages
  component?: string;
}

interface PluginMetaInfoLink {
  name: string;
  url: string;
  target?: '_blank' | '_self' | '_parent' | '_top';
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
  icon?: IconName;
  id: string; // Unique, in URL

  body: ComponentType<PluginConfigPageProps<T>>;
}

export class GrafanaPlugin<T extends PluginMeta = PluginMeta> {
  // Meta is filled in by the plugin loading system
  meta: T;

  // This is set if the plugin system had errors loading the plugin
  loadError?: boolean;

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
   * @deprecated -- this is no longer necessary and will be removed
   */
  setChannelSupport() {
    console.warn('[deprecation] plugin is using ignored option: setChannelSupport', this.meta);
    return this;
  }

  constructor() {
    this.meta = {} as T;
  }
}
