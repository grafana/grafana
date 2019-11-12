import { GraphiteDatasource } from './datasource';
import { GraphiteQueryCtrl } from './query_ctrl';
import { GraphiteConfigCtrl } from './config_ctrl';
import { DataSourcePlugin } from '@grafana/data';
import { ConfigEditor } from './configuration/ConfigEditor';

class AnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export {
  GraphiteDatasource as Datasource,
  GraphiteQueryCtrl as QueryCtrl,
  GraphiteConfigCtrl as ConfigCtrl,
  AnnotationsQueryCtrl,
};

export const plugin = new DataSourcePlugin(GraphiteDatasource)
  .setQueryEditor(GraphiteQueryCtrl)
  .setConfigEditor(ConfigEditor)
  .setAnnotationQueryCtrl(AnnotationsQueryCtrl);
