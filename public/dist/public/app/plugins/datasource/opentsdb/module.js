import OpenTsDatasource from './datasource';
import { OpenTsQueryCtrl } from './query_ctrl';
import { DataSourcePlugin } from '@grafana/data';
import { ConfigEditor } from './components/ConfigEditor';
var AnnotationsQueryCtrl = /** @class */ (function () {
    function AnnotationsQueryCtrl() {
    }
    AnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';
    return AnnotationsQueryCtrl;
}());
export var plugin = new DataSourcePlugin(OpenTsDatasource)
    .setQueryCtrl(OpenTsQueryCtrl)
    .setConfigEditor(ConfigEditor)
    .setAnnotationQueryCtrl(AnnotationsQueryCtrl);
//# sourceMappingURL=module.js.map