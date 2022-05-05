import { DataSourcePlugin } from '@grafana/data';

import PromCheatSheet from './components/PromCheatSheet';
import PromQueryEditorByApp from './components/PromQueryEditorByApp';
import { ConfigEditor } from './configuration/ConfigEditor';
import { ANNOTATION_QUERY_STEP_DEFAULT, PrometheusDatasource } from './datasource';

class PrometheusAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
  stepDefaultValuePlaceholder = ANNOTATION_QUERY_STEP_DEFAULT;
}

export const plugin = new DataSourcePlugin(PrometheusDatasource)
  .setQueryEditor(PromQueryEditorByApp)
  .setConfigEditor(ConfigEditor)
  .setAnnotationQueryCtrl(PrometheusAnnotationsQueryCtrl)
  .setQueryEditorHelp(PromCheatSheet);
