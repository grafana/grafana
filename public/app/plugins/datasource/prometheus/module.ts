import { DataSourcePlugin } from '@grafana/data';
import { PrometheusDatasource } from './datasource';

import { PromQueryEditor } from './components/PromQueryEditor';
import PromCheatSheet from './components/PromCheatSheet';
import PromQueryField from './components/PromQueryField';

import { ConfigEditor } from './configuration/ConfigEditor';

class PrometheusAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export const plugin = new DataSourcePlugin(PrometheusDatasource)
  .setQueryEditor(PromQueryEditor)
  .setConfigEditor(ConfigEditor)
  .setExploreMetricsQueryField(PromQueryField)
  .setAnnotationQueryCtrl(PrometheusAnnotationsQueryCtrl)
  .setExploreStartPage(PromCheatSheet);
