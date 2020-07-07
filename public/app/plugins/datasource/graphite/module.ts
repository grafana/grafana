import { GraphiteDatasource } from './datasource';
import { GraphiteQueryCtrl } from './query_ctrl';
import { DataSourcePlugin } from '@grafana/data';
import { ConfigEditor } from './configuration/ConfigEditor';
import { MetricTankMetaInspector } from './MetricTankMetaInspector';

class AnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export const plugin = new DataSourcePlugin(GraphiteDatasource)
  .setQueryCtrl(GraphiteQueryCtrl)
  .setConfigEditor(ConfigEditor)
  .setMetadataInspector(MetricTankMetaInspector)
  .setAnnotationQueryCtrl(AnnotationsQueryCtrl);
