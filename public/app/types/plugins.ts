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
