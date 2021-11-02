import { DataSourcePlugin } from '@grafana/data';
import { ElasticDatasource } from './datasource';
import { ConfigEditor } from './configuration/ConfigEditor';
import { QueryEditor } from './components/QueryEditor';
var ElasticAnnotationsQueryCtrl = /** @class */ (function () {
    function ElasticAnnotationsQueryCtrl() {
    }
    ElasticAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';
    return ElasticAnnotationsQueryCtrl;
}());
export var plugin = new DataSourcePlugin(ElasticDatasource)
    .setQueryEditor(QueryEditor)
    .setConfigEditor(ConfigEditor)
    .setAnnotationQueryCtrl(ElasticAnnotationsQueryCtrl);
//# sourceMappingURL=module.js.map