import { LayoutMode } from '../core/components/LayoutSelector/LayoutSelector';
import { Plugin } from './plugins';

export interface DataSourcePermission {
  id: number;
  datasourceId: number;
  permission: number;
  permissionName: string;
  created: string;
  updated: string;
  userId?: number;
  userLogin?: string;
  userEmail?: string;
  userAvatarUrl?: string;
  teamId?: number;
  teamAvatarUrl?: string;
  team?: string;
}

export interface DataSourcePermissionDTO {
  datasourceId: number;
  enabled: boolean;
  permissions: DataSourcePermission[];
}

export interface DataSource {
  id: number;
  orgId: number;
  name: string;
  typeLogoUrl: string;
  type: string;
  access: string;
  url: string;
  password: string;
  user: string;
  database: string;
  basicAuth: boolean;
  basicAuthPassword: string;
  basicAuthUser: string;
  isDefault: boolean;
  jsonData: { authType: string; defaultRegion: string };
  readOnly: boolean;
  withCredentials: boolean;
}

export interface DataSourcesState {
  dataSources: DataSource[];
  searchQuery: string;
  dataSourceTypeSearchQuery: string;
  layoutMode: LayoutMode;
  dataSourcesCount: number;
  dataSourceTypes: Plugin[];
  hasFetched: boolean;
  dataSource: DataSource;
  dataSourceMeta: Plugin;
  dataSourcePermission: DataSourcePermissionDTO;
}
