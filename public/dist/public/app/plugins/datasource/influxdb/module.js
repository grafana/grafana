import InfluxDatasource from './datasource';
import { QueryEditor } from './components/QueryEditor';
import InfluxStartPage from './components/InfluxStartPage';
import { DataSourcePlugin } from '@grafana/data';
import ConfigEditor from './components/ConfigEditor';
import VariableQueryEditor from './components/VariableQueryEditor';
var InfluxAnnotationsQueryCtrl = /** @class */ (function () {
    function InfluxAnnotationsQueryCtrl() {
    }
    InfluxAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';
    return InfluxAnnotationsQueryCtrl;
}());
export var plugin = new DataSourcePlugin(InfluxDatasource)
    .setConfigEditor(ConfigEditor)
    .setQueryEditor(QueryEditor)
    .setAnnotationQueryCtrl(InfluxAnnotationsQueryCtrl)
    .setVariableQueryEditor(VariableQueryEditor)
    .setQueryEditorHelp(InfluxStartPage);
//# sourceMappingURL=module.js.map