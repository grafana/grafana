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
  logos: {
    large: string;
    small: string;
  };
}
