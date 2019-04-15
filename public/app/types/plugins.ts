import { AngularPanelPlugin, ReactPanelPlugin, PluginMetaInfo, PluginMeta } from '@grafana/ui/src/types';

export interface PanelPlugin extends PluginMeta {
  hideFromList?: boolean;
  baseUrl: string;
  info: PluginMetaInfo;
  sort: number;
  angularPlugin: AngularPanelPlugin | null;
  reactPlugin: ReactPanelPlugin | null;
  hasBeenImported?: boolean;
  dataFormats: PanelDataFormat[];
}

export enum PanelDataFormat {
  Table = 'table',
  TimeSeries = 'time_series',
}

/**
 * Values we don't want in the public API
 */
export interface Plugin extends PluginMeta {
  defaultNavUrl: string;
  hasUpdate: boolean;
  latestVersion: string;
  pinned: boolean;
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
