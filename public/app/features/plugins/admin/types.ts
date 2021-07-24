import { GrafanaPlugin, PluginMeta } from '@grafana/data';
export type PluginTypeCode = 'app' | 'panel' | 'datasource';
export interface CatalogPlugin {
  description: string;
  downloads: number;
  hasUpdate: boolean;
  id: string;
  info: CatalogPluginInfo;
  isDev: boolean;
  isCore: boolean;
  isEnterprise: boolean;
  isInstalled: boolean;
  name: string;
  orgName: string;
  popularity: number;
  publishedAt: string;
  type: string;
  updatedAt: string;
  version: string;
}

export interface CatalogPluginDetails extends CatalogPlugin {
  readme: string;
  versions: Version[];
  links: Array<{
    name: string;
    url: string;
  }>;
  grafanaDependency?: string;
}

export interface CatalogPluginInfo {
  logos: {
    large: string;
    small: string;
  };
}

export interface Plugin {
  name: string;
  description: string;
  slug: string;
  orgName: string;
  orgSlug: string;
  signatureType: string;
  version: string;
  status: string;
  popularity: number;
  downloads: number;
  updatedAt: string;
  createdAt: string;
  typeCode: string;
  featured: number;
  readme: string;
  internal: boolean;
  versionSignatureType: string;
  packages: {
    [arch: string]: {
      packageName: string;
      downloadUrl: string;
    };
  };
  links: Array<{
    rel: string;
    href: string;
  }>;
  json?: {
    dependencies: {
      grafanaDependency: string;
      grafanaVersion: string;
    };
    info: {
      links: Array<{
        name: string;
        url: string;
      }>;
    };
  };
}

export type LocalPlugin = {
  category: string;
  defaultNavUrl: string;
  enabled: boolean;
  hasUpdate: boolean;
  id: string;
  info: {
    author: {
      name: string;
      url: string;
    };
    build: {};
    description: string;
    links: Array<{
      name: string;
      url: string;
    }>;
    logos: {
      large: string;
      small: string;
    };
    updated: string;
    version: string;
  };
  latestVersion: string;
  name: string;
  pinned: boolean;
  signature: string;
  signatureOrg: string;
  signatureType: string;
  state: string;
  type: string;
  dev: boolean | undefined;
};

export interface Version {
  version: string;
  createdAt: string;
}

export interface PluginDetails {
  remote?: Plugin;
  remoteVersions?: Version[];
  local?: LocalPlugin;
}

export interface Org {
  slug: string;
  name: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  avatar: string;
  avatarUrl: string;
}

export interface PluginDetailsState {
  hasInstalledPanel: boolean;
  hasUpdate: boolean;
  isAdmin: boolean;
  isInstalled: boolean;
  isInflight: boolean;
  loading: boolean;
  error?: Error;
  plugin?: CatalogPluginDetails;
  pluginConfig?: GrafanaPlugin<PluginMeta<{}>>;
  tabs: Array<{ label: string }>;
  activeTab: number;
}

export enum ActionTypes {
  LOADING = 'LOADING',
  INFLIGHT = 'INFLIGHT',
  INSTALLED = 'INSTALLED',
  UNINSTALLED = 'UNINSTALLED',
  UPDATED = 'UPDATED',
  ERROR = 'ERROR',
  FETCHED_PLUGIN = 'FETCHED_PLUGIN',
  FETCHED_PLUGIN_CONFIG = 'FETCHED_PLUGIN_CONFIG',
  UPDATE_TABS = 'UPDATE_TABS',
  SET_ACTIVE_TAB = 'SET_ACTIVE_TAB',
}

export type PluginDetailsActions =
  | { type: ActionTypes.FETCHED_PLUGIN; payload: CatalogPluginDetails }
  | { type: ActionTypes.ERROR; payload: Error }
  | { type: ActionTypes.FETCHED_PLUGIN_CONFIG; payload?: GrafanaPlugin<PluginMeta<{}>> }
  | {
      type: ActionTypes.UPDATE_TABS;
      payload: Array<{ label: string }>;
    }
  | { type: ActionTypes.INSTALLED; payload: boolean }
  | { type: ActionTypes.SET_ACTIVE_TAB; payload: number }
  | {
      type: ActionTypes.LOADING | ActionTypes.INFLIGHT | ActionTypes.UNINSTALLED | ActionTypes.UPDATED;
    };
