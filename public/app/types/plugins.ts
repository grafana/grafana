import { PluginMeta } from '@grafana/data';

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
  plugins: PluginMeta[];
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
