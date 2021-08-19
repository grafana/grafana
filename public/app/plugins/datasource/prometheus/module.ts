import { DataSourcePlugin } from '@grafana/data';
import { ANNOTATION_QUERY_STEP_DEFAULT, PrometheusDatasource } from './datasource';

import PromQueryEditorByApp from './components/PromQueryEditorByApp';
import PromCheatSheet from './components/PromCheatSheet';
import PromExploreQueryEditor from './components/PromExploreQueryEditor';

import { ConfigEditor } from './configuration/ConfigEditor';

class PrometheusAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
  stepDefaultValuePlaceholder = ANNOTATION_QUERY_STEP_DEFAULT;
}

export const plugin = new DataSourcePlugin(PrometheusDatasource)
  .setQueryEditor(PromQueryEditorByApp)
  .setConfigEditor(ConfigEditor)
  .setExploreMetricsQueryField(PromExploreQueryEditor)
  .setAnnotationQueryCtrl(PrometheusAnnotationsQueryCtrl)
  .setQueryEditorHelp(PromCheatSheet);
