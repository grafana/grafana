import InfluxDatasource from './datasource';
import { InfluxQueryCtrl } from './query_ctrl';
import { QueryEditor } from './components/QueryEditor';
import InfluxStartPage from './components/InfluxStartPage';
import { DataSourcePlugin } from '@grafana/data';
import ConfigEditor from './components/ConfigEditor';
import VariableQueryEditor from './components/VariableQueryEditor';

// This adds a directive that is used in the query editor
import './components/FluxQueryEditor';

// This adds a directive that is used in the query editor
import './registerRawInfluxQLEditor';

class InfluxAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

const ENABLE_REACT_QUERY_EDITOR = true;

const plugin = new DataSourcePlugin(InfluxDatasource)
  .setConfigEditor(ConfigEditor)
  .setAnnotationQueryCtrl(InfluxAnnotationsQueryCtrl)
  .setVariableQueryEditor(VariableQueryEditor)
  .setQueryEditorHelp(InfluxStartPage);

if (ENABLE_REACT_QUERY_EDITOR) {
  plugin.setQueryEditor(QueryEditor);
} else {
  plugin.setQueryCtrl(InfluxQueryCtrl);
}

export { plugin };
