import { DataSourcePlugin } from '@grafana/data';

import { ConfigEditor } from './components/ConfigEditor';
import OpenTsDatasource from './datasource';
import { OpenTsQueryCtrl } from './query_ctrl';

class AnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export const plugin = new DataSourcePlugin(OpenTsDatasource)
  .setQueryCtrl(OpenTsQueryCtrl)
  .setConfigEditor(ConfigEditor)
  .setAnnotationQueryCtrl(AnnotationsQueryCtrl);
