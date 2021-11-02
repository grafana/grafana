import { GraphiteDatasource } from './datasource';
import { DataSourcePlugin } from '@grafana/data';
import { ConfigEditor } from './configuration/ConfigEditor';
import { MetricTankMetaInspector } from './components/MetricTankMetaInspector';
import { GraphiteQueryEditor } from './components/GraphiteQueryEditor';
var AnnotationsQueryCtrl = /** @class */ (function () {
    function AnnotationsQueryCtrl() {
    }
    AnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';
    return AnnotationsQueryCtrl;
}());
export var plugin = new DataSourcePlugin(GraphiteDatasource)
    .setQueryEditor(GraphiteQueryEditor)
    .setConfigEditor(ConfigEditor)
    .setMetadataInspector(MetricTankMetaInspector)
    .setAnnotationQueryCtrl(AnnotationsQueryCtrl);
//# sourceMappingURL=module.js.map