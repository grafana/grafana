import InfluxDatasource from './datasource';
import { InfluxQueryCtrl } from './query_ctrl';
import { InfluxAnnotationsQueryCtrl } from './annotations_ctrl';
import InfluxStartPage from './components/InfluxStartPage';
import { DataSourcePlugin } from '@grafana/data';
import ConfigEditor from './components/ConfigEditor';

// This adds a directive that is used in the query editor
import './components/FluxQueryEditor';
import './components/AnnotationQueryEditor';

export const plugin = new DataSourcePlugin(InfluxDatasource)
  .setConfigEditor(ConfigEditor)
  .setQueryCtrl(InfluxQueryCtrl)
  .setAnnotationQueryCtrl(InfluxAnnotationsQueryCtrl)
  .setExploreStartPage(InfluxStartPage);
