import InfluxDatasource from './datasource';
import { InfluxQueryCtrl } from './query_ctrl';
import InfluxStartPage from './components/InfluxStartPage';
import { DataSourcePlugin } from '@grafana/data';
import ConfigEditor from './components/ConfigEditor';
import VariableQueryEditor from './components/VariableQueryEditor';

// This adds a directive that is used in the query editor
import './components/FluxQueryEditor';

class InfluxAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export const plugin = new DataSourcePlugin(InfluxDatasource)
  .setConfigEditor(ConfigEditor)
  .setQueryCtrl(InfluxQueryCtrl)
  .setAnnotationQueryCtrl(InfluxAnnotationsQueryCtrl)
  .setVariableQueryEditor(VariableQueryEditor)
  .setExploreStartPage(InfluxStartPage);
