import InfluxDatasource from './datasource';
import { QueryEditor } from './components/QueryEditor';
import InfluxStartPage from './components/InfluxStartPage';
import { DataSourcePlugin } from '@grafana/data';
import ConfigEditor from './components/ConfigEditor';
import VariableQueryEditor from './components/VariableQueryEditor';

class InfluxAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export const plugin = new DataSourcePlugin(InfluxDatasource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor)
  .setAnnotationQueryCtrl(InfluxAnnotationsQueryCtrl)
  .setVariableQueryEditor(VariableQueryEditor)
  .setQueryEditorHelp(InfluxStartPage);
