import InfluxDatasource from './datasource';
import { InfluxQueryCtrl } from './query_ctrl';
import { InfluxLogsQueryField } from './components/InfluxLogsQueryField';
import InfluxStartPage from './components/InfluxStartPage';
import { DataSourcePlugin } from '@grafana/data';
import ConfigEditor from './components/ConfigEditor';

class InfluxAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export const plugin = new DataSourcePlugin(InfluxDatasource)
  .setConfigEditor(ConfigEditor)
  .setQueryCtrl(InfluxQueryCtrl)
  .setAnnotationQueryCtrl(InfluxAnnotationsQueryCtrl)
  .setExploreLogsQueryField(InfluxLogsQueryField)
  .setExploreStartPage(InfluxStartPage);
