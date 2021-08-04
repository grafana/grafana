import { GrafanaPlugin, PluginMeta, PluginType, PluginSignatureStatus, PluginSignatureType } from '@grafana/data';
export type PluginTypeCode = 'app' | 'panel' | 'datasource';

export enum PluginAdminRoutes {
  Home = 'plugins-home',
  Browse = 'plugins-browse',
  Details = 'plugins-details',
  HomeAdmin = 'plugins-home-admin',
  BrowseAdmin = 'plugins-browse-admin',
  DetailsAdmin = 'plugins-details-admin',
}

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
  signature: PluginSignatureStatus;
  popularity: number;
  publishedAt: string;
  type?: PluginType;
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

export type RemotePlugin = {
  createdAt: string;
  description: string;
  downloads: number;
  downloadSlug: string;
  featured: number;
  id: number;
  internal: boolean;
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
  links: Array<{ rel: string; href: string }>;
  name: string;
  orgId: number;
  orgName: string;
  orgSlug: string;
  orgUrl: string;
  packages: {
    [arch: string]: {
      packageName: string;
      downloadUrl: string;
    };
  };
  popularity: number;
  readme?: string;
  signatureType: PluginSignatureType | '';
  slug: string;
  status: string;
  typeCode: PluginType;
  typeId: number;
  typeName: string;
  updatedAt: string;
  url: string;
  userId: number;
  verified: boolean;
  version: string;
  versionSignatureType: PluginSignatureType | '';
  versionSignedByOrg: string;
  versionSignedByOrgName: string;
  versionStatus: string;
};

export type LocalPlugin = {
  category: string;
  defaultNavUrl: string;
  dev?: boolean;
  enabled: boolean;
  hasUpdate: boolean;
  id: string;
  info: {
    author: Rel;
    description: string;
    links?: Rel[];
    logos: {
      small: string;
      large: string;
    };
    build: Build;
    screenshots?: Array<{
      path: string;
      name: string;
    }> | null;
    version: string;
    updated: string;
  };
  latestVersion: string;
  name: string;
  pinned: boolean;
  signature: PluginSignatureStatus;
  signatureOrg: string;
  signatureType: string;
  state: string;
  type: PluginType;
};

interface Rel {
  name: string;
  url: string;
}

export interface Build {
  time?: number;
  repo?: string;
  branch?: string;
  hash?: string;
}

export interface Version {
  version: string;
  createdAt: string;
}

export interface PluginDetails {
  remote?: RemotePlugin;
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

export type CatalogPluginsState = {
  loading: boolean;
  error?: Error;
  plugins: CatalogPlugin[];
};

export type FilteredPluginsState = {
  isLoading: boolean;
  error?: Error;
  plugins: CatalogPlugin[];
};

export type PluginsByFilterType = {
  searchBy: string;
  filterBy: string;
  filterByType: string;
};

export type PluginFilter = (plugin: CatalogPlugin, query: string) => boolean;
