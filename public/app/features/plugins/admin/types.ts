import { EntityState } from '@reduxjs/toolkit';

import {
  PluginType,
  PluginSignatureStatus,
  PluginSignatureType,
  PluginDependencies,
  PluginErrorCode,
  PluginState,
  PluginInclude,
} from '@grafana/data';
import { IconName } from '@grafana/ui';
import { StoreState, PluginsState } from 'app/types';

export type PluginTypeCode = 'app' | 'panel' | 'datasource';

export enum PluginListDisplayMode {
  Grid = 'grid',
  List = 'list',
}

export enum PluginAdminRoutes {
  Home = 'plugins-home',
  Browse = 'plugins-browse',
  Details = 'plugins-details',
  HomeAdmin = 'plugins-home-admin',
  BrowseAdmin = 'plugins-browse-admin',
  DetailsAdmin = 'plugins-details-admin',
}

export enum PluginIconName {
  app = 'apps',
  datasource = 'database',
  panel = 'credit-card',
  renderer = 'capture',
  secretsmanager = 'key-skeleton-alt',
}

// The generic <T> describes how the `jsonData` object for the plugin looks like
export interface CatalogPlugin<T = {}> {
  id: string; // The identifier of the plugin
  name: string; // The name of the plugin
  orgName?: string; // The name of the organisation that published the plugin
  category?: string; // The
  description: string; // A short description of the plugin
  grafanaDependency?: string; // The supported Grafana version
  pluginDependencies?: PluginDependencies['plugins']; // Plugins that this plugin depends on
  includes?: PluginInclude[]; // Dashboards or pages included with the plugin
  readme?: string; // A more detailed documentation in markdown format
  state?: PluginState; // The lifecycle state of the plugin
  type: PluginType; // The type of the plugin, e.g. "panel", "app", etc.

  // Information about the author of the plugin
  author?: {
    name: string;
    url?: string;
  };
  // TODO: ???
  links?: Array<{
    name: string;
    url: string;
  }>;
  // The logos that belong to the plugin
  logos?: {
    small: string;
    large: string;
  };

  // Information related to the plugins catalog
  catalogInfo?: {
    downloads: number; // The number of times this plugin was downloaded
    hasUpdate: boolean; // Tells if the plugin has a new version published on GCOM than the currently installed version
    isCore: boolean; // Tells if the plugin was shipped with the core Grafana
    isDev: boolean; // TODO: ??????
    isEnterprise: boolean; // Tells if the plugin needs an enterprise license
    isPublished: boolean; // Tells if the plugin is published to GCOM
    popularity?: number; // TODO: ???
    publishedAt: string; // The time the plugin was first published to our catalog (TODO: check if this is correct)
    signature?: PluginSignatureStatus; // TODO: ???
    signatureOrg?: string; // TODO: ???
    signatureType?: PluginSignatureType; // TODO: ???
    updatedAt: string; // The last time a new version of the plugin was published to our catalog (TODO: check if this is correct)
    versions?: Version[]; // Available versions of the plugin in our catalog
  };

  // Information that is only available if the plugin is installed
  settings?: {
    baseUrl?: string; // TODO: specify this
    defaultNavUrl?: string; // TODO: ???
    enabled?: boolean; // Only relevant for "app" plugins
    isDisabled: boolean; // The plugin can be visible but still disabled for various reasons, but mostly due to errors. Set by the backend.
    isInstalled: boolean; // (TODO: is this redundant?) Tells if the plugin is installed on the current instance
    isPinned?: boolean; // TODO: ???
    jsonData?: T; // Plugin specific settings persisted on the backend
    module?: string; // TODO: specify this
    secureJsonData?: Record<string, any>; // Secure plugin specific settings persisted on the backend (This information is never sent down to the client once set)
    version?: string; // The installed version of the plugin
  };

  // Potential errors with the plugin
  error?: PluginErrorCode;
}
export interface CatalogPluginDetails {
  readme?: string;
  versions?: Version[];
  links: Array<{
    name: string;
    url: string;
  }>;
  grafanaDependency?: string;
  pluginDependencies?: PluginDependencies['plugins'];
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
    dependencies: PluginDependencies;
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
  name: string;
  pinned: boolean;
  signature: PluginSignatureStatus;
  signatureOrg: string;
  signatureType: PluginSignatureType;
  state: string;
  type: PluginType;
  dependencies: PluginDependencies;
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
  isCompatible: boolean;
  grafanaDependency: string | null;
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

export type CatalogPluginsState = {
  loading: boolean;
  error?: Error;
  plugins: CatalogPlugin[];
};

export enum PluginStatus {
  INSTALL = 'INSTALL',
  UNINSTALL = 'UNINSTALL',
  UPDATE = 'UPDATE',
  REINSTALL = 'REINSTALL',
}

export enum PluginTabLabels {
  OVERVIEW = 'Overview',
  VERSIONS = 'Version history',
  CONFIG = 'Config',
  DASHBOARDS = 'Dashboards',
  USAGE = 'Usage',
}

export enum PluginTabIds {
  OVERVIEW = 'overview',
  VERSIONS = 'version-history',
  CONFIG = 'config',
  DASHBOARDS = 'dashboards',
  USAGE = 'usage',
}

export enum RequestStatus {
  Pending = 'Pending',
  Fulfilled = 'Fulfilled',
  Rejected = 'Rejected',
}

export type RemotePluginResponse = {
  plugins: RemotePlugin[];
  error?: Error;
};

export type RequestInfo = {
  status: RequestStatus;
  // The whole error object
  error?: any;
  // An optional error message
  errorMessage?: string;
};

export type PluginDetailsTab = {
  label: PluginTabLabels | string;
  icon?: IconName | string;
  id: PluginTabIds | string;
  href?: string;
};

// TODO<remove `PluginsState &` when the "plugin_admin_enabled" feature flag is removed>
export type ReducerState = PluginsState & {
  items: EntityState<CatalogPlugin>;
  requests: Record<string, RequestInfo>;
  settings: {
    displayMode: PluginListDisplayMode;
  };
};

// TODO<remove when the "plugin_admin_enabled" feature flag is removed>
export type PluginCatalogStoreState = StoreState & { plugins: ReducerState };

// The data that we receive when fetching "/api/gnet/plugins/<plugin>/versions"
export type PluginVersion = {
  id: number;
  pluginId: number;
  pluginSlug: string;
  version: string;
  url: string;
  commit: string;
  description: string;
  createdAt: string;
  updatedAt?: string;
  downloads: number;
  verified: boolean;
  status: string;
  downloadSlug: string;
  links: Array<{ rel: string; href: string }>;
  isCompatible: boolean;
  grafanaDependency: string | null;
};
