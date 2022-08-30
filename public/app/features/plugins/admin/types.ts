import { EntityState } from '@reduxjs/toolkit';

import {
  PluginType,
  PluginSignatureStatus,
  PluginSignatureType,
  PluginDependencies,
  PluginErrorCode,
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
}

export enum PluginIconName {
  app = 'apps',
  datasource = 'database',
  panel = 'credit-card',
  renderer = 'capture',
  secretsmanager = 'key-skeleton-alt',
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
  isDisabled: boolean;
  // `isPublished` is TRUE if the plugin is published to grafana.com
  isPublished: boolean;
  name: string;
  orgName: string;
  signature: PluginSignatureStatus;
  signatureType?: PluginSignatureType;
  signatureOrg?: string;
  popularity: number;
  publishedAt: string;
  type?: PluginType;
  updatedAt: string;
  installedVersion?: string;
  details?: CatalogPluginDetails;
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
