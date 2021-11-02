import { DataSourcePlugin } from '@grafana/data';
import { ANNOTATION_QUERY_STEP_DEFAULT, PrometheusDatasource } from './datasource';
import PromQueryEditorByApp from './components/PromQueryEditorByApp';
import PromCheatSheet from './components/PromCheatSheet';
import PromExploreQueryEditor from './components/PromExploreQueryEditor';
import { ConfigEditor } from './configuration/ConfigEditor';
var PrometheusAnnotationsQueryCtrl = /** @class */ (function () {
    function PrometheusAnnotationsQueryCtrl() {
        this.stepDefaultValuePlaceholder = ANNOTATION_QUERY_STEP_DEFAULT;
    }
    PrometheusAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';
    return PrometheusAnnotationsQueryCtrl;
}());
export var plugin = new DataSourcePlugin(PrometheusDatasource)
    .setQueryEditor(PromQueryEditorByApp)
    .setConfigEditor(ConfigEditor)
    .setExploreMetricsQueryField(PromExploreQueryEditor)
    .setAnnotationQueryCtrl(PrometheusAnnotationsQueryCtrl)
    .setQueryEditorHelp(PromCheatSheet);
//# sourceMappingURL=module.js.map