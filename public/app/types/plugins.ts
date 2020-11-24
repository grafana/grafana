import { PluginError, PluginMeta } from '@grafana/data';
import { PanelPlugin } from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';

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

export interface PanelPluginsIndex {
  [id: string]: PanelPlugin;
}

export interface PluginsState {
  plugins: PluginMeta[];
  errors: PluginError[];
  searchQuery: string;
  hasFetched: boolean;
  dashboards: PluginDashboard[];
  isLoadingPluginDashboards: boolean;
  panels: PanelPluginsIndex;
}

export interface VariableQueryProps {
  query: any;
  onChange: (query: any, definition: string) => void;
  datasource: any;
  templateSrv: TemplateSrv;
}
