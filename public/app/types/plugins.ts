import { AngularPanelPlugin, PanelPlugin, PluginMeta } from '@grafana/ui/src/types';

export interface PanelPluginMeta extends PluginMeta {
  hideFromList?: boolean;
  sort: number;
  angularPlugin: AngularPanelPlugin | null;
  vizPlugin: PanelPlugin | null;
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
