import { PluginExports, PluginMetaInfo } from '@grafana/ui/src/types';

export interface PanelPlugin {
  id: string;
  name: string;
  hideFromList?: boolean;
  module: string;
  baseUrl: string;
  info: PluginMetaInfo;
  sort: number;
  exports?: PluginExports;
  dataFormats: PanelDataFormat[];
}

export enum PanelDataFormat {
  Table = 'table',
  TimeSeries = 'time_series',
}

export interface Plugin {
  defaultNavUrl: string;
  enabled: boolean;
  hasUpdate: boolean;
  id: string;
  info: PluginMetaInfo;
  latestVersion: string;
  name: string;
  pinned: boolean;
  state: string;
  type: string;
  module: any;
}

export interface PluginDashboard {
  dashboardId: number;
  description: string;
  folderId: number;
  imported: boolean;
  importedRevision: number;
  importedUri: string;
  importedUrl: string;
  path: string;
  pluginId: string;
  removed: boolean;
  revision: number;
  slug: string;
  title: string;
}

export interface PluginsState {
  plugins: Plugin[];
  searchQuery: string;
  layoutMode: string;
  hasFetched: boolean;
  dashboards: PluginDashboard[];
  isLoadingPluginDashboards: boolean;
}

export interface VariableQueryProps {
  query: any;
  onChange: (query: any, definition: string) => void;
  datasource: any;
  templateSrv: any;
}
