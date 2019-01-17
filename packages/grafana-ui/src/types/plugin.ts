import { ComponentClass } from 'react';
import { PanelProps, PanelOptionsProps } from './panel';

export interface PluginExports {
  Datasource?: any;
  QueryCtrl?: any;
  QueryEditor?: any;
  ConfigCtrl?: any;
  AnnotationsQueryCtrl?: any;
  VariableQueryEditor?: any;
  ExploreQueryField?: any;
  ExploreStartPage?: any;

  // Panel plugin
  PanelCtrl?: any;
  Panel?: ComponentClass<PanelProps>;
  PanelOptions?: ComponentClass<PanelOptionsProps>;
  PanelDefaults?: any;
}

