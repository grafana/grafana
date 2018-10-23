export interface PluginExports {
  PanelCtrl?;
  PanelComponent?: any;
  Datasource?: any;
  QueryCtrl?: any;
  ConfigCtrl?: any;
  AnnotationsQueryCtrl?: any;
  PanelOptions?: any;
}

export interface PanelPlugin {
  id: string;
  name: string;
  meta: any;
  hideFromList: boolean;
  module: string;
  baseUrl: string;
  info: any;
  sort: number;
  exports?: PluginExports;
}

export interface PluginMeta {
  id: string;
  name: string;
  info: PluginMetaInfo;
  includes: PluginInclude[];
}

export interface PluginInclude {
  type: string;
  name: string;
  path: string;
}

export interface PluginMetaInfo {
  author: {
    name: string;
    url: string;
  };
  description: string;
  links: string[];
  logos: {
    large: string;
    small: string;
  };
  screenshots: string;
  updated: string;
  version: string;
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
}
