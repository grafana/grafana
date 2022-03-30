import { GraphiteDatasource } from './datasource';
import { DataSourcePlugin } from '@grafana/data';
import { ConfigEditor } from './configuration/ConfigEditor';
import { MetricTankMetaInspector } from './components/MetricTankMetaInspector';
import { GraphiteQueryEditor } from './components/GraphiteQueryEditor';

class AnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export const plugin = new DataSourcePlugin(GraphiteDatasource)
  .setQueryEditor(GraphiteQueryEditor)
  .setConfigEditor(ConfigEditor)
  .setMetadataInspector(MetricTankMetaInspector)
  .setAnnotationQueryCtrl(AnnotationsQueryCtrl);
