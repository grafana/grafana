import { DataSourcePlugin } from '@grafana/data';
import { PrometheusDatasource } from './datasource';

import { PromQueryEditor } from './components/PromQueryEditor';
import PromCheatSheet from './components/PromCheatSheet';
import PromExploreQueryEditor from './components/PromExploreQueryEditor';

import { ConfigEditor } from './configuration/ConfigEditor';

class PrometheusAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export const plugin = new DataSourcePlugin(PrometheusDatasource)
  .setQueryEditor(PromQueryEditor)
  .setConfigEditor(ConfigEditor)
  .setExploreMetricsQueryField(PromExploreQueryEditor)
  .setAnnotationQueryCtrl(PrometheusAnnotationsQueryCtrl)
  .setExploreStartPage(PromCheatSheet);
