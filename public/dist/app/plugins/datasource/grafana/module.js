import * as tslib_1 from "tslib";
import { GrafanaDatasource } from './datasource';
import { QueryCtrl } from 'app/plugins/sdk';
var GrafanaQueryCtrl = /** @class */ (function (_super) {
    tslib_1.__extends(GrafanaQueryCtrl, _super);
    function GrafanaQueryCtrl() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    GrafanaQueryCtrl.templateUrl = 'partials/query.editor.html';
    return GrafanaQueryCtrl;
}(QueryCtrl));
var GrafanaAnnotationsQueryCtrl = /** @class */ (function () {
    function GrafanaAnnotationsQueryCtrl() {
        this.types = [{ text: 'Dashboard', value: 'dashboard' }, { text: 'Tags', value: 'tags' }];
        this.annotation.type = this.annotation.type || 'tags';
        this.annotation.limit = this.annotation.limit || 100;
    }
    GrafanaAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';
    return GrafanaAnnotationsQueryCtrl;
}());
export { GrafanaDatasource, GrafanaDatasource as Datasource, GrafanaQueryCtrl as QueryCtrl, GrafanaAnnotationsQueryCtrl as AnnotationsQueryCtrl, };
//# sourceMappingURL=module.js.map