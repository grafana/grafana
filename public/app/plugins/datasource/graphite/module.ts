import { DataSourcePlugin } from '@grafana/data';

import { GraphiteQueryEditor } from './components/GraphiteQueryEditor';
import { GraphiteVariableEditor } from './components/GraphiteVariableEditor';
import { MetricTankMetaInspector } from './components/MetricTankMetaInspector';
import { ConfigEditor } from './configuration/ConfigEditor';
import { GraphiteDatasource } from './datasource';

class AnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export const plugin = new DataSourcePlugin(GraphiteDatasource)
  .setQueryEditor(GraphiteQueryEditor)
  .setConfigEditor(ConfigEditor)
  .setVariableQueryEditor(GraphiteVariableEditor)
  .setMetadataInspector(MetricTankMetaInspector)
  .setAnnotationQueryCtrl(AnnotationsQueryCtrl);
